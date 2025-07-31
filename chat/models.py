from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class ChatRoom(models.Model):
    """
    채팅방 모델
    """
    name = models.CharField(
        max_length=255,
        help_text='채팅방의 이름'
    )
    members = models.ManyToManyField(
        User,
        related_name='chat_rooms',
        through='ChatRoomMember',
        help_text='채팅방에 참여하는 사용자들'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text='채팅방이 생성된 시간'
    )

    def __str__(self):
        return self.name

class ChatRoomMember(models.Model):
    """
    사용자와 채팅방의 중간 모델 (다대다 관계 중개)
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        help_text='참여하는 사용자'
    )
    room = models.ForeignKey(
        ChatRoom,
        on_delete=models.CASCADE,
        help_text='참여하는 채팅방'
    )
    joined_at = models.DateTimeField(
        auto_now_add=True,
        help_text='사용자가 채팅방에 참여한 시간'
    )

    class Meta:
        unique_together = ('user', 'room')

    def __str__(self):
        return f"{self.user.username} in {self.room.name}"

class ChatMessage(models.Model):
    """
    채팅 메시지 모델 (채팅 로그)
    """
    room = models.ForeignKey(
        ChatRoom,
        on_delete=models.CASCADE,
        related_name='messages',
        help_text='메시지가 속한 채팅방'
    )
    sender = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sent_messages',
        help_text='메시지를 보낸 사용자'
    )
    content = models.TextField(
        help_text='메시지 내용'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text='메시지가 보내진 시간'
    )

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Message from {self.sender.username} in {self.room.name}"