from django.db import models
from django.conf import settings

class TTSLog(models.Model):
    """
    TTS API 호출 기록을 저장하여 디버깅에 사용하는 모델
    """
    STATUS_CHOICES = [
        ('SUCCESS', '성공'),
        ('ERROR', '실패'),
        ('PENDING', '대기중'),
    ]

    # 요청 정보
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        verbose_name="요청 사용자"
    )
    # 어떤 인플루언서의 목소리를 사용했는지 (influencers 앱의 모델과 연결)
    influencer = models.ForeignKey(
        'influencers.Influencer', 
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="대상 인플루언서"
    )
    request_text = models.TextField(verbose_name="요청 텍스트")
    
    # TTS 설정 정보 (JSON 형태로 당시의 모든 설정을 저장)
    tts_settings_snapshot = models.JSONField(
        default=dict, 
        verbose_name="TTS 설정 스냅샷"
    )

    # 결과 정보
    status = models.CharField(
        max_length=10, 
        choices=STATUS_CHOICES, 
        default='PENDING',
        verbose_name="처리 상태"
    )
    error_message = models.TextField(
        null=True, 
        blank=True, 
        verbose_name="에러 메시지"
    )
    latency_ms = models.PositiveIntegerField(
        null=True, 
        blank=True, 
        verbose_name="처리 시간 (ms)"
    )
    
    # 생성된 오디오 파일 경로 (선택 사항)
    audio_file_path = models.CharField(
        max_length=512, 
        null=True, 
        blank=True, 
        verbose_name="오디오 파일 경로"
    )

    # 타임스탬프
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="요청 시간")

    def __str__(self):
        return f"TTS Log for {self.user} at {self.created_at.strftime('%Y-%m-%d %H:%M')}"

    class Meta:
        verbose_name = "TTS 디버그 로그"
        verbose_name_plural = "TTS 디버그 로그"
        ordering = ['-created_at']
