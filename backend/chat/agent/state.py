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
    
    # 디버깅 및 추적을 위한 추가 필드
    thread_id: Optional[str]
    topic: Optional[str]
    salience: Optional[float]
