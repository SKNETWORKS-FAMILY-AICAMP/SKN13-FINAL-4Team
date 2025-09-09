# backend/chat/agent/idle.py
import asyncio
import time
import uuid
from datetime import datetime
from typing import Callable
from .queue_manager import QueueManager
from .story import StoryRepository, Story
from .responder import Responder
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

# 순환 참조를 피하기 위해 타입 힌트만 가져옵니다.
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .agent import LoveStreamerAgent

class IdleManager:
    """무채팅 자동 멘트/리캡 + 정체 구제 + 프리아이들"""
    def __init__(self, agent: 'LoveStreamerAgent', llm: ChatOpenAI, queue_mgr: QueueManager, story_repo: StoryRepository, responder: Responder, streamer_id: str = None):
        self.agent = agent
        self.llm = llm
        self.queue_mgr = queue_mgr
        self.story_repo = story_repo
        self.responder = responder
        self.streamer_id = streamer_id
        
        self.inference_client = None
        if streamer_id:
            try:
                from ..services.inference_client import InferenceClient
                self.inference_client = InferenceClient(streamer_id)
            except ImportError:
                pass
        self.IDLE_RECAP_COOLDOWN_SEC = 120
        self._last_idle_recap_ts = 0.0
        self.FORCE_GRAPH_RUN_IF_STALE_SEC = 10
        self._last_graph_trigger_ts = 0.0
        self.PREIDLE_MIN_QUIET_SEC = 6
        self.PREIDLE_COOLDOWN_SEC = 45
        self._last_preidle_ts = 0.0
        self.STORY_CHUNK_CHARS = 180
        self.STORY_CHUNK_DELAY = 1.2
        self.START_WITH_STORY = True
        self._did_start_with_story = False
        self.trigger_graph = lambda reason: None
        self.topic_label = lambda: ""
        self.bootstrap_topic_from_tail = lambda: None

    def reset_cooldown(self):
        print("[IdleManager] ⏰ 쿨다운 타이머가 초기화되었습니다.")
        self._last_idle_recap_ts = time.time()

    def mark_graph_trigger(self):
        self._last_graph_trigger_ts = time.time()

    async def submit_story(self, title: str, body: str, user_id: str = "guest", submitted_at: str = None) -> str:
        sid = str(uuid.uuid4())
        await self.story_repo.add(Story(story_id=sid, user_id=user_id, title=(title or "").strip(), body=(body or "").strip(), submitted_at=submitted_at or datetime.now().strftime("%Y-%m-%d %H:%M:%S"), status="pending"))
        return sid

    async def _open_topic_based_dialogue(self) -> str:
        print("[IdleManager] 🗣️ _open_topic_based_dialogue: 주제 기반 대화 열기 시도.")
        if (time.time() - self._last_idle_recap_ts) < self.IDLE_RECAP_COOLDOWN_SEC:
            print(f"[IdleManager] 쿨다운 중. 남은 시간: {self.IDLE_RECAP_COOLDOWN_SEC - (time.time() - self._last_idle_recap_ts):.1f}초")
            return ""

        active_topic = self.topic_label() or "연애 고민"
        print(f"[IdleManager] 현재 활성 주제: '{active_topic}'")

        # --- 리팩토링된 부분 ---
        # 1. Responder로부터 완전한 페르소나 프롬프트를 가져옵니다.
        base_persona_prompt = self.responder._format_persona_prompt()
        
        # 2. 자율 발화 상황에 맞는 프롬프트를 구체화합니다.
        situation_prompt = (
            f"\n# 현재 상황: 자율 발화\n"
            f"현재 채팅이 잠시 없는 상태야. '{active_topic}' 주제와 관련해서 시청자들의 참여를 유도할 수 있는 "
            f"흥미로운 혼잣말이나 개방형 질문을 너의 페르소나에 맞게 완벽하게 연기해서 생성해줘. "
            f"이 발언은 방송의 다음 흐름을 결정하는 중요한 멘트가 될 거야. (2~3 문장 내외로)"
        )
        
        # 3. 페르소나와 상황 프롬프트를 결합하여 최종 프롬프트를 완성합니다.
        sys_prompt = f"{base_persona_prompt}{situation_prompt}"
        user_prompt = "자, 방송을 이끌어갈 멋진 멘트를 시작해줘!"

        try:
            text = None
            if self.inference_client:
                try:
                    # 4. 단일 LLM 호출로 최종 텍스트를 생성합니다.
                    text = await self.inference_client.generate_text(system_prompt=sys_prompt, user_prompt=user_prompt)
                    print(f"[IdleManager] ✅ [Single Call] 추론 서버로 최종 자율 발화 생성 성공.")
                except Exception as e:
                    print(f"[IdleManager] ⚠️ 추론 서버 호출 실패: {e}, OpenAI로 폴백합니다.")
            
            if text is None:
                res = await self.llm.ainvoke([SystemMessage(content=sys_prompt), HumanMessage(content=user_prompt)])
                text = getattr(res, "content", str(res)).strip()
                print(f"[IdleManager] ✅ [Single Call] OpenAI로 최종 자율 발화 생성 성공.")

            if not text:
                print("[IdleManager] ❌ LLM이 빈 응답을 반환하여 자율행동 실패.")
                return ""
            
            self._last_idle_recap_ts = time.time()
            print(f"[IdleManager] 생성된 최종 자율행동 메시지: '{text}'")
            return text.strip()
        except Exception as e:
            print(f"[IdleManager] ❌ LLM 호출 중 예외 발생: {e}")
            return ""

    async def _play_story_readout(self, story: Story, is_resume: bool = False):
        """사연을 LLM에 전달하여 응답을 생성하고, 완료 처리합니다."""
        print(f"!!! DEBUG: _play_story_readout 진입. Story ID: {story.story_id}")

        story_content = f"제목: {story.title}\n\n내용: {story.body}"
        story_state = {
            "messages": [HumanMessage(content=story_content)],
            "type": "story",
            "categories": ["사연읽기", "공감"],
            "best_chat": story_content,
            "user_id": story.user_id,
            "chat_date": story.submitted_at,
            "db_greeting_info": {"exists": False},
            "__no_selection": False,
            "assistant_emotion": "empathetic",
            "msg_id": f"story-{story.story_id}"
        }

        asyncio.create_task(self.responder.generate_final_response(story_state))
        print(f"!!! DEBUG: Responder에 사연 처리 작업 전달 완료. Story ID: {story.story_id}")

        await self.story_repo.save_resume(story.story_id, "")
        await self.story_repo.mark_done(story.story_id)
        print(f"!!! DEBUG: Story 상태를 'done'으로 변경 완료. Story ID: {story.story_id}")

        await asyncio.sleep(self.STORY_CHUNK_DELAY)

    async def _resume_or_new_or_recap(self, interval: int, *, force_story: bool = False, story_only: bool = False) -> bool:
        remaining = await self.story_repo.get_resume()
        if remaining:
            fake = Story(story_id=f"resume-{uuid.uuid4()}", user_id="system", title="", body=remaining, submitted_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"), status="reading")
            await self._play_story_readout(fake, is_resume=True)
            self._last_preidle_ts = time.time()
            return True
        has = await self.story_repo.has_pending()
        if (force_story and has) or (has and (time.time() - self._last_preidle_ts) >= self.PREIDLE_COOLDOWN_SEC):
            story = await self.story_repo.pop_next()
            if story:
                print(f"!!! DEBUG: Story popped from DB, starting readout. Story ID: {story.story_id}") # 디버깅 로그
                await self._play_story_readout(story)
                self._last_preidle_ts = time.time()
                return True
        if story_only: return False
        msg = await self._open_topic_based_dialogue()
        if msg:
            self.queue_mgr.mark_event()
            autonomous_state = {
                "messages": [HumanMessage(content=msg)],
                "type": "normal",
                "categories": ["자율행동", self.topic_label() or "일반"],
                "best_chat": msg,
                "user_id": "system_idle",
                "chat_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "db_greeting_info": {"exists": False},
                "__no_selection": False,
                "assistant_emotion": "neutral",
                "msg_id": f"idle-{uuid.uuid4()}",
                "skip_llm_generation": True  # --- 리팩토링된 부분 ---
            }
            asyncio.create_task(self.responder.generate_final_response(autonomous_state))
            await asyncio.sleep(max(5, interval // 3))
            return True
        return False

    async def idle_loop(self, interval: int = 15):
        while True:
            await asyncio.sleep(2)
            try:
                busy = self.queue_mgr.is_busy()
                has_work = self.queue_mgr.has_active_work()
                quiet = (time.time() - self.queue_mgr.last_event_ts) >= min(interval, self.PREIDLE_MIN_QUIET_SEC)
                if self.START_WITH_STORY and not self._did_start_with_story:
                    if not busy and not has_work:
                        if await self._resume_or_new_or_recap(interval, force_story=True, story_only=True): continue
                    self._did_start_with_story = True
                if quiet and not busy and not has_work:
                    if await self._resume_or_new_or_recap(interval): continue
                stale = quiet and not busy and has_work and ((time.time() - self._last_graph_trigger_ts) >= self.FORCE_GRAPH_RUN_IF_STALE_SEC)
                if stale:
                    if not self.topic_label(): self.bootstrap_topic_from_tail()
                    self.trigger_graph("stale_work_fallback")
                    await asyncio.sleep(max(5, interval // 3))
            except Exception: pass

    def set_graph_trigger(self, trigger_cb: Callable[[str], None]):
        self.trigger_graph = trigger_cb

    def set_bootstrap_helpers(self, topic_label_fn: Callable[[], str], bootstrap_fn: Callable[[], None]):
        self.topic_label = topic_label_fn
        self.bootstrap_topic_from_tail = bootstrap_fn
