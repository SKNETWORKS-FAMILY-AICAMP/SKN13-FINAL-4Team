# backend/chat/agent/story.py
from dataclasses import dataclass
from typing import Protocol, Optional
from channels.db import database_sync_to_async
from chat.models import Story as StoryModel, ChatMessage
from users.models import User

@dataclass
class Story:
    """
    사연(스토리) 단위 모델
    """
    story_id: str
    user_id: str
    title: str
    body: str
    submitted_at: str
    status: str = "pending"

class StoryRepository(Protocol):
    """사연 저장/큐잉을 위한 추상 인터페이스"""
    async def add(self, story: Story) -> None: ...
    async def pop_next(self) -> Optional[Story]: ...
    async def has_pending(self) -> bool: ...
    async def save_resume(self, story_id: str, remaining_body: str) -> None: ...
    async def get_resume(self) -> Optional[str]: ...
    async def mark_done(self, story_id: str) -> None: ...

class ChatRepository(Protocol):
    """DB에서 '가장 마지막 user/ai 한 쌍'을 읽어오기 위한 인터페이스"""
    async def get_last_pair(self) -> Optional[tuple[str, str]]: ...


class DjangoStoryRepository(StoryRepository):
    """
    Django ORM을 사용하여 사연을 관리하는 리포지토리 구현체
    """
    @database_sync_to_async
    def add(self, story: Story) -> None:
        user = User.objects.get(username=story.user_id)
        StoryModel.objects.create(
            story_id=story.story_id,
            user=user,
            title=story.title,
            body=story.body,
            status=story.status
        )

    @database_sync_to_async
    def pop_next(self) -> Optional[Story]:
        next_story = StoryModel.objects.filter(status='pending').order_by('submitted_at').first()
        if next_story:
            next_story.status = 'reading'
            next_story.save()
            return Story(
                story_id=str(next_story.story_id),
                user_id=next_story.user.username,
                title=next_story.title,
                body=next_story.body,
                submitted_at=next_story.submitted_at.strftime("%Y-%m-%d %H:%M:%S"),
                status=next_story.status
            )
        return None

    @database_sync_to_async
    def has_pending(self) -> bool:
        return StoryModel.objects.filter(status='pending').exists()

    @database_sync_to_async
    def save_resume(self, story_id: str, remaining_body: str) -> None:
        # 임시 구현: 이어읽기 상태를 저장할 별도의 모델이나 필드가 필요합니다.
        # 여기서는 간단하게 캐시를 사용하거나, 별도 모델을 만들어야 합니다.
        # 지금은 로깅으로 대체합니다.
        print(f"STORY RESUME (not implemented): story_id={story_id}, remaining={len(remaining_body)} chars")
        pass

    @database_sync_to_async
    def get_resume(self) -> Optional[str]:
        # 임시 구현: save_resume와 마찬가지로 실제 구현이 필요합니다.
        return None

    @database_sync_to_async
    def mark_done(self, story_id: str) -> None:
        try:
            story = StoryModel.objects.get(story_id=story_id)
            story.status = 'done'
            story.save()
        except StoryModel.DoesNotExist:
            pass

class DjangoChatRepository(ChatRepository):
    """
    Django ORM을 사용하여 채팅 기록을 가져오는 리포지토리 구현체
    """
    @database_sync_to_async
    def get_last_pair(self) -> Optional[tuple[str, str]]:
        # AI(sender=None) 메시지와 그 직전 사용자 메시지를 찾습니다.
        last_ai_msg = ChatMessage.objects.filter(sender=None).order_by('-created_at').first()
        if not last_ai_msg:
            return None
        
        last_user_msg = ChatMessage.objects.filter(
            sender__isnull=False,
            created_at__lt=last_ai_msg.created_at
        ).order_by('-created_at').first()

        if not last_user_msg:
            return None
            
        return (last_user_msg.content, last_ai_msg.content)
