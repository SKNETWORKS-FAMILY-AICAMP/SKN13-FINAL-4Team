# backend/chat/agent/state.py
from typing import TypedDict, Annotated, Literal, Optional

from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    """
    LangGraph 상태 컨테이너 타입
    """
    messages: Annotated[list, add_messages]
    type: Literal['normal', 'superchat']
    categories: list
    best_chat: str
    user_id: str
    chat_date: str
    db_greeting_info: dict
    __no_selection: bool
    msg_id: Optional[str]
    assistant_emotion: Optional[str]
