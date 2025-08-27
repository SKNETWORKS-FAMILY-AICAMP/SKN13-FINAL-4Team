# chat/routing.py
# chat app의 WebSocket routing
from django.urls import re_path
from . import streaming_consumers

websocket_urlpatterns = [
    # ws/stream/스트리머ID/ 형태의 WebSocket 요청을 StreamingChatConsumer가 처리 (스트리밍 채팅)
    re_path(r'ws/stream/(?P<streamer_id>[\w-]+)/$', streaming_consumers.StreamingChatConsumer.as_asgi()),
]