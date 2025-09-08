from django.db import models
import os
import json
from .storage import OverwriteStorage

def chatroom_thumbnail_path(instance, filename):
    """
    썸네일 파일의 저장 경로와 파일명을 생성합니다.
    """

    streamer_folder_name = instance.influencer.name if instance.influencer else instance.host.username
    
    extension = os.path.splitext(filename)[1]
    
    return f'chatrooms/{streamer_folder_name}/thumbnail{extension}'

class ChatRoom(models.Model):
    """
    채팅방 모델
    """
    STATUS_CHOICES = (
        ('pending', '준비중'),
        ('live', '방송중'),
        ('finished', '방송종료'),
    )

    host = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='hosted_rooms',
        help_text='채팅방을 생성한 호스트(관리자)'
    )
    name = models.CharField(
        max_length=255,
        help_text='방송 제목'
    )
    # 방송 설명 필드
    description = models.TextField(
        blank=True, 
        null=True, 
        help_text='방송 설명'
    )
    # 썸네일 이미지 필드
    thumbnail = models.ImageField(
        upload_to=chatroom_thumbnail_path,
        storage=OverwriteStorage(), 
        null=True,
        blank=True,
        help_text='채팅방 썸네일 이미지'
    )

    # 인플루언서(방송인) 필드
    influencer = models.ForeignKey(
        'influencers.Influencer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='chat_rooms',
        help_text='채팅방과 연결된 인플루언서'
    )
    # 방송 상태 필드
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default='pending',
        help_text='방송 상태'
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

    hls_url = models.URLField(
        max_length=512, 
        blank=True, 
        null=True, 
        verbose_name="HLS 스트림 URL",
        help_text="라이브 스트리밍을 위한 HLS 주소입니다."
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
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, help_text='기록의 주체 사용자')
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
    sender = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, related_name='sent_messages', help_text='메시지를 보낸 사용자')
    content = models.TextField(help_text='메시지 내용')
    created_at = models.DateTimeField(auto_now_add=True, help_text='메시지가 보내진 시간')
    class Meta:
        ordering = ['created_at']
    def __str__(self):
        return f"Message from {self.sender.username} in {self.room.name}"


class StreamerTTSSettings(models.Model):
    """
    스트리머별 TTS 설정 모델
    모든 사용자가 관리자로 간주되어 설정 변경 가능 (테스트용)
    """
    streamer_id = models.CharField(
        max_length=100,
        unique=True,
        help_text='스트리머 ID (예: jammin-i)'
    )
    
    # TTS 엔진 설정 (ElevenLabs 통일)
    tts_engine = models.CharField(
        max_length=50,
        default='elevenlabs',
        help_text='사용할 TTS 엔진 (elevenlabs)'
    )
    
    # ElevenLabs 설정
    elevenlabs_voice = models.CharField(
        max_length=100,
        default='aneunjin',
        help_text='ElevenLabs 음성 ID'
    )
    elevenlabs_model = models.CharField(
        max_length=100,
        default='eleven_multilingual_v2',
        help_text='ElevenLabs 모델'
    )
    elevenlabs_stability = models.FloatField(
        default=0.5,
        help_text='ElevenLabs 안정성 (0.0-1.0)'
    )
    elevenlabs_similarity = models.FloatField(
        default=0.8,
        help_text='ElevenLabs 유사성 (0.0-1.0)'
    )
    elevenlabs_style = models.FloatField(
        default=0.0,
        help_text='ElevenLabs 스타일 (0.0-1.0)'
    )
    elevenlabs_speaker_boost = models.BooleanField(
        default=True,
        help_text='ElevenLabs 스피커 부스트'
    )
    
    
    # 기타 설정
    auto_play = models.BooleanField(
        default=True,
        help_text='AI 메시지 자동 음성 재생'
    )
    streaming_delay = models.IntegerField(
        default=50,
        help_text='스트리밍 지연 시간 (ms)'
    )
    tts_delay = models.IntegerField(
        default=500,
        help_text='TTS 지연 시간 (ms)'
    )
    chunk_size = models.IntegerField(
        default=3,
        help_text='텍스트 청크 크기'
    )
    sync_mode = models.CharField(
        max_length=20,
        default='after_complete',
        help_text='동기화 모드 (real_time, after_complete, chunked)'
    )
    
    # 메타 정보
    last_updated_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text='마지막 설정 변경자'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Streamer TTS Setting'
        verbose_name_plural = 'Streamer TTS Settings'
        ordering = ['streamer_id']
    
    def __str__(self):
        return f"{self.streamer_id} TTS Settings ({self.tts_engine})"
    
    def to_dict(self):
        """TTS 설정을 딕셔너리로 변환 (프론트엔드 전송용)"""
        return {
            'streamer_id': self.streamer_id,
            'ttsEngine': self.tts_engine,
            'elevenLabsVoice': self.elevenlabs_voice,
            'elevenLabsModel': self.elevenlabs_model,
            'elevenLabsStability': self.elevenlabs_stability,
            'elevenLabsSimilarity': self.elevenlabs_similarity,
            'elevenLabsStyle': self.elevenlabs_style,
            'elevenLabsSpeakerBoost': self.elevenlabs_speaker_boost,
            'autoPlay': self.auto_play,
            'streamingDelay': self.streaming_delay,
            'ttsDelay': self.tts_delay,
            'chunkSize': self.chunk_size,
            'syncMode': self.sync_mode,
            'lastUpdatedBy': self.last_updated_by.username if self.last_updated_by else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def get_or_create_for_streamer(cls, streamer_id):
        """스트리머 ID로 설정을 가져오거나 기본값으로 생성"""
        settings, created = cls.objects.get_or_create(
            streamer_id=streamer_id,
            defaults={
                'tts_engine': 'elevenlabs',
                'elevenlabs_voice': 'aneunjin',
                'elevenlabs_model': 'eleven_multilingual_v2',
                'elevenlabs_stability': 0.5,
                'elevenlabs_similarity': 0.8,
                'elevenlabs_style': 0.0,
                'elevenlabs_speaker_boost': True,
                'auto_play': True,
                'streaming_delay': 50,
                'tts_delay': 500,
                'chunk_size': 3,
                'sync_mode': 'after_complete'
            }
        )
        return settings, created


# ============================================
# 임시 기능: AI 스트리머 사연 처리 모델
# - DB 담당자와 협의 후 확정될 예정입니다.
# ============================================
import uuid

class Story(models.Model):
    """
    AI 스트리머가 읽을 사연 모델 (임시)
    """
    STATUS_CHOICES = (
        ('pending', '대기'),
        ('reading', '읽는 중'),
        ('done', '완료'),
    )
    story_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, help_text='사연을 제출한 사용자')
    title = models.CharField(max_length=255, help_text='사연 제목')
    body = models.TextField(help_text='사연 본문')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending', help_text='사연 처리 상태')
    submitted_at = models.DateTimeField(auto_now_add=True, help_text='제출 시간')

    class Meta:
        verbose_name = 'Story'
        verbose_name_plural = 'Stories'
        ordering = ['submitted_at']

    def __str__(self):
        return f"Story by {self.user.username}: {self.title}"
# ============================================
# 임시 기능 종료
# ============================================