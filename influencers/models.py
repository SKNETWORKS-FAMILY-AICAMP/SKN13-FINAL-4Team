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