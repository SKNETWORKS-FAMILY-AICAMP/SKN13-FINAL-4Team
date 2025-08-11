import os
from django.db import models
from django.contrib.auth.models import AbstractUser


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
    # CharField, TextField 등 원하는 추가 필드를 여기에 정의합니다.
    # 예: nickname, profile_image 등
    nickname = models.CharField(max_length=50, blank=True, null=True, unique=True, verbose_name='닉네임')
    profile_image = models.ImageField(
        upload_to=user_profile_image_path,
        null=True, 
        blank=True, 
        verbose_name='프로필 사진'
    )
    # AbstractUser의 일부 필드 속성을 변경할 수도 있습니다.
    # 예: email 필드를 필수 항목이자 고유 값으로 설정
    email = models.EmailField(unique=True, verbose_name='이메일 주소')

    def __str__(self):
        return self.username
    
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