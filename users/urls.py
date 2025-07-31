# users/urls.py

from django.urls import path
from .views import UserRegistrationAPIView # 이전 단계에서 만든 API 뷰
from .views import UserManagementAPIView # 유저 관리 API 뷰

urlpatterns = [
    # 최종 주소: /users/signup/
    path('signup/', UserRegistrationAPIView.as_view(), name='user-signup-api'),
    path('management/', UserManagementAPIView.as_view(), name='user-management-api'), # View 이름 변경
]