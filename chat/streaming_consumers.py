import json
import asyncio
import time
import logging
from urllib.parse import parse_qs
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

# --- ▼▼▼ 수정된 부분 시작 ▼▼▼ ---
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from users.models import User 
# --- ▲▲▲ 수정된 부분 끝 ▲▲▲ ---

from .ai_service import ai_service

logger = logging.getLogger(__name__)

# --- ▼▼▼ 수정된 부분 시작 ▼▼▼ ---
@database_sync_to_async
def get_user_from_token(token_key):
    """
    비동기 환경에서 JWT 토큰을 안전하게 검증하고 사용자를 가져옵니다.
    """
    if not token_key:
        return AnonymousUser()
    try:
        # AccessToken 객체를 사용하여 토큰의 유효기간, 서명 등을 모두 검증합니다.
        token = AccessToken(token_key)
        user_id = token.get('user_id')
        return User.objects.get(id=user_id)
    except (InvalidToken, TokenError, User.DoesNotExist):
        # 토큰이 유효하지 않거나 사용자가 존재하지 않으면 익명 사용자를 반환합니다.
        return AnonymousUser()
# --- ▲▲▲ 수정된 부분 끝 ▲▲▲ ---


class StreamingChatConsumer(AsyncWebsocketConsumer):
    """
    스트리밍 페이지 전용 채팅 컨슈머
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.ai_response_queue = []
        self.last_ai_response_time = 0
        self.AI_RESPONSE_COOLDOWN = 3

    @database_sync_to_async
    def get_streamer_tts_settings(self, streamer_id):
        """스트리머 TTS 설정 조회"""
        try:
            from .models import StreamerTTSSettings
            settings, created = StreamerTTSSettings.get_or_create_for_streamer(streamer_id)
            return settings.to_dict()
        except Exception as e:
            logger.warning(f"TTS 설정 조회 실패: {e}")
            return None

    async def connect(self):
        self.streamer_id = self.scope['url_route']['kwargs']['streamer_id']
        self.room_group_name = f'streaming_chat_{self.streamer_id}'
        
        logger.info(f"스트리밍 채팅 연결 시도: {self.streamer_id}")
        
        # --- ▼▼▼ 수정된 부분 시작 ▼▼▼ ---
        # 쿼리 문자열에서 토큰을 추출합니다.
        query_string = self.scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)
        token = query_params.get('token', [None])[0]

        # 새로운 인증 함수를 사용하여 사용자를 인증합니다.
        user = await get_user_from_token(token)
        # --- ▲▲▲ 수정된 부분 끝 ▲▲▲ ---

        if isinstance(user, AnonymousUser):
            logger.warning(f"미인증 사용자의 채팅 연결 시도 거부: {self.streamer_id}")
            await self.close(code=4001)  # 인증 실패 코드
            return
        
        self.user = user
        
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        logger.info(f"스트리밍 채팅 연결 성공: {user.username} → {self.streamer_id}")
        
        # 현재 TTS 설정을 새로 접속한 클라이언트에게 전송
        tts_settings = await self.get_streamer_tts_settings(self.streamer_id)
        if tts_settings:
            await self.send(text_data=json.dumps({
                'type': 'initial_tts_settings',
                'settings': tts_settings,
            }))
        
        # 입장 알림 메시지
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'system_message',
                'message': f'{user.username}님이 채팅에 참여했습니다.',
            }
        )

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
            
            if hasattr(self, 'user'):
                logger.info(f"스트리밍 채팅 연결 종료: {self.user.username} → {self.streamer_id}")
                
                # 퇴장 알림 메시지
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'system_message',
                        'message': f'{self.user.username}님이 채팅을 떠났습니다.',
                    }
                )

    async def receive(self, text_data):
        """사용자로부터 메시지 수신"""
        try:
            data = json.loads(text_data)
            message = data.get('message', '').strip()
            
            if not message:
                return
                
            logger.info(f"스트리밍 채팅 메시지: {self.user.username} → {message[:50]}...")
            
            # 사용자 메시지를 모든 클라이언트에게 브로드캐스트
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': message,
                    'sender': self.user.username,
                    'user_id': self.user.id,
                }
            )
            
            # AI 응답이 필요한 메시지인지 확인
            if message.startswith('@'):
                clean_message = message[1:].strip()
                await self.process_ai_response(clean_message)
                
        except Exception as e:
            logger.error(f"메시지 처리 오류: {e}")

    async def process_ai_response(self, clean_message):
        """AI 응답 처리"""
        current_time = time.time()
        if current_time - self.last_ai_response_time < self.AI_RESPONSE_COOLDOWN:
            logger.info("AI 응답 쿨다운")
            return
            
        try:
            logger.info(f"AI 응답 생성 시작: {clean_message[:30]}...")
            
            system_prompt = f"당신은 '{self.streamer_id}' 스트리밍의 AI 어시스턴트입니다. 시청자의 질문에 2-3줄로 간결하고 친근하게 답하세요."
            conversation_history = [{"role": "system", "content": system_prompt}]
            
            ai_response = await ai_service.generate_response(clean_message, conversation_history)
            
            if ai_response:
                self.last_ai_response_time = time.time()
                current_tts_settings = await self.get_streamer_tts_settings(self.streamer_id)
                
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'ai_message',
                        'message': ai_response,
                        'tts_settings': current_tts_settings,
                    }
                )
                logger.info(f"AI 응답 완료: {len(ai_response)} 문자")
        except Exception as e:
            logger.error(f"AI 응답 생성 오류: {e}")

    # WebSocket 메시지 핸들러들
    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message'],
            'sender': event['sender'],
            'message_type': 'user',
            'timestamp': time.time()
        }))

    async def ai_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message'],
            'sender': 'AI_Assistant',
            'message_type': 'ai',
            'tts_settings': event.get('tts_settings'),
            'timestamp': time.time()
        }))

    async def system_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'system_message',
            'message': event['message'],
            'message_type': 'system',
            'timestamp': time.time()
        }))

    async def tts_settings_changed(self, event):
        await self.send(text_data=json.dumps({
            'type': 'tts_settings_changed',
            'settings': event['settings'],
            'changed_by': event['changed_by'],
            'timestamp': event['timestamp'],
        }))

    async def donation_message(self, event):
        """후원 메시지를 클라이언트에게 전송"""
        donation_data = event['data']
        await self.send(text_data=json.dumps({
            'type': 'donation_message',
            'username': donation_data['username'],
            'amount': donation_data['amount'],
            'message': donation_data['message'],
            'tts_enabled': donation_data['tts_enabled'],
            'timestamp': time.time()
        }))