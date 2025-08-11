# users/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
# ↓↓↓ 추가할 뷰와 라이브러리 임포트 ↓↓↓
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    UserRegistrationAPIView,
    MyProfileAPIView,
    UserAdminViewSet,
    CustomTokenObtainPairView,
    NicknameCheckAPIView, 
    UsernameCheckAPIView,
    PasswordChangeAPIView,
    MyTokenObtainPairView
)

router = DefaultRouter()
router.register('management', UserAdminViewSet, basename='user-admin')

urlpatterns = [
    path('signup/', UserRegistrationAPIView.as_view(), name='user-signup-api'),
    path('me/', MyProfileAPIView.as_view(), name='user-profile-api'),
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('check-nickname/', NicknameCheckAPIView.as_view(), name='check-nickname-api'),
    path('check-username/', UsernameCheckAPIView.as_view(), name='check-username-api'),
    path('change-password/', PasswordChangeAPIView.as_view(), name='change-password-api'),
    path('upload-image/', MyProfileAPIView.as_view(), name='upload-image-api'),
    path('api/token/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),

    path('', include(router.urls)),
]