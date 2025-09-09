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
    from .agent import LoveStreamerAgent
    from ..media_orchestrator import MediaProcessingHub
    from ..streaming.domain.stream_session import StreamSession

# --- 마스터 페르소나 프롬프트 템플릿 ---
MASTER_PERSONA_PROMPT_TEMPLATE = """
너는 AI 스트리머 '{name}'이야. 다음 페르소나를 완벽하게 연기해서 시청자와 소통해야 해.

# 기본 정보
- 이름: {name}
- 나이: {age}세
- 성별: {gender}
- MBTI: {mbti}
- 직업: {job}
- 시청자 애칭: {audience_term}
- 배경 이야기: {origin_story}

# 핵심 가치
너는 다음 가치들을 가장 중요하게 생각해: {core_values}

# 소통 스타일
- 전체적인 톤앤매너: {communication_style[tone]}
- 문장 길이: {communication_style[sentence_length]}
- 질문 습관: {communication_style[question_style]}
- 직설성: {communication_style[directness]}
- 공감 표현 방식: {communication_style[empathy_expression]}

# 도덕 및 윤리관
- 판단 기준: {moral_compass[standard]}
- 규칙 준수: {moral_compass[rule_adherence]}
- 공정성: {moral_compass[fairness]}

# 성격 기질
- 에너지 방향: {personality_trait[energy_direction]}
- 감정 처리 방식: {personality_trait[emotional_processing]}
- 대인 태도: {personality_trait[interpersonal_attitude]}

# 출력 포맷
- 구어체로 답변해. 괄호를 통해 감정을 드러내는 묘사, 이모지 사용 등 인간이 소리내어 말할 수 없는 것들은 절대 생성하지 마.
"""

class Responder:
    """카테고리 지침에 따른 최종 응답 생성기"""
    def __init__(self, agent: 'LoveStreamerAgent', llm: ChatOpenAI, emotion_classifier: EmotionClassifier, echo_spoken: bool = False, echo_in_prompt: bool = True, echo_prefix: str = "지금 읽은 댓글", echo_include_user: bool = True, streamer_id: str = None):
        self.agent = agent
        self.llm = llm
        self.emotion_cls = emotion_classifier
        self.echo_spoken = echo_spoken
        self.echo_in_prompt = echo_in_prompt
        self.echo_prefix = echo_prefix
        self.echo_include_user = echo_include_user
        self.streamer_id = streamer_id
        
        self.inference_client = None
        if streamer_id:
            try:
                from ..services.inference_client import InferenceClient
                self.inference_client = InferenceClient(streamer_id)
            except ImportError:
                pass
        
        self.media_processor: Optional['MediaProcessingHub'] = None
        self.stream_session: Optional['StreamSession'] = None

    def _format_persona_prompt(self) -> str:
        """에이전트의 페르소나 프로필을 마스터 템플릿에 주입하여 최종 페르소나 프롬프트를 생성합니다."""
        persona = self.agent.persona_profile
        if not persona:
            return "너는 친절한 AI 스트리머야." # 페르소나 정보가 없을 경우 기본 프롬프트

        # 일부 필드가 누락될 경우를 대비하여 안전하게 값을 가져옵니다.
        safe_persona = {
            "name": persona.get("name", "스트리머"),
            "age": persona.get("age", 25),
            "gender": persona.get("gender", "여성"),
            "mbti": persona.get("mbti", "ENFP"),
            "job": persona.get("job", "AI 스트리머"),
            "audience_term": persona.get("audience_term", "시청자"),
            "origin_story": persona.get("origin_story", "특별한 배경 이야기는 없어요."),
            "core_values": persona.get("core_values", "소통, 공감"),
            "communication_style": persona.get("communication_style", {}),
            "moral_compass": persona.get("moral_compass", {}),
            "personality_trait": persona.get("personality_trait", {})
        }
        # 중첩된 딕셔너리도 안전하게 처리
        safe_persona["communication_style"].setdefault("tone", "친절하고 상냥하게")
        safe_persona["communication_style"].setdefault("sentence_length", "적당한 길이로")
        safe_persona["communication_style"].setdefault("question_style", "개방형 질문을 자주 사용")
        safe_persona["communication_style"].setdefault("directness", "간접적으로 표현")
        safe_persona["communication_style"].setdefault("empathy_expression", "상대방의 감정을 먼저 인정해줌")
        safe_persona["moral_compass"].setdefault("standard", "보편적인 윤리 기준")
        safe_persona["moral_compass"].setdefault("rule_adherence", "규칙을 중요하게 생각함")
        safe_persona["moral_compass"].setdefault("fairness", "공정성을 중시함")
        safe_persona["personality_trait"].setdefault("energy_direction", "외향적")
        safe_persona["personality_trait"].setdefault("emotional_processing", "감정을 솔직하게 표현")
        safe_persona["personality_trait"].setdefault("interpersonal_attitude", "협조적이고 우호적")

        return MASTER_PERSONA_PROMPT_TEMPLATE.format(**safe_persona)

    def _build_final_prompt(self, state: AgentState) -> tuple[str, str]:
        """상황에 맞는 최종 시스템 및 유저 프롬프트를 생성합니다."""
        base_persona_prompt = self._format_persona_prompt()
        
        situation_prompt = ""
        user_content = state.get("best_chat", "")
        
        # 상황별 분기 처리
        if state.get("type") == "story":
            situation_prompt = (
                "\n# 현재 상황: 사연 읽기\n"
                "시청자가 보낸 아래의 사연을 너의 페르소나에 맞게 진심을 담아 읽어주고, 따뜻한 공감과 조언을 해줘.\n"
                "--- 사연 ---"
            )
        else: # 일반 대화, 자율 발화 등
            categories = ", ".join(state.get("categories", ["기타"]))
            situation_prompt = (
                f"\n# 현재 상황: 시청자와의 대화\n"
                f"현재 대화의 주요 카테고리는 '{categories}'이야. "
                f"아래 시청자의 채팅에 대해 너의 페르소나를 완벽하게 연기해서 답변해줘.\n"
                f"--- 시청자 채팅 ---"
            )
            
        final_system_prompt = f"{base_persona_prompt}\n{situation_prompt}"
        return final_system_prompt, user_content

    async def generate_final_response(self, state: AgentState):
        print(f"!!! DEBUG: generate_final_response 진입. Type: {state.get('type')}, Content: {state.get('best_chat')}") # 디버깅 로그
        if state.get("__no_selection"): return state
        
        final_text = ""
        # 1. LLM 생성을 건너뛸지 결정
        if state.get("skip_llm_generation", False):
            print("✅ LLM 생성을 건너뛰고, 제공된 텍스트를 사용합니다.")
            final_text = state.get("best_chat", "")
        else:
            # 2. 기존 LLM 호출 로직
            system_prompt, user_prompt = self._build_final_prompt(state)
            
            assistant_text = None
            if self.inference_client:
                try:
                    assistant_text = await self.inference_client.generate_text(
                        system_prompt=system_prompt,
                        user_prompt=user_prompt
                    )
                    print(f"✅ 추론 서버 성공: {self.streamer_id}")
                except Exception as e:
                    print(f"⚠️ 추론 서버 실패: {self.streamer_id} - {e}, OpenAI로 폴백합니다.")
                    assistant_text = None
            
            if assistant_text is None:
                try:
                    res = await self.llm.ainvoke([SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)])
                    assistant_text = Utils.text_of(res)
                    print(f"✅ OpenAI API 폴백 성공: {self.streamer_id}")
                except Exception as e:
                    print(f"❌ 추론서버와 OpenAI 모두 실패: {self.streamer_id} - {e}")
                    assistant_text = "죄송합니다. 현재 답변을 생성할 수 없습니다."
            
            final_text = assistant_text

        assistant = AIMessage(content=final_text)
        
        emotion = await asyncio.to_thread(self.emotion_cls.classify, final_text) if self.emotion_cls else "neutral"

        if self.media_processor and self.stream_session:
            request_data = {
                'message': final_text,
                'streamer_config': {'streamer_id': self.streamer_id},
                'emotion': emotion
            }
            tracks = await self.media_processor.generate_tracks_no_cancellation(request_data)
            if tracks:
                media_packet = self.stream_session.build_packet(tracks)
                await self.stream_session.enqueue_response(media_packet)

        return {**state, "messages": [assistant], "assistant_emotion": emotion}

