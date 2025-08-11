# chat/urls.py
from django.urls import path
from . import api_views, status_views

app_name = 'chat'

urlpatterns = [
    path('api/ai/chat/', api_views.ai_chat_api, name='ai_chat'),
    path('api/ai/tts/', api_views.tts_api, name='tts'),
    path('api/ai/tts/status/', status_views.tts_status_api, name='tts_status'),
]