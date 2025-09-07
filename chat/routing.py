# chat/routing.py

from django.urls import re_path
from . import websocket_streaming_handler

websocket_urlpatterns = [
    # 🔽 이 부분의 room_id를 streamer_id로 변경합니다.
    re_path(r'ws/stream/(?P<streamer_id>\w+)/$', websocket_streaming_handler.StreamingChatConsumer.as_asgi()),
]