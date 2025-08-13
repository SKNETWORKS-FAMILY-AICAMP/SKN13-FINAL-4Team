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