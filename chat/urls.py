# chat/urls.py
from django.urls import path
from . import api_views

app_name = 'chat'

urlpatterns = [
    path('api/ai/chat/', api_views.ai_chat_api, name='ai_chat'),
    path('api/ai/tts/', api_views.tts_api, name='tts'),
]