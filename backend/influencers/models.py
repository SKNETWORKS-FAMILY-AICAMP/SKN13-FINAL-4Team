import os
from django.db import models
from django.conf import settings

# --- Helper Functions ---
# 헬퍼 함수를 모델보다 먼저 정의하여 모델 필드에서 사용
def influencer_profile_image_path(instance, filename):
    extension = os.path.splitext(filename)[1]
    return f'influencer_profiles/{instance.id}_{instance.name}{extension}'

def influencer_banner_image_path(instance, filename):
    extension = os.path.splitext(filename)[1]
    return f'influencer_banners/{instance.id}_{instance.name}{extension}'


# --- Core Models ---

class CoreValue(models.Model):
    """인플루언서의 핵심 가치를 정의하는 모델"""
    value_name = models.CharField(max_length=100, unique=True, verbose_name="가치 이름")
    description = models.TextField(blank=True, verbose_name="설명")

    def __str__(self):
        return self.value_name

class Influencer(models.Model):
    """인플루언서의 기본 정보 및 방송 관련 정보를 담는 핵심 모델"""
    GENDER_CHOICES = [
        ('남', '남성'),
        ('여', '여성'),
    ]
    
    name = models.CharField(
        max_length=50, 
        unique=True,
        verbose_name="활동명",
        help_text="방송에서 사용할 인플루언서의 이름입니다."
    )
    
    age = models.PositiveIntegerField(verbose_name="나이")
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, verbose_name="성별")
    mbti = models.CharField(max_length=10, blank=True, verbose_name="MBTI")
    job = models.TextField(verbose_name="현재 직업")
    audience_term = models.CharField(max_length=50, blank=True, verbose_name="시청자 호칭")
    origin_story = models.TextField(blank=True, verbose_name="기원 스토리")
    
    profile_image = models.ImageField(
        upload_to=influencer_profile_image_path, 
        blank=True, 
        null=True, 
        verbose_name="프로필 이미지"
    )
    banner_image = models.ImageField(
        upload_to=influencer_banner_image_path, 
        blank=True, 
        null=True, 
        verbose_name="배너 이미지"
    )
    like_count = models.PositiveIntegerField(default=0, verbose_name="좋아요 수")
    is_active = models.BooleanField(default=True, verbose_name="활성 상태", help_text="체크 해제 시 사용자에게 노출되지 않습니다.")

    core_values = models.ManyToManyField(
        CoreValue, 
        through='InfluencerCoreValue', 
        related_name='influencers',
        verbose_name="핵심 가치"
    )

    def __str__(self):
        return self.name


# --- Influencer 상세 정보 모델 (One-to-One) ---

class InfluencerCoreValue(models.Model):
    """Influencer와 CoreValue의 중간 테이블 (우선순위 포함)"""
    influencer = models.ForeignKey(Influencer, on_delete=models.CASCADE)
    value = models.ForeignKey(CoreValue, on_delete=models.CASCADE)
    priority = models.PositiveIntegerField(default=99, help_text="낮을수록 우선순위가 높음 (Top 3)")

    class Meta:
        unique_together = ('influencer', 'value')
        ordering = ['influencer', 'priority']

class CommunicationStyle(models.Model):
    """인플루언서의 의사소통 스타일 모델"""
    influencer = models.OneToOneField(
        Influencer, 
        on_delete=models.CASCADE, 
        primary_key=True,
        related_name='communication_style'
    )
    tone = models.TextField(blank=True, verbose_name="어조")
    sentence_length = models.TextField(blank=True, verbose_name="문장 길이")
    question_style = models.TextField(blank=True, verbose_name="질문 습관")
    directness = models.PositiveIntegerField(help_text="1~5점 척도", blank=True, null=True, verbose_name="직설성")
    empathy_expression = models.TextField(blank=True, verbose_name="공감 표현 방식")

    def __str__(self):
        return f"{self.influencer.name}의 의사소통 스타일"

class PersonalityTrait(models.Model):
    """인플루언서의 성격 기질 모델"""
    influencer = models.OneToOneField(
        Influencer,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name='personality_trait'
    )
    energy_direction = models.TextField(blank=True, verbose_name="에너지 방향")
    emotional_processing = models.TextField(blank=True, verbose_name="감정 처리")
    judgment_decision = models.TextField(blank=True, verbose_name="판단·결정")
    interpersonal_attitude = models.TextField(blank=True, verbose_name="대인 태도")
    openness = models.TextField(blank=True, verbose_name="개방성")
    conscientiousness = models.TextField(blank=True, verbose_name="성실성")
    emotional_stability = models.TextField(blank=True, verbose_name="감정 안정성")
    social_sensitivity = models.TextField(blank=True, verbose_name="사회적 민감성")
    risk_preference = models.TextField(blank=True, verbose_name="위험 선호")
    time_orientation = models.TextField(blank=True, verbose_name="시간 지향성")

    def __str__(self):
        return f"{self.influencer.name}의 성격 기질"

class MoralCompass(models.Model):
    """인플루언서의 도덕·윤리 좌표 모델"""
    influencer = models.OneToOneField(
        Influencer,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name='moral_compass'
    )
    standard = models.TextField(blank=True, verbose_name="기준")
    rule_adherence = models.TextField(blank=True, verbose_name="규칙 준수")
    fairness = models.TextField(blank=True, verbose_name="공정성")

    def __str__(self):
        return f"{self.influencer.name}의 도덕·윤리 좌표"


# --- 아래부터 방송국 기능 모델 (Foreign Key) ---

class Story(models.Model):
    """사연 게시판 모델"""
    influencer = models.ForeignKey(Influencer, on_delete=models.CASCADE, related_name='stories', verbose_name="대상 인플루언서")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='stories', verbose_name="작성자", help_text="비회원은 null, 탈퇴한 회원의 글은 유지됩니다.")
    title = models.CharField(max_length=200, verbose_name="제목")
    content = models.TextField(verbose_name="내용")
    is_anonymous = models.BooleanField(default=True, verbose_name="익명 여부")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="작성일")
    relationship_stage = models.CharField(max_length=50, blank=True, verbose_name="관계 단계")
    nickname = models.CharField(max_length=50, blank=True, verbose_name="닉네임")

    class Meta:
        ordering = ['-created_at']
        verbose_name = "사연"
        verbose_name_plural = "사연 게시판"

    def __str__(self):
        return f"[{self.influencer.name}] {self.title}"

class Donation(models.Model):
    """후원(열혈순위) 모델"""
    influencer = models.ForeignKey(Influencer, on_delete=models.CASCADE, related_name='donations', verbose_name="후원받은 인플루언서")
    donor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='donations', verbose_name="후원자")
    amount = models.PositiveIntegerField(verbose_name="후원액 (크레딧)")
    donated_at = models.DateTimeField(auto_now_add=True, verbose_name="후원일")

    class Meta:
        ordering = ['-donated_at']
        verbose_name = "후원 내역"
        verbose_name_plural = "후원 내역 목록"
        
    def __str__(self):
        donor_name = self.donor.username if self.donor else "익명"
        return f"{donor_name} -> {self.influencer.name}: {self.amount}C"


class Like(models.Model):
    """좋아요 모델"""
    influencer = models.ForeignKey(Influencer, on_delete=models.CASCADE, related_name='likes', verbose_name="인플루언서")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='likes', verbose_name="사용자")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('influencer', 'user')
        verbose_name = "좋아요"
        verbose_name_plural = "좋아요 목록"

    def __str__(self):
        return f"{self.user.username} likes {self.influencer.name}"


class InfluencerTTSSettings(models.Model):
    """
    인플루언서별 TTS 설정 모델
    StreamerTTSSettings에서 이동 및 통합
    """
    influencer = models.OneToOneField(
        Influencer,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name='tts_settings',
        help_text='TTS 설정이 적용될 인플루언서'
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
    elevenlabs_voice_name = models.CharField(
        max_length=100,
        default='안은진',
        blank=True,
        help_text='ElevenLabs 음성 이름 (표시용)'
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
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text='마지막 설정 변경자'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Influencer TTS Setting'
        verbose_name_plural = 'Influencer TTS Settings'
        ordering = ['influencer__name']
    
    def __str__(self):
        return f"{self.influencer.name} TTS Settings ({self.tts_engine})"
    
    def to_dict(self):
        """TTS 설정을 딕셔너리로 변환 (프론트엔드 전송용)"""
        return {
            'influencer_id': self.influencer.id,
            'influencer_name': self.influencer.name,
            'ttsEngine': self.tts_engine,
            'elevenLabsVoice': self.elevenlabs_voice,
            'elevenLabsVoiceName': self.elevenlabs_voice_name,
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
    def get_or_create_for_influencer(cls, influencer):
        """인플루언서로 설정을 가져오거나 기본값으로 생성"""
        settings, created = cls.objects.get_or_create(
            influencer=influencer,
            defaults={
                'tts_engine': 'elevenlabs',
                'elevenlabs_voice': 'aneunjin',
                'elevenlabs_voice_name': '안은진',
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