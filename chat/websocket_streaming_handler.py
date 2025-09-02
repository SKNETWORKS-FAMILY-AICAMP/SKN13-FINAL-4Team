# backend/chat/websocket_streaming_handler.py
import json
import asyncio
import time
import logging
from urllib.parse import parse_qs
from datetime import datetime

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from users.models import User

from . import agent_manager
from .agent.agent import LoveStreamerAgent
from .agent.story import DjangoStoryRepository, DjangoChatRepository
from .streaming.domain.stream_session import StreamSession
from .media_orchestrator import MediaProcessingHub

logger = logging.getLogger(__name__)

@database_sync_to_async
def get_user_from_token(token_key):
    if not token_key: return AnonymousUser()
    try:
        token = AccessToken(token_key)
        user_id = token.get('user_id')
        return User.objects.get(id=user_id)
    except (InvalidToken, TokenError, User.DoesNotExist):
        return AnonymousUser()

class StreamingChatConsumer(AsyncWebsocketConsumer):
    """
    AI Streamer Agent와 통합된 스트리밍 채팅 컨슈머
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.agent: Optional[LoveStreamerAgent] = None
        self.session: Optional[StreamSession] = None
        self.media_processor: Optional[MediaProcessingHub] = None
        self.response_processor_task: Optional[asyncio.Task] = None

    async def connect(self):
        self.streamer_id = self.scope['url_route']['kwargs']['streamer_id']
        self.room_group_name = f'streaming_chat_{self.streamer_id}'

        query_string = self.scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)
        token = query_params.get('token', [None])[0]
        user = await get_user_from_token(token)

        if isinstance(user, AnonymousUser):
            await self.close(code=4001)
            return
        
        self.user = user

        # --- Agent & Session 초기화 ---
        if self.streamer_id not in agent_manager.active_agents:
            story_repo = DjangoStoryRepository()
            chat_repo = DjangoChatRepository()
            agent_manager.active_agents[self.streamer_id] = LoveStreamerAgent(
                api_key=settings.OPENAI_API_KEY,
                story_repo=story_repo,
                chat_repo=chat_repo
            )
            agent_manager.connection_counts[self.streamer_id] = 0
            
            # StreamSession (송출 큐) 생성 및 연결
            session = StreamSession(session_id=self.room_group_name)
            media_processor = MediaProcessingHub()
            
            # Responder와 MediaProcessingHub 연결
            agent_manager.active_agents[self.streamer_id].responder.media_processor = media_processor
            agent_manager.active_agents[self.streamer_id].responder.stream_session = session
            
            # IdleManager의 자율 행동 루프 시작
            asyncio.create_task(agent_manager.active_agents[self.streamer_id].idle.idle_loop())
            # 슈퍼챗 워커 시작
            asyncio.create_task(agent_manager.active_agents[self.streamer_id].superchat_worker_coro())

        self.agent = agent_manager.active_agents[self.streamer_id]
        self.session = self.agent.responder.stream_session
        
        # Response Queue 처리 태스크 시작 (세션마다 하나씩)
        if not self.session.response_processor_task or self.session.response_processor_task.done():
            self.session.response_processor_task = asyncio.create_task(self.process_response_queue())

        agent_manager.connection_counts[self.streamer_id] += 1

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        # --- 초기 정보 전송 및 입장 알림 ---
        # (기존 코드: tts_settings, queue_status 등 전송 로직 추가 가능)
        await self.channel_layer.group_send(
            self.room_group_name,
            {'type': 'system_message', 'message': f'{self.user.username}님이 채팅에 참여했습니다.'}
        )
        logger.info(f"User {self.user.username} connected to room {self.streamer_id}. Total connections: {agent_manager.connection_counts[self.streamer_id]}")

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
            
            if self.streamer_id in agent_manager.connection_counts:
                agent_manager.connection_counts[self.streamer_id] -= 1
                connections = agent_manager.connection_counts[self.streamer_id]
                logger.info(f"User {self.user.username} disconnected. Remaining connections for {self.streamer_id}: {connections}")

                if connections == 0:
                    # 마지막 클라이언트 퇴장 시 에이전트 및 세션 정리
                    if self.streamer_id in agent_manager.active_agents:
                        del agent_manager.active_agents[self.streamer_id]
                    del agent_manager.connection_counts[self.streamer_id]
                    if self.session and self.session.response_processor_task:
                        self.session.response_processor_task.cancel()
                    logger.info(f"Agent for {self.streamer_id} has been shut down.")

            if hasattr(self, 'user'):
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {'type': 'system_message', 'message': f'{self.user.username}님이 채팅을 떠났습니다.'}
                )

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get('type')

        if message_type == 'playback_completed' and self.session:
            self.session.mark_playback_completed(data.get('seq'))
            return

        if message_type == 'chat_message':
            message = data.get('message', '').strip()
            if not message: return

            # 사용자 메시지 브로드캐스트
            await self.channel_layer.group_send(
                self.room_group_name,
                {'type': 'chat_message', 'message': message, 'sender': self.user.username}
            )

            # AI 에이전트에게 모든 메시지 전달
            if self.agent:
                await self.agent.on_new_input_async({
                    "type": "normal",
                    "content": message,
                    "user_id": self.user.username,
                    "chat_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                })

    async def process_response_queue(self):
        """Response Queue를 처리하여 MediaPacket을 모든 클라이언트에게 브로드캐스트"""
        if not self.session: return
        logger.info(f"Response Queue Processor started for {self.room_group_name}")
        try:
            async for media_packet in self.session.process_response_queue():
                if media_packet:
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {'type': 'mediapacket_broadcast', 'packet': media_packet.to_dict()}
                    )
        except asyncio.CancelledError:
            logger.info(f"Response Queue Processor for {self.room_group_name} cancelled.")
        except Exception as e:
            logger.error(f"Response Queue Processor error for {self.room_group_name}: {e}")

    # --- WebSocket 메시지 핸들러들 ---
    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat_message', 'message': event['message'], 'sender': event['sender'],
            'message_type': 'user', 'timestamp': time.time()
        }))

    async def system_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'system_message', 'message': event['message'],
            'message_type': 'system', 'timestamp': time.time()
        }))

    async def mediapacket_broadcast(self, event):
        await self.send(text_data=json.dumps({
            'type': 'media_packet', 'packet': event['packet'],
            'message_type': 'ai_mediapacket', 'timestamp': time.time()
        }))

    async def donation_message(self, event):
        # 이 핸들러는 payments 앱에서 직접 agent.on_new_input_async를 호출하는 방식으로 대체될 예정
        # 호환성을 위해 남겨두지만, 로직은 비활성화
        logger.info("Legacy donation_message handler called, but logic is now handled by agent.")
        pass