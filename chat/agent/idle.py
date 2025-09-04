# backend/chat/agent/idle.py
import asyncio
import time
import uuid
from datetime import datetime
from typing import Callable
from .queue_manager import QueueManager
from .story import StoryRepository, ChatRepository, Story
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

class IdleManager:
    """무채팅 자동 멘트/리캡 + 정체 구제 + 프리아이들"""
    def __init__(self, llm: ChatOpenAI, queue_mgr: QueueManager, story_repo: StoryRepository, chat_repo: ChatRepository, streamer_id: str = None):
        self.llm = llm
        self.queue_mgr = queue_mgr
        self.story_repo = story_repo
        self.chat_repo = chat_repo
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

    def mark_graph_trigger(self):
        self._last_graph_trigger_ts = time.time()

    async def submit_story(self, title: str, body: str, user_id: str = "guest", submitted_at: str = None) -> str:
        sid = str(uuid.uuid4())
        await self.story_repo.add(Story(story_id=sid, user_id=user_id, title=(title or "").strip(), body=(body or "").strip(), submitted_at=submitted_at or datetime.now().strftime("%Y-%m-%d %H:%M:%S"), status="pending"))
        return sid

    async def _idle_recap_once(self, topic_label: str) -> str:
        if (time.time() - self._last_idle_recap_ts) < self.IDLE_RECAP_COOLDOWN_SEC: return ""
        try: last_pair = await self.chat_repo.get_last_pair() 
        except Exception: last_pair = None
        if not last_pair: return ""
        u, a = last_pair
        u_clean = u.strip().replace('\n', ' ')
        a_clean = a.strip().replace('\n', ' ')
        hist = f"사용자: {u_clean}\nAI: {a_clean}"
        sys = SystemMessage(content="너는 밝고 따뜻한 AI 연애 상담 스트리머다. 이전 대화를 1~2문장으로 간단히 상기시키고, 이어서 얘기하고 싶게 만드는 단일 질문 1개를 붙여라. 라디오 톤, 과장 금지, 20~40초 내외.")
        user = HumanMessage(content=f"[현재 토픽 힌트]: {topic_label or '일반'}\n[최근 대화 요약용 원문]\n{hist}\n\n[출력 형식]\n- 1~2문장 요약 + 1문장 질문(하나)\n- 복붙 금지, 새로운 표현 사용")
        try:
            # 강화된 LLM 호출 로직 (추론 서버 → OpenAI 폴백)
            text = None
            
            # 1차: 추론 서버 시도
            if self.inference_client:
                try:
                    text = await self.inference_client.generate_text(
                        system_prompt=sys.content,
                        user_prompt=user.content if hasattr(user, 'content') else str(user)
                    )
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.info(f"자율행동 추론서버 성공: {self.streamer_id}")
                    
                except Exception as e:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.warning(f"자율행동 추론서버 실패: {self.streamer_id} - {e}")
                    text = None
            
            # 2차: OpenAI API 폴백
            if text is None:
                try:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.info(f"자율행동 OpenAI 폴백 사용: {self.streamer_id}")
                    res = await self.llm.ainvoke([sys, user])
                    text = getattr(res, "content", str(res)).strip()
                    
                except Exception as e:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"자율행동 추론서버와 OpenAI 모두 실패: {self.streamer_id} - {e}")
                    return ""
            
            if not text: return ""
            self._last_idle_recap_ts = time.time()
            return text.strip()
        except Exception: 
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
        msg = await self._idle_recap_once(self.topic_label())
        if msg:
            self.queue_mgr.mark_event()
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
