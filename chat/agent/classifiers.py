# backend/chat/agent/classifiers.py
import re
import json
from .db import Utils
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

class LiteClassifier:
    """경량 LLM 1회 호출로 분류/라벨링 수행"""
    def __init__(self, fast_llm: ChatOpenAI):
        self.fast_llm = fast_llm

    def _parse_or_default(self, raw: str) -> dict:
        m = re.search(r"\{{[\s\S]*\}}", raw or "")
        try:
            data = json.loads(m.group()) if m else {}
        except Exception:
            data = {}
        return {{
            "love": float(data.get("love", 0.0)),
            "greeting": float(data.get("greeting", 0.0)),
            "trivia": float(data.get("trivia", 0.0)),
            "topic": (data.get("topic") or "일반")[:30],
            "group_key": (data.get("group_key") or data.get("topic") or "일반")[:20],
            "salience": float(data.get("salience", 0.4)),
            "is_question": bool(data.get("is_question", False)),
        }}

    def classify(self, user_text: str) -> dict:
        sys = SystemMessage(content=(
            "너는 실시간 채팅을 빠르게 분류/라벨링하는 보조자다.\n"
            "JSON 하나만 출력해라. 키: love, greeting, trivia (0~1), topic(명사구), group_key(4~12자), salience(0~2.5권장), is_question(bool)."
        ))
        prompt = HumanMessage(content=f"문장: \"{user_text}\"\nJSON만 출력")
        try:
            r = self.fast_llm.invoke([sys, prompt])
            return self._parse_or_default(getattr(r, "content", str(r)))
        except Exception:
            low = (user_text or "").lower()
        if any(k in low for k in ["고백","짝사랑","이별","연애","썸"]):
            return {"love":0.8,"greeting":0.1,"trivia":0.1,"topic":"연애 고민","group_key":"연애 고민","salience":0.8,"is_question":"?" in low}
        if any(k in low for k in ["안녕","하이","반가","출첵"]):
            return {"love":0.1,"greeting":0.7,"trivia":0.2,"topic":"인사","group_key":"인사","salience":0.3,"is_question":False}
        return {"love":0.2,"greeting":0.1,"trivia":0.7,"topic":"일반","group_key":"일반","salience":0.2,"is_question":"?" in low}

    @staticmethod
    def map_intent_to_categories(intent: dict, threshold: float = 0.3) -> list:
        cats = []
        order = [("love","연애"),("greeting","인사"),("trivia","기타")]
        for k, cat in order:
            if intent.get(k, 0.0) >= threshold:
                cats.append(cat)
        if intent.get("love",0.0) >= 0.7 and intent.get("greeting",0.0) >= 0.15 and "인사" not in cats:
            cats.append("인사")
        return cats or ["기타"]

class EmotionClassifier:
    """답변 텍스트의 감정 레이블 분류기"""
    LABELS = ("neutral", "happy", "sad", "mad")

    def __init__(self, fast_llm: ChatOpenAI):
        self.fast_llm = fast_llm

    def classify(self, text: str) -> str:
        sys = SystemMessage(content=(
            "You are an emotion classifier. "
            "Given a chat reply, output EXACTLY one label from: neutral, happy, sad, mad. "
            "No extra words, no punctuation."
        ))
        user = HumanMessage(content=f'Text: \"\"\"{text}\"\"\"')
        try:
            low = (text or "").lower()
            if any(k in low for k in ["기뻐", "행복", "좋아", "고마워", "감사", "yay", "great", "awesome", "😊", "😀"]):
                return "happy"
            if any(k in low for k in ["슬퍼", "우울", "속상", "눈물", "힘들", "ㅠ", "ㅜ", "sad", "depressed"]):
                return "sad"
            if any(k in low for k in ["화나", "빡", "짜증", "분노", "열받", "angry", "mad", "furious", ">:("]):
                return "mad"
            return "neutral"
        except Exception:
            r = self.fast_llm.invoke([sys, user])
            s = (Utils.text_of(r) or "").strip().lower()
            s = re.sub(r'[^a-z]', '', s)
            return s if s in self.LABELS else "neutral"
