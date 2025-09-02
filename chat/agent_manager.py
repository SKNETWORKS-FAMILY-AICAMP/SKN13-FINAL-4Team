# backend/chat/agent_manager.py
from typing import Dict
from .agent.agent import LoveStreamerAgent

# 이 딕셔너리는 실행 중인 모든 스트리머의 에이전트 인스턴스를 관리합니다.
# Key: streamer_id (str)
# Value: LoveStreamerAgent instance
active_agents: Dict[str, LoveStreamerAgent] = {}

# 각 스트리머 방에 연결된 클라이언트 수를 추적하는 딕셔너리입니다.
# 에이전트 인스턴스를 언제 메모리에서 제거할지 결정하는 데 사용됩니다.
# Key: streamer_id (str)
# Value: connection_count (int)
connection_counts: Dict[str, int] = {}
