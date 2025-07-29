# chat/routing.py
# chat app의 routing 역할을 하기위한 파일입니다.
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # ws/chat/방이름/ 형태의 WebSocket 요청을 ChatConsumer가 처리
    re_path(r'ws/chat/(?P<room_name>\w+)/$', consumers.ChatConsumer.as_asgi()),
]