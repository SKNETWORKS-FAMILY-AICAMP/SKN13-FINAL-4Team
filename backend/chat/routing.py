# chat/routing.py

from django.urls import re_path
from . import websocket_streaming_handler

websocket_urlpatterns = [
    re_path(r'ws/stream/(?P<room_id>\d+)/$', websocket_streaming_handler.StreamingChatConsumer.as_asgi()),
]