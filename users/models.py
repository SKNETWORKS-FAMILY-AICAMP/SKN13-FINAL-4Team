from django.db import models
from django.contrib.auth.models import AbstractUser

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
    # CharField, TextField 등 원하는 추가 필드를 여기에 정의합니다.
    # 예: nickname, profile_image 등
    nickname = models.CharField(max_length=50, blank=True, null=True, unique=True, verbose_name='닉네임')
    profile_image = models.ImageField(upload_to='profile_pics/', null=True, blank=True, verbose_name='프로필 사진')

    # AbstractUser의 일부 필드 속성을 변경할 수도 있습니다.
    # 예: email 필드를 필수 항목이자 고유 값으로 설정
    email = models.EmailField(unique=True, verbose_name='이메일 주소')

    def __str__(self):
        return self.username