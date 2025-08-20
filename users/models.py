import os
from django.db import models
from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.utils import timezone

def user_profile_image_path(instance, filename):
    # ... (기존과 동일)
    extension = os.path.splitext(filename)[1]
    new_filename = f'profile_pics/{instance.username}{extension}'
    return new_filename

class User(AbstractUser):
    # [추가] 성별 선택을 위한 CHOICES 정의
    GENDER_CHOICES = (
        ('M', '남성'),
        ('F', '여성'),
    )

    username = models.CharField(
        max_length=150,
        unique=True,
        verbose_name='ID'
    )
    nickname = models.CharField(max_length=50, blank=True, null=True, unique=True, verbose_name='닉네임')
    profile_image = models.ImageField(
        upload_to=user_profile_image_path,
        null=True,
        blank=True,
        verbose_name='프로필 사진'
    )
    email = models.EmailField(unique=True, verbose_name='이메일 주소')
    
    # [추가] 성별 필드
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, blank=True, verbose_name='성별', default='M')
    
    # [추가] 생년월일 필드
    birth_date = models.DateField(verbose_name='생년월일', default='2000-01-01')

    sanctioned_until = models.DateTimeField(
        null=True,
        blank=True,
        help_text='이 필드에 미래의 날짜가 설정되면, 해당 날짜까지 사용자는 제재 상태입니다.'
    )

    @property
    def is_sanctioned(self):
        if self.sanctioned_until and timezone.now() < self.sanctioned_until:
            return True
        return False

    def save(self, *args, **kwargs):
        if self.pk:
            try:
                old_instance = User.objects.get(pk=self.pk)
                if old_instance.profile_image and old_instance.profile_image != self.profile_image:
                    if 'default_profile.png' not in old_instance.profile_image.name:
                        old_instance.profile_image.delete(save=False)
            except User.DoesNotExist:
                pass
        super(User, self).save(*args, **kwargs)


class UserWallet(models.Model):
    """
    사용자의 현재 캐시(포인트) 잔액을 관리하는 지갑 모델
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name='wallet',
        help_text='지갑의 소유자'
    )
    balance = models.IntegerField(
        default=0,
        help_text='현재 보유 캐시 잔액'
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text='마지막 잔액 변동 시간'
    )

    def __str__(self):
        return f"{self.user.username}'s Wallet (Balance: {self.balance})"



class CashLog(models.Model):
    """
    사용자의 모든 캐시 충전 및 사용 내역을 기록하는 로그 모델
    """
    LOG_TYPE_CHOICES = (
        ('charge', '충전'),
        ('use', '사용'),
    )

    wallet = models.ForeignKey(
        UserWallet,
        on_delete=models.PROTECT, # 지갑이 삭제되어도 로그는 보존
        related_name='logs',
        help_text='관련된 사용자 지갑'
    )
    log_type = models.CharField(
        max_length=10,
        choices=LOG_TYPE_CHOICES,
        help_text='로그 종류 (충전/사용)'
    )
    amount = models.IntegerField(
        help_text='변동된 캐시 양 (충전: 양수, 사용: 음수)'
    )
    description = models.CharField(
        max_length=255,
        blank=True,
        help_text='거래에 대한 간단한 설명 (예: AI 상담, 이벤트 보상)'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text='로그 생성 시간'
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.get_log_type_display()}] {self.wallet.user.username} - Amount: {self.amount}"
