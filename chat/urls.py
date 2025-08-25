# chat/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import api_views, status_views, views

app_name = 'chat'

# 1. 라우터 생성
router = DefaultRouter()
# 2. 'rooms' 경로에 ChatRoomViewSet을 등록 (URL 자동 생성)
router.register(r'rooms', views.ChatRoomViewSet, basename='chatroom')

urlpatterns = [
    # 3. 라우터가 생성한 URL들을 urlpatterns에 포함
    path('', include(router.urls)),

    path('ai/chat/', api_views.ai_chat_api, name='ai_chat'),
    path('ai/tts/', api_views.tts_api, name='tts'),
    path('ai/tts/status/', status_views.tts_status_api, name='tts_status'),
    
    path('streamer/<str:streamer_id>/tts/settings/', views.get_streamer_tts_settings, name='get_tts_settings'),
    path('streamer/<str:streamer_id>/tts/settings/update/', views.update_streamer_tts_settings, name='update_tts_settings'),
    path('admin/tts/settings/', views.list_all_tts_settings, name='list_all_tts_settings'),
]