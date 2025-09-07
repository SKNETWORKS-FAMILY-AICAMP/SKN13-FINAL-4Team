# websocket_streaming_handler.py 

import json
import asyncio
import time
import logging
from urllib.parse import parse_qs
import hashlib
import os
import requests
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.http import StreamingHttpResponse,HttpRequest
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.views import View
from django.test import RequestFactory

from users.models import User
from .models import ChatRoom, ChatMessage, StreamerTTSSettings

from .llm_text_service import ai_service
from .media_orchestrator import MediaProcessingHub
from .streaming.domain.stream_session import StreamSession
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

@database_sync_to_async
def get_user_from_token(token_key):
    if not token_key:
        return AnonymousUser()
    try:
        token = AccessToken(token_key)
        user_id = token.get('user_id')
        return User.objects.get(id=user_id)
    except (InvalidToken, TokenError, User.DoesNotExist):
        return AnonymousUser()


class StreamingChatConsumer(AsyncWebsocketConsumer):
    stream_sessions = {}
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.media_processor = MediaProcessingHub()
        self.request_processor_task = None
        self.response_processor_task = None

    @database_sync_to_async
    def save_message(self, user, message):
        try:
            room = ChatRoom.objects.get(name=self.streamer_id)
            ChatMessage.objects.create(room=room, sender=user, content=message)
            logger.info(f"💾 메시지 저장 완료: {user.username} -> room {self.streamer_id}")
        except ChatRoom.DoesNotExist:
            logger.error(f"❌ 메시지 저장 실패: ChatRoom(id={self.streamer_id})을 찾을 수 없습니다.")
        except Exception as e:
            logger.error(f"❌ 메시지 저장 중 알 수 없는 오류 발생: {e}")

    @database_sync_to_async
    def get_streamer_tts_settings(self, streamer_id):
        try:
            settings, created = StreamerTTSSettings.get_or_create_for_streamer(streamer_id)
            return settings.to_dict()
        except Exception as e:
            logger.warning(f"TTS 설정 조회 실패: {e}")
            return None

    async def connect(self):
        # URL에서 한글이 포함된 streamer_id를 가져옵니다.
        streamer_id_unicode = self.scope['url_route']['kwargs']['streamer_id']
        
        # 한글 ID를 ASCII 문자로 된 고유한 해시값으로 변환합니다.
        safe_streamer_id = hashlib.md5(streamer_id_unicode.encode('utf-8')).hexdigest()

        # 안전하게 변환된 ID로 채널 그룹 이름을 설정합니다.
        self.room_group_name = f'streaming_chat_{safe_streamer_id}'
        
        # 다른 로직에서는 원래의 한글 ID를 사용해야 하므로, self.streamer_id에는 원래 값을 유지합니다.
        self.streamer_id = streamer_id_unicode
        
        print(f"✅ WebSocket 연결 시도 감지! Group: {self.room_group_name}")

        query_string = self.scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)
        token = query_params.get('token', [None])[0]

        user = await get_user_from_token(token)
        print(f"✅ 사용자 인증 시도 완료. 유저: {user}")

        if isinstance(user, AnonymousUser):
            logger.warning(f"미인증 사용자의 연결 시도 거부: {self.streamer_id}")
            await self.close(code=4001)
            return
        
        self.user = user
        logger.info(f"🔐 사용자 인증 완료: {user.username}")
        
        if self.room_group_name not in StreamingChatConsumer.stream_sessions:
            logger.info(f"💡 새로운 StreamSession 생성: {self.room_group_name}")
            StreamingChatConsumer.stream_sessions[self.room_group_name] = StreamSession(session_id=self.room_group_name)
        self.session = StreamingChatConsumer.stream_sessions[self.room_group_name]
        
        if not self.request_processor_task or self.request_processor_task.done():
            self.request_processor_task = asyncio.create_task(self.process_request_queue())
        if not self.response_processor_task or self.response_processor_task.done():
            self.response_processor_task = asyncio.create_task(self.process_response_queue())
        
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        logger.info(f"✅ 스트리밍 채팅 연결 성공: {user.username} -> {self.streamer_id}")
        
        await self.send_initial_data()

        await self.channel_layer.group_send(
            self.room_group_name,
            {'type': 'system_message', 'message': f'{user.username}님이 채팅에 참여했습니다.'}
        )

    async def send_initial_data(self):
        """새로운 클라이언트에게 초기 데이터를 전송합니다."""
        tts_settings = await self.get_streamer_tts_settings(self.streamer_id)
        if tts_settings:
            await self.send(text_data=json.dumps({'type': 'initial_tts_settings', 'settings': tts_settings}))
        
        if hasattr(self, 'session') and self.session:
            await self.broadcast_queue_status()

    async def disconnect(self, close_code):
        if hasattr(self, 'request_processor_task') and self.request_processor_task:
            self.request_processor_task.cancel()
        if hasattr(self, 'response_processor_task') and self.response_processor_task:
            self.response_processor_task.cancel()
        
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
            if hasattr(self, 'user'):
                logger.info(f"🚫 스트리밍 채팅 연결 종료: {self.user.username}")
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {'type': 'system_message', 'message': f'{self.user.username}님이 채팅을 떠났습니다.'}
                )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get('type', 'chat_message')

        if message_type == 'chat_message':
            message = data.get('message', '').strip()
            if not message: return

            # 사용자 메시지 브로드캐스트
            await self.channel_layer.group_send(
                self.room_group_name,
                {'type': 'chat_message', 'message': message, 'sender': self.user.username}
            )

            # AI 에이전트에게 모든 메시지 전달 (백그라운드 작업으로)
            if self.agent:
                asyncio.create_task(self.agent.on_new_input_async({
                    "type": "normal",
                    "content": message,
                    "user_id": self.user.username,
                    "chat_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }))

    async def process_response_queue(self):
        try:
            logger.info(f"🎵 Response Queue Processor 시작...")
            async for media_packet in self.session.process_response_queue():
                if media_packet:
                    logger.info(f"▶️ MediaPacket 순차 재생: seq={media_packet.seq}")
                    await self.broadcast_mediapacket(media_packet)
                    await self.broadcast_queue_status()
        except asyncio.CancelledError:
            logger.info("🚫 Response Queue Processor가 정상적으로 취소되었습니다.")
        except Exception as e:
            logger.error(f"❌ Response Queue Processor 오류: {e}")

    async def broadcast_mediapacket(self, media_packet):
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'mediapacket_broadcast',
                'packet': media_packet.to_dict(),
            }
        )

    async def broadcast_queue_status(self):
        if not hasattr(self, 'session') or not self.session:
            return
        try:
            session_info = self.session.get_session_info()
            detailed_queue_info = self.session.get_detailed_queue_info()
            
            await self.channel_layer.group_send(
                self.room_group_name,
                {'type': 'queue_status_update', 'session_info': session_info}
            )
            await self.channel_layer.group_send(
                self.room_group_name,
                {'type': 'queue_debug_update', 'detailed_queue_info': detailed_queue_info}
            )
        except Exception as e:
            logger.error(f"❌ Queue 상태 브로드캐스트 실패: {e}")

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message'],
            'sender': event['sender'],
            'timestamp': time.time()
        }))

    async def system_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'system_message',
            'message': event['message'],
            'timestamp': time.time()
        }))

    async def tts_settings_changed(self, event):
        await self.send(text_data=json.dumps({
            'type': 'tts_settings_changed',
            'settings': event['settings'],
            'changed_by': event['changed_by'],
            'timestamp': event.get('timestamp', time.time()),
        }))
    
    async def mediapacket_broadcast(self, event):
        await self.send(text_data=json.dumps({
            'type': 'media_packet',
            'packet': event['packet'],
            'server_timestamp': time.time()
        }))
    
    async def queue_status_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'queue_status_update',
            'session_info': event['session_info'],
            'timestamp': time.time()
        }))
    
    async def queue_debug_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'queue_debug_update',
            'detailed_queue_info': event['detailed_queue_info'],
            'timestamp': time.time()
        }))

    async def donation_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'donation_message',
            'data': event['data'],
            'timestamp': time.time()
        }))

    async def process_llm_response(self, clean_message):
        try:
            # LLMView에 전달할 Mock HttpRequest 객체를 생성
            mock_request = HttpRequest()
            mock_request.method = 'POST'
            mock_request._body = json.dumps({'prompt': clean_message}).encode('utf-8')

            llm_view = LLMView()
            
            response = await asyncio.to_thread(llm_view.post, mock_request)

            if response.status_code == 200:
                full_response = ""
                for chunk in response.streaming_content:
                    chunk_str = chunk.decode('utf-8')
                    full_response += chunk_str
                    # 각 청크를 WebSocket을 통해 클라이언트로 즉시 전송
                    await self.send(text_data=json.dumps({
                        'type': 'llm_response_chunk',
                        'message': chunk_str,
                        'sender': 'AI',
                        'timestamp': time.time()
                    }))

                await self.save_message(self.user, f"AI response: {full_response}")
            else:
                logger.error(f"LLMView에서 오류를 반환했습니다: {response.content.decode('utf-8')}")
                # 오류 메시지 전송
        except Exception as e:
            logger.error(f"❌ AI 응답 처리 실패: {e}")
            # 오류 메시지 전송

@method_decorator(csrf_exempt, name="dispatch")
class LLMView(View):
    """FastAPI 서버로 프롬프트를 전달하고 스트리밍 응답을 클라이언트로 중계하는 뷰입니다."""

    def post(self, request):
        load_dotenv()
        FASTAPI_URL = os.getenv("FASTAPI_URL", "http://localhost:8001") 

        try:
            data = json.loads(request.body.decode())
            user_prompt = data.get("prompt", "안녕하세요!")

            def event_stream():
                with requests.post(f"{FASTAPI_URL}/stream-response/", json={"prompt": user_prompt}, stream=True) as r:
                    for chunk in r.iter_content(chunk_size=None, decode_unicode=True):
                        if chunk:
                            yield chunk

            return StreamingHttpResponse(event_stream(), content_type="text/event-stream")

        except Exception as e:
            return StreamingHttpResponse(f"에러 발생: {str(e)}", content_type="text/plain")