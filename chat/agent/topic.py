# backend/chat/agent/topic.py
import re
import time
import math
import hashlib
from typing import Optional
from .db import Utils
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.messages import SystemMessage, HumanMessage

class TopicThreading:
    """토픽 스레딩/점수관리 (임베딩 기반)"""
    def __init__(self, fast_llm: ChatOpenAI, embeddings: OpenAIEmbeddings):
        self.fast_llm = fast_llm
        self.embeddings = embeddings
        self.topic_threads = {}
        self.topic_ctx = {
            "active_tid": None,
            "active_label": None,
            "score": 0.0,
            "started_at": 0.0,
        }
        self.TOPIC_VALID_WINDOW_SEC = 30.0
        self.TOPIC_SCORE_TRIGGER = 1.5

    @staticmethod
    def _normalize_text(text: str) -> str:
        s = (text or "").lower()
        s = re.sub(r"[^\\w가-힣\\s]", " ", s)
        s = re.sub(r"\\s+", " ", s).strip()
        return s

    @staticmethod
    def _cosine(a, b):
        if not a or not b: return 0.0
        dot = sum(x*y for x, y in zip(a, b))
        na = math.sqrt(sum(x*x for x in a))
        nb = math.sqrt(sum(y*y for y in b))
        return dot / (na * nb + 1e-9)

    def _embed(self, text: str) -> list[float]:
        return self.embeddings.embed_query(text)

    def _short_label_via_llm(self, text: str, fallback: str = "일반") -> str:
        try:
            sys = SystemMessage(content="아주 짧은 명사구 레이블(4~12자). 조사/꾸밈 제거. 따옴표/마침표 금지.")
            user = HumanMessage(content=f'문장: "{text}"\n레이블만 출력:')
            r = self.fast_llm.invoke([sys, user])
            s = (Utils.text_of(r) or "").strip()
            s = re.sub(r'[\"\'\.\n]', '', s).strip()
            return s[:12] or fallback
        except Exception:
            return fallback

    @staticmethod
    def _tid_from_label(label: str) -> str:
        return hashlib.md5(label.encode("utf-8")).hexdigest()[:12]

    def coarse_category_from_label(self, label: str) -> str:
        t = label or ""
        if any(k in t for k in ["연애", "고백", "짝사랑", "이별", "썸"]): return "연애"
        if any(k in t for k in ["인사", "출첵"]): return "인사"
        return "기타"

    def assign_topic_thread(self, user_text: str, label_hint: Optional[str] = None) -> tuple[str, str, float, bool]:
        base_label = (label_hint or "").strip() or self._short_label_via_llm(user_text, fallback="일반")
        normalized = self._normalize_text(user_text)
        vec = self._embed(base_label + " " + normalized)

        best_tid, best_sim = None, 0.0
        for tid, th in self.topic_threads.items():
            sim = self._cosine(vec, th["centroid"])
            if sim > best_sim:
                best_tid, best_sim = tid, sim

        now = time.monotonic()
        SIM_THRESH = 0.78
        if best_tid and best_sim >= SIM_THRESH:
            th = self.topic_threads[best_tid]
            w = max(1, th["hits"])
            th["centroid"] = [(w*c + v)/(w+1) for c, v in zip(th["centroid"], vec)]
            th["hits"] += 1
            th["last_seen"] = now
            return best_tid, th["label"], best_sim, False

        label = base_label
        tid = self._tid_from_label(label + f"::{now:.3f}")
        self.topic_threads[tid] = {"label": label, "centroid": vec, "hits": 1, "last_seen": now}
        return tid, label, 1.0, True

    def reset_topic_if_expired(self, now_mono: float):
        if self.topic_ctx["started_at"] == 0.0 or (now_mono - self.topic_ctx["started_at"] > self.TOPIC_VALID_WINDOW_SEC):
            self.topic_ctx.update({"active_tid": None, "active_label": None, "score": 0.0, "started_at": now_mono})

    def maybe_switch_topic(self, new_tid: str, new_label: str, salience: float, similarity: float,
                           is_new: bool, recent_new: int, recent_cur: int):
        now_mono = time.monotonic()
        if not self.topic_ctx["active_tid"]:
            self.topic_ctx.update({"active_tid": new_tid, "active_label": new_label, "score": salience, "started_at": now_mono})
            return

        cur_tid = self.topic_ctx["active_tid"]
        if cur_tid == new_tid:
            self.topic_ctx["score"] += salience
            # self.topic_ctx["started_at"] = now_mono # 버그 수정: 동일 주제 유입 시 만료 시간 갱신 방지
            return

        should_switch = (salience >= 0.8 or similarity >= 0.85 or recent_new >= max(2, recent_cur + 1) or
                         self.topic_ctx["score"] < 0.2 or (is_new and salience >= 0.65))
        if should_switch:
            self.topic_ctx.update({"active_tid": new_tid, "active_label": new_label, "score": salience, "started_at": now_mono})
        else:
            self.topic_ctx["score"] = max(0.0, self.topic_ctx["score"] - 0.25)
