from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TTSLogViewSet

# DRF의 DefaultRouter를 사용하여 ViewSet에 대한 URL을 자동으로 생성합니다.
router = DefaultRouter()
router.register('', TTSLogViewSet, basename='ttslog')

# 최종 URL 패턴
urlpatterns = [
    path('', include(router.urls)),
]
