import os
from django.db import models
from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.utils import timezone

def user_profile_image_path(instance, filename):
    """
    업로드된 프로필 이미지의 저장 경로와 파일명을 결정합니다.
    파일명은 '유저이름.확장자' 형식으로 저장됩니다.
    """
    # 파일 확장자 추출 (예: .jpg, .png)
    print("--- user_profile_image_path 함수 호출됨 ---")
    print(f"사용자 인스턴스: {instance}")
    print(f"원본 파일명: {filename}")
    # ------------------------------------

    extension = os.path.splitext(filename)[1]
    new_filename = f'profile_pics/{instance.username}{extension}'
    
    print(f"새로운 파일 경로: {new_filename}")
    return new_filename

class User(AbstractUser):
    """
    커스텀 유저 모델
    
    AbstractUser를 상속받아 Django의 기본 필드를 모두 포함하며,
    필요에 따라 추가 필드를 정의할 수 있습니다.
    """
    username = models.CharField(
        max_length=150,
        unique=True,
        verbose_name='ID'  # 표시되는 이름을 'ID'로 설정
    )
    nickname = models.CharField(max_length=50, blank=True, null=True, unique=True, verbose_name='닉네임')
    profile_image = models.ImageField(
        upload_to=user_profile_image_path,
        null=True, 
        blank=True, 
        verbose_name='프로필 사진'
    )
    # 예: email 필드를 필수 항목이자 고유 값으로 설정
    email = models.EmailField(unique=True, verbose_name='이메일 주소')

    def __str__(self):
        return self.username
    
    sanctioned_until = models.DateTimeField(
        null=True,
        blank=True,
        help_text='이 필드에 미래의 날짜가 설정되면, 해당 날짜까지 사용자는 제재 상태입니다.'
    )

    @property
    def is_sanctioned(self):
        """
        현재 시간이 제재 만료일보다 이전이면 True(제재 상태)를 반환합니다.
        """
        if self.sanctioned_until and timezone.now() < self.sanctioned_until:
            return True
        return False

    # 기존 파일 삭제를 위한 save 메소드 오버라이드
    def save(self, *args, **kwargs):
        # 새로 생성되는 경우가 아닌, 기존 객체를 업데이트할 때만 실행
        if self.pk:
            try:
                # 데이터베이스에 저장된 기존 객체를 가져옴
                old_instance = User.objects.get(pk=self.pk)
                # 기존 객체에 이미지가 있고, 새로 업로드된 이미지가 다를 경우
                if old_instance.profile_image and old_instance.profile_image != self.profile_image:
                    # 기존 이미지가 디폴트 이미지가 아닐 경우에만 삭제
                    if 'default_profile.png' not in old_instance.profile_image.name:
                        old_instance.profile_image.delete(save=False)
            except User.DoesNotExist:
                pass # 객체가 아직 존재하지 않는 경우 (거의 발생하지 않음)

        # 부모 클래스의 save 메소드를 호출하여 최종 저장
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