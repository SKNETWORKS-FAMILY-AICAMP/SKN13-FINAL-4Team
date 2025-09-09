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

class IdleManager:
    """무채팅 자동 멘트/리캡 + 정체 구제 + 프리아이들"""
    def __init__(self, llm: ChatOpenAI, queue_mgr: QueueManager, story_repo: StoryRepository, responder: Responder, streamer_id: str = None):
        self.llm = llm
        self.queue_mgr = queue_mgr
        self.story_repo = story_repo
        self.responder = responder
        self.streamer_id = streamer_id
        
        # 추론 서버 클라이언트 설정
        self.inference_client = None
        if streamer_id:
            try:
                from ..services.inference_client import InferenceClient
                self.inference_client = InferenceClient(streamer_id)
            except ImportError:
                pass  # 추론 서버 미사용 시 무시
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
        """자율행동 쿨다운 타이머를 현재 시간으로 초기화합니다."""
        print("[IdleManager] ⏰ 쿨다운 타이머가 초기화되었습니다.")
        self._last_idle_recap_ts = time.time()

    def mark_graph_trigger(self):
        self._last_graph_trigger_ts = time.time()

    async def submit_story(self, title: str, body: str, user_id: str = "guest", submitted_at: str = None) -> str:
        sid = str(uuid.uuid4())
        await self.story_repo.add(Story(story_id=sid, user_id=user_id, title=(title or "").strip(), body=(body or "").strip(), submitted_at=submitted_at or datetime.now().strftime("%Y-%m-%d %H:%M:%S"), status="pending"))
        return sid

    async def _open_topic_based_dialogue(self) -> str:
        """
        현재 활성화된 대화 주제를 기반으로 새로운 대화의 문을 여는 질문을 생성합니다.
        """
        print("[IdleManager] 🗣️ _open_topic_based_dialogue: 주제 기반 대화 열기 시도.")
        if (time.time() - self._last_idle_recap_ts) < self.IDLE_RECAP_COOLDOWN_SEC:
            print(f"[IdleManager] 쿨다운 중. 남은 시간: {self.IDLE_RECAP_COOLDOWN_SEC - (time.time() - self._last_idle_recap_ts):.1f}초")
            return ""

        active_topic = self.topic_label() or "연애 고민" # 활성 주제가 없으면 기본 주제 사용
        print(f"[IdleManager] 현재 활성 주제: '{active_topic}'")

        sys_prompt = (
            "너는 AI 연애 상담 스트리머다. 현재 대화의 주된 흐름을 이어받아, "
            "모든 시청자가 참여하고 싶게 만드는 개방형 질문을 단 하나만 생성해라.\n"
            "- 특정 개인의 상황을 언급하지 말고, 주제 자체에 대해 질문할 것.\n"
            "- 짧고 자연스러운 라디오 방송 톤을 유지할 것 (1~2문장).\n"
            "- 예시: (주제: 짝사랑) -> '다들 짝사랑해 본 경험 있으시죠? 그럴 때 어떤 점이 가장 힘드셨나요?'"
        )
        user_prompt = f"현재 대화 주제: {active_topic}"

        try:
            text = None
            if self.inference_client:
                try:
                    text = await self.inference_client.generate_text(
                        system_prompt=sys_prompt,
                        user_prompt=user_prompt
                    )
                    print(f"[IdleManager] ✅ 추론 서버로 주제 기반 질문 생성 성공.")
                except Exception as e:
                    print(f"[IdleManager] ⚠️ 추론 서버 호출 실패: {e}, OpenAI로 폴백합니다.")
            
            if text is None:
                res = await self.llm.ainvoke([SystemMessage(content=sys_prompt), HumanMessage(content=user_prompt)])
                text = getattr(res, "content", str(res)).strip()
                print(f"[IdleManager] ✅ OpenAI로 주제 기반 질문 생성 성공.")

            if not text:
                print("[IdleManager] ❌ LLM이 빈 응답을 반환하여 자율행동 실패.")
                return ""
            
            self._last_idle_recap_ts = time.time()
            print(f"[IdleManager] 생성된 자율행동 메시지: '{text}'")
            return text.strip()
        except Exception as e:
            print(f"[IdleManager] ❌ LLM 호출 중 예외 발생: {e}")
            return ""

    async def _play_story_readout(self, story: Story, is_resume: bool = False):
        body = " ".join((story.body or "").strip().split())
        i, n = 0, len(body)
        while i < n:
            j = min(n, i + self.STORY_CHUNK_CHARS)
            _chunk = body[i:j]; i = j
            await asyncio.sleep(self.STORY_CHUNK_DELAY)
            if self.queue_mgr.has_active_work() and not self.queue_mgr.is_busy():
                remaining = body[i:]
                await self.story_repo.save_resume(story.story_id, remaining)
                self.trigger_graph("preidle_break_for_graph")
                await asyncio.sleep(max(1.0, self.STORY_CHUNK_DELAY))
                return
        await self.story_repo.save_resume(story.story_id, "")
        await self.story_repo.mark_done(story.story_id)

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
                "msg_id": f"idle-{uuid.uuid4()}"
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
