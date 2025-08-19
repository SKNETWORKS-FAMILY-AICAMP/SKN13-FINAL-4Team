# chat/urls.py
from django.urls import path
from . import api_views, status_views, views

app_name = 'chat'

urlpatterns = [
    path('ai/chat/', api_views.ai_chat_api, name='ai_chat'),
    path('ai/tts/', api_views.tts_api, name='tts'),
    path('ai/tts/status/', status_views.tts_status_api, name='tts_status'),
    
    path('streamer/<str:streamer_id>/tts/settings/', views.get_streamer_tts_settings, name='get_tts_settings'),
    path('streamer/<str:streamer_id>/tts/settings/update/', views.update_streamer_tts_settings, name='update_tts_settings'),
    path('admin/tts/settings/', views.list_all_tts_settings, name='list_all_tts_settings'),

    # 1. 채팅방 목록 조회(GET) 및 생성(POST)을 위한 URL
    path('rooms/', views.ChatRoomViewSet.as_view({
        'get': 'list',
        'post': 'create'
    }), name='chatroom-list'),

    # 2. 특정 채팅방 상세 조회(GET), 수정(PUT/PATCH), 삭제(DELETE)를 위한 URL
    path('rooms/<int:pk>/', views.ChatRoomViewSet.as_view({
        'get': 'retrieve',
        'put': 'update',
        'patch': 'partial_update',
        'delete': 'destroy'
    }), name='chatroom-detail'),
]