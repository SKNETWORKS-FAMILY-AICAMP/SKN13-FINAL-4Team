from django.db import models

class CoreValue(models.Model):
    value_name = models.CharField(max_length=100, unique=True, verbose_name="가치 이름")
    description = models.TextField(blank=True, verbose_name="설명")

    def __str__(self):
        return self.value_name

class Influencer(models.Model):
    GENDER_CHOICES = [
        ('남', '남성'),
        ('여', '여성'),
    ]
    name = models.CharField(max_length=50, verbose_name="실제 이름")
    age = models.PositiveIntegerField(verbose_name="나이")
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, verbose_name="성별")
    mbti = models.CharField(max_length=10, blank=True, verbose_name="MBTI")
    job = models.TextField(verbose_name="현재 직업")
    social_status = models.TextField(blank=True, verbose_name="사회적 지위")
    audience_term = models.CharField(max_length=50, blank=True, verbose_name="시청자 호칭")
    origin_story = models.TextField(blank=True, verbose_name="기원 스토리")
    profile_image = models.ImageField(upload_to='profiles/', blank=True, null=True, verbose_name="프로필 이미지")
    
    # 다대다 관계 설정
    core_values = models.ManyToManyField(
        CoreValue, 
        through='InfluencerCoreValue', 
        related_name='influencers',
        verbose_name="핵심 가치"
    )

    def __str__(self):
        return self.name

class InfluencerCoreValue(models.Model):
    influencer = models.ForeignKey(Influencer, on_delete=models.CASCADE)
    value = models.ForeignKey(CoreValue, on_delete=models.CASCADE)
    priority = models.PositiveIntegerField(default=99, help_text="낮을수록 우선순위가 높음 (Top 3)")

    class Meta:
        unique_together = ('influencer', 'value')
        ordering = ['influencer', 'priority']

class CommunicationStyle(models.Model):
    # 일대일 관계 설정
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
