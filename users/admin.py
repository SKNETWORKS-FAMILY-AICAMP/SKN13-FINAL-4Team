from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    """
    커스텀 유저 어드민
    """
    # 관리자 페이지 목록에 보여줄 필드 설정
    list_display = ('username', 'email', 'nickname', 'is_staff')

    # UserAdmin에 기본적으로 정의된 fieldsets에 새로운 필드(nickname)를 추가
    # fieldsets는 관리자 페이지에서 유저를 추가하거나 수정할 때 보여주는 입력 폼 그룹입니다.
    fieldsets = UserAdmin.fieldsets + (
        ('추가 정보', {'fields': ('nickname', 'profile_image')}),
    )
    # add_fieldsets는 유저를 새로 생성할 때 보여주는 폼입니다.
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('추가 정보', {'fields': ('nickname', 'profile_image')}),
    )