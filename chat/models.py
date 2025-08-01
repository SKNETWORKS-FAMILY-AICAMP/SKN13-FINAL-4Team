from django.db import models
from django.contrib.auth import get_user_model
from django.conf import settings

User = get_user_model()

class ChatRoom(models.Model):
    """
    채팅방 모델
    """
    host = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE, # 호스트가 탈퇴하면 채팅방도 삭제
        related_name='hosted_rooms',
        help_text='채팅방을 생성한 호스트(방장)'
    )
    name = models.CharField(
        max_length=255,
        help_text='채팅방의 이름'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text='채팅방이 생성된 시간'
    )
    closed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='채팅방이 종료된 시간'
    )

    def __str__(self):
        return self.name

class ChatRoomLog(models.Model):
    """
    사용자의 채팅방 입장 및 퇴장 기록을 남기는 로그 모델
    """
    ACTION_CHOICES = (
        ('enter', '입장'),
        ('exit', '퇴장'),
    )
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, help_text='관련 채팅방')
    user = models.ForeignKey(User, on_delete=models.CASCADE, help_text='기록의 주체 사용자')
    action = models.CharField(max_length=10, choices=ACTION_CHOICES, help_text='수행한 행동 (입장/퇴장)')
    timestamp = models.DateTimeField(auto_now_add=True, help_text='행동이 발생한 시간')
    class Meta:
        ordering = ['timestamp']
    def __str__(self):
        return f"{self.user.username} {self.get_action_display()} {self.room.name}"

class ChatMessage(models.Model):
    """
    채팅 메시지 모델 (채팅 대화 로그)
    """
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='messages', help_text='메시지가 속한 채팅방')
    sender = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='sent_messages', help_text='메시지를 보낸 사용자')
    content = models.TextField(help_text='메시지 내용')
    created_at = models.DateTimeField(auto_now_add=True, help_text='메시지가 보내진 시간')
    class Meta:
        ordering = ['created_at']
    def __str__(self):
        return f"Message from {self.sender.username} in {self.room.name}"