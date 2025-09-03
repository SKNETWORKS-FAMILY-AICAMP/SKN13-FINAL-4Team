# backend/chat/agent/db.py
from datetime import datetime
from typing import Optional
from channels.db import database_sync_to_async
from users.models import User
from chat.models import ChatMessage
from .story import ChatRepository

class UserDB:
    """
    실제 Django User 모델과 연동되는 사용자 정보 조회 클래스.
    기존의 FAKE_USER_DB는 테스트나 fallback 용도로 남겨둘 수 있습니다.
    """
    @staticmethod
    @database_sync_to_async
    def lookup_user(user_id: str, now_str: str) -> dict:
        """
        Django ORM을 사용하여 비동기적으로 사용자 정보를 조회합니다.
        """
        try:
            user = User.objects.get(username=user_id)
            now = datetime.strptime(now_str, "%Y-%m-%d %H:%M:%S")
            
            # last_login 필드가 naive datetime일 수 있으므로 timezone 정보 제거 후 비교
            last_visit = user.last_login.replace(tzinfo=None) if user.last_login else now
            
            gap_days = (now - last_visit).days
            return {
                "exists": True,
                "name": user.nickname or user.username,
                "last_visit": user.last_login.strftime("%Y-%m-%d %H:%M:%S") if user.last_login else "N/A",
                "gap_days": gap_days
            }
        except User.DoesNotExist:
            return {"exists": False, "name": "", "last_visit": None, "gap_days": None}

class Utils:
    """공통 유틸 모음"""
    @staticmethod
    def text_of(msg) -> str:
        """Message/HumanMessage/AIMessage 등에서 content를 안전 추출"""
        return getattr(msg, "content", str(msg))

class DjangoChatRepository(ChatRepository):
    """
    Django ORM을 사용하여 채팅 기록을 조회하는 리포지토리 구현체
    """
    @database_sync_to_async
    def get_last_pair(self) -> Optional[tuple[str, str]]:
        """
        DB에서 가장 최근의 [사용자 메시지, AI 응답] 한 쌍을 조회합니다.
        (AI 응답을 식별할 방법이 현재 없으므로, 가장 최근 2개의 메시지를 가져오는 것으로 임시 구현)
        """
        # TODO: ChatMessage 모델에 is_ai_response와 같은 필드를 추가하여 더 정확하게 조회해야 합니다.
        last_two_messages = ChatMessage.objects.order_by('-created_at')[:2]
        
        if len(last_two_messages) == 2:
            # 최신 메시지가 AI, 그 이전이 사용자라고 가정
            ai_msg = last_two_messages[0]
            user_msg = last_two_messages[1]
            return (user_msg.content, ai_msg.content)
        elif len(last_two_messages) == 1:
            # 메시지가 하나만 있으면 사용자 메시지로 간주
            user_msg = last_two_messages[0]
            return (user_msg.content, "")
        else:
            return None