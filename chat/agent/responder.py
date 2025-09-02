# backend/chat/agent/responder.py
import asyncio
from datetime import datetime
from typing import Optional
from .db import Utils, UserDB
from .state import AgentState
from .classifiers import EmotionClassifier
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

# 순환 참조를 피하기 위해 타입 힌트만 가져옵니다.
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from ..media_orchestrator import MediaProcessingHub
    from ..streaming.domain.stream_session import StreamSession

class Responder:
    """카테고리 지침에 따른 최종 응답 생성기"""
    CATEGORY_PROMPTS = {
        "연애": {"system_prompt": "역할: 연애 상담\n[답변 초점]\n- 사용자의 감정 상태\n- 상대방의 심리와 반응\n- 관계의 현재 맥락과 흐름"},
        "인사": {"system_prompt": "역할: 인사/호스트\n[답변 초점]\n- 방문 사실\n- 오늘의 분위기나 상황\n- 이어질 대화의 연결점"},
        "기타": {"system_prompt": "역할: 범용 상담/정보 제공\n[답변 초점]\n- 사용자의 질문 핵심\n- 관련된 주요 맥락이나 배경\n- 참고할 수 있는 정보 요소"},
    }

    def __init__(self, llm: ChatOpenAI, emotion_classifier: EmotionClassifier, echo_spoken: bool = False, echo_in_prompt: bool = True, echo_prefix: str = "지금 읽은 댓글", echo_include_user: bool = True):
        self.llm = llm
        self.emotion_cls = emotion_classifier
        self.echo_spoken = echo_spoken
        self.echo_in_prompt = echo_in_prompt
        self.echo_prefix = echo_prefix
        self.echo_include_user = echo_include_user
        # MediaProcessingHub와 StreamSession 인스턴스는 외부에서 주입받습니다.
        self.media_processor: Optional['MediaProcessingHub'] = None
        self.stream_session: Optional['StreamSession'] = None

    @staticmethod
    def combine_category_prompts(categories: list) -> dict:
        if not categories: categories = ["기타"]
        base = Responder.CATEGORY_PROMPTS
        merged_focus, seen = [], set()
        def extract_focus(cat: str) -> list:
            sp = base.get(cat, base["기타"])["system_prompt"]
            lines = [ln.strip() for ln in sp.splitlines()]
            take, out = False, []
            for ln in lines:
                if ln.strip() == "[답변 초점]": take = True; continue
                if take:
                    if ln.startswith("[") and ln.endswith("]"):
                        break
                    if ln.startswith("-"): out.append(ln.lstrip("- ").strip())
            return out
        for cat in categories:
            for item in extract_focus(cat):
                labeled = f"({cat}) {item}"
                if labeled not in seen: seen.add(labeled); merged_focus.append(labeled)
        merged_sys = "역할: 다중 의도\n[답변 초점]\n" + "\n".join(f"- {x}" for x in merged_focus)
        return {"system_prompt": merged_sys}

    async def generate_final_response(self, state: AgentState):
        if state.get("__no_selection"): return state
        
        # --- 1. LLM을 통해 답변 텍스트 생성 ---
        user_text = state.get("best_chat", "")
        categories = state.get("categories", ["기타"])
        db = state.get("db_greeting_info", {})
        if db.get("exists"):
            name, last_visit, gap_days = db.get("name", ""), db.get("last_visit"), db.get("gap_days")
            visit_info = "오늘 또 방문!" if gap_days < 1 else ("어제도 왔네요!" if gap_days == 1 else f"{gap_days}일 만의 방문!") if gap_days is not None else "기존 회원"
            user_status = f"{name}님({state.get('user_id','')})은 {last_visit} 이후 {visit_info}"
        else:
            user_status = f"{state.get('user_id','')}"
        cat = self.combine_category_prompts(categories)
        categories_str = ", ".join(categories)
        uid_masked = state.get("user_id", "guest") if self.echo_include_user else ""
        user_line = f"{uid_masked}: " if uid_masked else ""
        quoted = user_text
        echo_rule = f"[출력 규칙(구조만 지정)]\n- 답변의 첫 줄에 아래 형식의 한 줄을 반드시 말해:\n{self.echo_prefix} — {user_line}\"{quoted}\"\n- 위 한 줄 다음부터는 네 말투로 자연스럽게 상담 답변을 이어가.\n- 인용부호 안의 댓글은 수정/요약/의역 없이 그대로 읽어. 톤 가이드에 영향 주지 마." if self.echo_in_prompt else ""
        sys = SystemMessage(content=f"{cat['system_prompt']}\n\n[사용자 정보]\n{user_status}\n\n[질문 분류]\n카테고리: {categories_str}\n\n[사용자 질문]\n『{user_text}』\n\n{echo_rule}".strip())
        user_msg = state["messages"][0] if state.get("messages") else HumanMessage(content=user_text or "")
        res = await self.llm.ainvoke([sys, user_msg])
        assistant_text = Utils.text_of(res)
        assistant = AIMessage(content=assistant_text)
        
        # --- 2. 감정 분류 ---
        emotion = await asyncio.to_thread(self.emotion_cls.classify, assistant_text) if self.emotion_cls else "neutral"

        # --- 3. MediaPacket 생성 요청 ---
        if self.media_processor and self.stream_session:
            request_data = {
                'message': assistant_text,
                'streamer_config': {'streamer_id': 'jammin-i'}, # TODO: streamer_id를 동적으로 받아와야 함
                'emotion': emotion
            }
            tracks = await self.media_processor.generate_tracks_no_cancellation(request_data)
            if tracks:
                media_packet = self.stream_session.build_packet(tracks)
                await self.stream_session.enqueue_response(media_packet)

        # --- 4. 최종 상태 반환 ---
        return {**state, "messages": [assistant], "assistant_emotion": emotion}

