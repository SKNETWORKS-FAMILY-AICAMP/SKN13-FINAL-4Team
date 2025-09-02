# backend/chat/agent/pipeline.py
import copy
from datetime import datetime
from .state import AgentState
from .responder import Responder
from .queue_manager import QueueManager
from .db import UserDB
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage

class GraphPipeline:
    """LangGraph 파이프라인 구축/실행"""
    def __init__(self, responder: Responder, queue_mgr: QueueManager, user_db: UserDB):
        self.responder = responder
        self.queue_mgr = queue_mgr
        self.user_db = user_db
        self.graph = StateGraph(AgentState)
        self.compiled = None
        self.agent_state: AgentState = {
            "messages": [], "type": "normal", "categories": ["기타"], "best_chat": "",
            "user_id": "guest", "chat_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "db_greeting_info": {}, "__no_selection": False, "assistant_emotion": None, "msg_id": None
        }

    def node_passthrough(self, state: AgentState):
        return state

    def node_select_best(self, state: AgentState):
        new_state = self.queue_mgr.select_best_general(state)
        user_id = new_state.get("user_id", "") or "guest"
        now_str = new_state.get("chat_date", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        info = self.user_db.lookup_user(user_id, now_str)
        return {**new_state, "db_greeting_info": info}

    async def node_final_responder(self, state: AgentState):
        return await self.responder.generate_final_response(state)

    def build(self):
        self.graph.add_node("check_general_queue", self.node_passthrough)
        self.graph.add_node("select_best_general", self.node_select_best)
        self.graph.add_node("final_responder", self.node_final_responder)
        self.graph.set_entry_point("check_general_queue")
        self.graph.add_conditional_edges("check_general_queue", self.queue_mgr.branch_general, {"select_best_general": "select_best_general", END: END})
        self.graph.add_edge("select_best_general", "final_responder")
        self.compiled = self.graph.compile()
        return self

    async def run_one_turn(self):
        self.queue_mgr.set_busy(True)
        try:
            next_state = copy.deepcopy(self.agent_state)
            next_state.update({"type": "normal", "__no_selection": False, "messages": []})
            # self.idle_mgr.mark_graph_trigger() # This will be connected later
            self.agent_state = await self.compiled.ainvoke(next_state)
        finally:
            self.queue_mgr.set_busy(False)
