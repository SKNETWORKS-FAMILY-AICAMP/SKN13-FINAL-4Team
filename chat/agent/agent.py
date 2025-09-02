# backend/chat/agent/agent.py
import asyncio
import uuid
from datetime import datetime
from typing import Callable
from .state import AgentState
from .classifiers import LiteClassifier, EmotionClassifier
from .topic import TopicThreading
from .queue_manager import QueueManager
from .responder import Responder
from .pipeline import GraphPipeline
from .idle import IdleManager
from .story import StoryRepository, ChatRepository
from .db import UserDB, Utils
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.messages import HumanMessage

class LoveStreamerAgent:
    """통합 에이전트"""
    def __init__(self, api_key: str, story_repo: StoryRepository, chat_repo: ChatRepository):
        self.llm = ChatOpenAI(model="gpt-4o", temperature=0.2, api_key=api_key)
        self.fast_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2, api_key=api_key)
        self.embeddings = OpenAIEmbeddings(model="text-embedding-3-small", api_key=api_key)
        self.lite = LiteClassifier(self.fast_llm)
        self.topic = TopicThreading(self.fast_llm, self.embeddings)
        self.queue = QueueManager(self.topic, trigger_graph_cb=self.trigger_graph_async)
        self.emotion_cls = EmotionClassifier(self.fast_llm)
        self.responder = Responder(self.llm, self.emotion_cls)
        self.idle = IdleManager(self.llm, self.queue, story_repo, chat_repo)
        self.graph = GraphPipeline(self.responder, self.queue, UserDB()).build()
        self.superchat_q = asyncio.Queue()

        self.idle.set_graph_trigger(self.trigger_graph_async)
        self.idle.set_bootstrap_helpers(
            topic_label_fn=lambda: self.topic.topic_ctx.get("active_label") or "",
            bootstrap_fn=self._bootstrap_topic_from_tail
        )
        # Link run_one_turn to idle manager's trigger
        self.graph.idle_mgr = self.idle

    def _compact_result_from_state(self, state: dict) -> dict:
        return {
            "assistant_text": Utils.text_of(state["messages"][-1]) if state.get("messages") else None,
            "emotion": state.get("assistant_emotion"),
            "categories": state.get("categories", []),
        }

    async def on_new_input_async(self, input_msg: dict):
        msg_type = input_msg.get("type", "normal")
        content = input_msg.get("content", "")
        msg_id = input_msg.get("msg_id") or str(uuid.uuid4())
        if "msg_id" not in input_msg:
            input_msg = {**input_msg, "msg_id": msg_id}

        if msg_type == "superchat" and content:
            self.queue.mark_event()
            await self.superchat_q.put(dict(input_msg))
            return {"routed": "superchat_async_worker", "state": None, "result": None}

        if msg_type == "normal" and content:
            self.queue.mark_event()
            await self.queue.enqueue_general_chat(input_msg, self.lite)
            await asyncio.sleep(0.1)
            self.queue.wait_graph_idle(1.0)

        state = self.graph.agent_state
        return {"state": state, "result": self._compact_result_from_state(state)}

    def trigger_graph_async(self, reason: str = ""):
        print(f"[trigger_graph_async] Triggered (reason={reason})")
        asyncio.create_task(self.graph.run_one_turn())

    def _bootstrap_topic_from_tail(self):
        with self.queue._q_lock:
            gq = self.queue.general_queue
            if not self.topic.topic_ctx.get("active_tid") and len(gq) > 0:
                last = gq[-1]
                tid, label = last.get("thread_id"), last.get("topic", "일반")
                self.topic.topic_ctx.update({"active_tid": tid, "active_label": label, "score": self.topic.TOPIC_SCORE_TRIGGER, "started_at": time.monotonic()})

    async def superchat_worker_coro(self):
        """Superchat queue consumer coroutine"""
        while True:
            msg = await self.superchat_q.get()
            try:
                # This part will be expanded to call a superchat-specific responder
                print(f"Handling superchat: {msg}")
                # For now, just log it. Integration with responder is next.
            finally:
                self.superchat_q.task_done()
