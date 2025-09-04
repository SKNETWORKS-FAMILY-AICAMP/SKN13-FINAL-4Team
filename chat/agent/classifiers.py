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
    """HuggingFace 기반 한국어 감정 분류기"""
    LABELS = ("neutral", "happy", "sad", "mad")

    def __init__(self, fast_llm: ChatOpenAI = None):
        # fast_llm은 호환성을 위해 받지만 사용하지 않음
        self.model = None
        self.tokenizer = None
        self.fast_llm = fast_llm
        
        try:
            from transformers import AutoModelForSequenceClassification, AutoTokenizer
            import torch
            
            # 모델 개발자 테스트 코드 기반으로 수정
            tokenizer_name = "monologg/kobert"
            model_name = "rkdaldus/ko-sent5-classification"
            
            print(f"🔄 토크나이저 로드 시도: {tokenizer_name}")
            self.tokenizer = AutoTokenizer.from_pretrained(
                tokenizer_name,
                trust_remote_code=True
            )
            
            print(f"🔄 감정 분류 모델 로드 시도: {model_name}")
            self.model = AutoModelForSequenceClassification.from_pretrained(
                model_name,
                trust_remote_code=True
            )
            
            # 인덱스에서 시스템 라벨로 직접 매핑
            # 0: Angry, 1: Fear, 2: Happy, 3: Tender, 4: Sad
            self.index_to_system_label = {
                0: "mad",      # Angry
                1: "sad",      # Fear  
                2: "happy",    # Happy
                3: "neutral",  # Tender
                4: "sad"       # Sad
            }
            
            print(f"✅ HuggingFace 감정 분류 모델 로드 완료: {model_name}")
            
        except ImportError as e:
            print(f"❌ 필수 라이브러리 설치 필요: {e}")
            print("📦 다음 명령으로 설치하세요:")
            print("   pip install transformers torch protobuf")
            print("🔄 룰 기반 폴백 모드로 전환합니다.")
            
        except Exception as e:
            print(f"❌ HuggingFace 모델 로드 실패: {e}")
            print("🔄 룰 기반 폴백 모드로 전환합니다.")
            
        # 최종 상태 확인
        if self.model is None or self.tokenizer is None:
            print("⚠️ HF 모델 사용 불가: 룰 기반 분류만 사용됩니다.")

    def classify(self, text: str) -> str:
        """텍스트의 감정을 분류하여 라벨 반환"""
        if self.model is None or self.tokenizer is None:
            # 모델 로드 실패 시 기존 룰 기반 폴백
            return self._fallback_classify(text)
        
        try:
            # 개발자 테스트 코드 방식으로 추론
            import torch
            inputs = self.tokenizer(
                text, 
                return_tensors="pt", 
                padding=True, 
                truncation=True
            )
            
            with torch.no_grad():
                outputs = self.model(**inputs)
            
            # 가장 높은 확률의 라벨 인덱스 선택
            predicted_index = torch.argmax(outputs.logits, dim=1).item()
            
            # 인덱스에서 시스템 라벨로 직접 매핑
            system_label = self.index_to_system_label.get(predicted_index, "neutral")
            
            return system_label
            
        except Exception as e:
            print(f"⚠️ HF 모델 추론 실패: {e}, 폴백 모드 사용")
            return self._fallback_classify(text)
    
    def _fallback_classify(self, text: str) -> str:
        """모델 실패 시 기존 룰 기반 분류"""
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
            return "neutral"
