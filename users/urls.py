# users/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter 
from .views import (
    UserRegistrationAPIView, 
    MyProfileAPIView,
    UserAdminViewSet 
)

router = DefaultRouter()
router.register('admin/users', UserAdminViewSet, basename='user-admin')

urlpatterns = [
    path('signup/', UserRegistrationAPIView.as_view(), name='user-signup-api'),
    path('me/', MyProfileAPIView.as_view(), name='user-profile-api'),
    path('', include(router.urls)),
]