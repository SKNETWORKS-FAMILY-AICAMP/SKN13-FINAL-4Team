# backend/chat/agent/queue_manager.py
import time
import asyncio
from collections import deque
from threading import Lock
from typing import Callable, Optional
from datetime import datetime
from .topic import TopicThreading
from .classifiers import LiteClassifier
from langchain_core.messages import HumanMessage

class QueueManager:
    """일반 큐 관리 + 자동 트리거 판단"""
    def __init__(self, topic: TopicThreading, trigger_graph_cb: Callable[[str], None], broadcast_cb: Callable[[], None] = None):
        self.topic = topic
        self.general_queue = deque(maxlen=200)
        self.last_event_ts = time.time()
        self._runner_lock = Lock()
        self._graph_busy = False
        self.trigger_graph_cb = trigger_graph_cb
        self.broadcast_cb = broadcast_cb
        self.MAX_THREAD_CANDIDATES = 5
        self._q_lock = Lock()

    def mark_event(self):
        self.last_event_ts = time.time()

    def has_active_work(self) -> bool:
        tid = self.topic.topic_ctx.get("active_tid")
        if not tid: return False
        with self._q_lock:
            return any(m.get("thread_id") == tid for m in self.general_queue)

    def set_busy(self, busy: bool):
        with self._runner_lock:
            self._graph_busy = busy

    def is_busy(self) -> bool:
        with self._runner_lock:
            return self._graph_busy

    def wait_graph_idle(self, timeout: float = 2.5) -> bool:
        start = time.monotonic()
        while time.monotonic() - start < timeout:
            with self._runner_lock:
                busy = self._graph_busy
            if not busy: return True
            time.sleep(0.02)
        return False

    def recent_count_in_thread(self, tid: Optional[str], within_sec: float = 10.0) -> int:
        if not tid: return 0
        now_mono = time.monotonic()
        with self._q_lock:
            return sum(1 for m in self.general_queue if m.get("thread_id") == tid and (now_mono - float(m.get("ts", now_mono))) <= within_sec)

    async def enqueue_general_chat(self, msg: dict, lite: LiteClassifier):
        self.mark_event()
        now_mono = time.monotonic()
        content = msg.get("content", "")

        # 임시 장치: 메시지 길이가 10 미만인 경우 AI 응답 후보에서 제외
        if len(content) < 10:
            return

        lite_res = await asyncio.to_thread(lite.classify, content)
        label_hint = lite_res.get("group_key") or lite_res.get("topic") or "일반"
        salience = float(lite_res.get("salience", 0.4))
        categories = LiteClassifier.map_intent_to_categories(lite_res, threshold=0.3)

        tid, label, sim, is_new = await asyncio.to_thread(self.topic.assign_topic_thread, content, label_hint)

        if lite_res.get("is_question"): salience = min(2.5, salience + 0.15)
        low = content.lower()
        if any(k in low for k in ["고백","이별","짝사랑","썸","상담","연애"]): salience = min(2.5, salience + 0.1)

        self.topic.reset_topic_if_expired(now_mono)
        new_recent = self.recent_count_in_thread(tid)
        cur_tid = self.topic.topic_ctx["active_tid"]
        cur_recent = self.recent_count_in_thread(cur_tid) if cur_tid else 0
        self.topic.maybe_switch_topic(tid, label, salience, sim, is_new, new_recent, cur_recent)

        with self._q_lock:
            self.general_queue.append({**msg, "thread_id": tid, "topic": label, "salience": salience, "intent": {"love": lite_res.get("love", 0.0), "greeting": lite_res.get("greeting", 0.0), "trivia": lite_res.get("trivia", 0.0)}, "categories": categories, "ts": now_mono})
            snapshot = list(self.general_queue)
        
        # 큐 상태 브로드캐스트 (비동기)
        if self.broadcast_cb:
            asyncio.create_task(self.broadcast_cb())

        reasons = []
        if self.topic.topic_ctx["score"] >= self.topic.TOPIC_SCORE_TRIGGER:
            reasons.append(f"topic_score:{self.topic.topic_ctx['active_label']}:{self.topic.topic_ctx['score']:.2f}")
        cur_tid = self.topic.topic_ctx["active_tid"]
        if cur_tid and sum(1 for m in snapshot if m.get("thread_id") == cur_tid) >= 2:
            reasons.append(f"thread_count:{self.topic.topic_ctx['active_label']}")
        if snapshot:
            counts = {}
            for m in snapshot: counts[m["thread_id"]] = counts.get(m["thread_id"], 0) + 1
            top_tid, top_cnt = max(counts.items(), key=lambda kv: kv[1])
            cur_cnt = counts.get(cur_tid, 0)
            if top_tid != cur_tid and top_cnt >= max(2, cur_cnt + 1):
                top_label = self.topic.topic_threads.get(top_tid, {}).get("label") or next((mm.get("topic") for mm in snapshot if mm.get("thread_id") == top_tid), "일반")
                self.topic.topic_ctx.update({"active_tid": top_tid, "active_label": top_label, "score": max(self.topic.topic_ctx["score"], 1.0), "started_at": time.monotonic()})
                reasons.append(f"thread_takeover:{top_label}:{top_cnt}->{cur_cnt}")

        if reasons and not self.is_busy():
            self.trigger_graph_cb("|".join(reasons))
        elif not self.is_busy() and len(snapshot) == 1:
            self.trigger_graph_cb("bootstrap:first_message")

    def branch_general(self, _state):
        active_tid = self.topic.topic_ctx["active_tid"]
        with self._q_lock:
            has_active = bool(active_tid and any(m.get("thread_id") == active_tid for m in self.general_queue))
            queue_nonempty = bool(self.general_queue)
            snapshot = list(self.general_queue)
        if has_active: return "select_best_general"
        if queue_nonempty:
            counts = {}
            for m in snapshot: t = m.get("thread_id"); counts[t] = counts.get(t, 0) + 1
            top_tid, _ = max(counts.items(), key=lambda kv: kv[1])
            top_label = self.topic.topic_threads.get(top_tid, {}).get("label") or next((mm.get("topic") for mm in snapshot if mm.get("thread_id") == top_tid), "일반")
            self.topic.topic_ctx.update({"active_tid": top_tid, "active_label": top_label, "score": self.topic.TOPIC_SCORE_TRIGGER, "started_at": time.monotonic()})
            return "select_best_general"
        return "END"

    def select_best_general(self, state):
        active_tid = self.topic.topic_ctx["active_tid"]
        if not active_tid: return {**state, "__no_selection": True}
        with self._q_lock:
            candidates = [m for m in list(self.general_queue) if m.get("thread_id") == active_tid]
        if not candidates: return {**state, "__no_selection": True}
        candidates = candidates[-self.MAX_THREAD_CANDIDATES:]
        now_mono = time.monotonic()
        scored = []
        for item in candidates:
            content = (item.get("content") or "")
            sal = float(item.get("salience", 0.0))
            recency = max(0.0, min(2.5, 1.0 - (now_mono - float(item.get("ts", now_mono))) / self.topic.TOPIC_VALID_WINDOW_SEC))
            kw_bonus = 0.2 if any(k in content.lower() for k in ["연애","고백","짝사랑","썸","이별","남자친구","여자친구","상담"]) else 0.0
            score = sal * 0.9 + recency * 0.3 + kw_bonus
            scored.append((item, score))
        scored.sort(key=lambda x: x[1], reverse=True)
        best = scored[0][0]
        best_id = best.get("msg_id")
        with self._q_lock:
            new_dq = deque(maxlen=self.general_queue.maxlen)
            removed = False
            for m in self.general_queue:
                if not removed and m.get("msg_id") == best_id: removed = True; continue
                new_dq.append(m)
            self.general_queue.clear(); self.general_queue.extend(new_dq)
            has_more_in_thread = any(m.get("thread_id") == active_tid for m in self.general_queue)
        self.topic.topic_ctx["score"] = max(0.0, self.topic.topic_ctx["score"] - 0.8)
        if not has_more_in_thread:
            self.topic.topic_ctx.update({"active_tid": None, "active_label": None, "score": 0.0, "started_at": time.monotonic()})
            with self._q_lock:
                queue_nonempty = bool(self.general_queue); snapshot = list(self.general_queue)
            if queue_nonempty:
                counts = {};
                for m in snapshot: t = m.get("thread_id"); counts[t] = counts.get(t, 0) + 1
                top_tid, _ = max(counts.items(), key=lambda kv: kv[1])
                top_label = self.topic.topic_threads.get(top_tid, {}).get("label") or next((mm.get("topic") for mm in snapshot if mm.get("thread_id") == top_tid), "일반")
                self.topic.topic_ctx.update({"active_tid": top_tid, "active_label": top_label, "score": self.topic.TOPIC_SCORE_TRIGGER, "started_at": time.monotonic()})
                if not self.is_busy():
                    self.trigger_graph_cb("takeover_after_drain")
        content = best.get("content", "")
        user_id = best.get("user_id", "guest")
        chat_date = best.get("chat_date", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        msg_categories = best.get("categories")
        category_fallback = self.topic.coarse_category_from_label(best.get("topic", ""))
        categories = msg_categories if msg_categories else [category_fallback]
        return {**state, "type": "normal", "categories": categories, "best_chat": content, "user_id": user_id, "chat_date": chat_date, "messages": [HumanMessage(content=content)], "__no_selection": False, "msg_id": best.get("msg_id")}
