# chat/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer

class ChatConsumer(AsyncWebsocketConsumer):
    """
    ChatConsumer는 채팅 애플리케이션의 WebSocket 연결을 처리합니다.
    사용자가 채팅방에 참여하고, 메시지를 보내고, 같은 방에 있는 다른 사용자와 메시지를 받을 수 있도록 합니다.
    """
    async def connect(self):
        # URL 파라미터에서 방 이름을 가져옵니다.
        self.room_name = self.scope['url_route']['kwargs']['room_name']
        self.room_group_name = f'chat_{self.room_name}'

        # 그룹에 join
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        # 그룹에서 leave
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    # React로부터 메시지를 수신했을 때
    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        message = text_data_json['message']

        # 그룹 내 모든 클라이언트에게 메시지 전송
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': message
            }
        )

    # group_send 로부터 메시지를 수신했을 때
    async def chat_message(self, event):
        message = event['message']
        # React로 메시지 전송
        await self.send(text_data=json.dumps({
            'message': message
        }))