# backend/chat/agent/db.py
from datetime import datetime
from typing import Optional
from channels.db import database_sync_to_async
from users.models import User
from chat.models import ChatMessage

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
