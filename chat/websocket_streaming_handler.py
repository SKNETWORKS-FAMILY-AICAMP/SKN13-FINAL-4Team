# backend/chat/websocket_streaming_handler.py
import json
import asyncio
import time
import logging
from urllib.parse import parse_qs
from datetime import datetime
from typing import Optional

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from users.models import User

from . import agent_manager
from .agent.agent import LoveStreamerAgent
from .agent.story import DjangoStoryRepository
from .streaming.domain.stream_session import StreamSession
from .media_orchestrator import MediaProcessingHub
from .models import ChatRoom, StreamerTTSSettings, ChatMessage

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

@database_sync_to_async
def get_streamer_id_from_room(room_id):
    try:
        room = ChatRoom.objects.select_related('influencer').get(id=room_id)
        if room.influencer:
            return room.influencer.name
        return None
    except ChatRoom.DoesNotExist:
        return None



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

    @database_sync_to_async
    def save_message(self, user, message):
        try:
            room = ChatRoom.objects.get(id=self.room_id)
            ChatMessage.objects.create(room=room, sender=user, content=message)
            logger.info(f"💾 메시지 저장 완료: {user.username} -> room {self.room_id}")
        except ChatRoom.DoesNotExist:
            logger.error(f"❌ 메시지 저장 실패: ChatRoom(id={self.room_id})을 찾을 수 없습니다.")
        except Exception as e:
            logger.error(f"❌ 메시지 저장 중 알 수 없는 오류 발생: {e}")
            import traceback
            traceback.print_exc()

    @database_sync_to_async
    def get_streamer_tts_settings(self, streamer_id):
        try:
            settings, created = StreamerTTSSettings.get_or_create_for_streamer(streamer_id)
            return settings.to_dict()
        except Exception as e:
            logger.warning(f"TTS 설정 조회 실패: {e}")
            return None

    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'streaming_chat_{self.room_id}'

        self.streamer_id = await get_streamer_id_from_room(self.room_id)
        if not self.streamer_id:
            logger.error(f"Streamer ID not found for room {self.room_id}. Closing connection.")
            await self.close(code=4004)
            return

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
            agent_manager.active_agents[self.streamer_id] = LoveStreamerAgent(
                api_key=settings.OPENAI_API_KEY,
                story_repo=story_repo,
                streamer_id=self.streamer_id
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
        
        # Response Queue 처리 태스크 시작 (각 연결마다 독립적으로)
        self.response_processor_task = asyncio.create_task(self.process_response_queue())
        logger.info(f"✅ New response processor started for connection {self.channel_name}")
        
        # 정기 큐 브로드캐스트 태스크 시작 (각 연결마다 독립적으로)
        self.periodic_broadcast_task = asyncio.create_task(self._periodic_queue_broadcast())

        agent_manager.connection_counts[self.streamer_id] += 1

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        # --- 초기 정보 전송 및 입장 알림 ---
        # (기존 코드: tts_settings, queue_status 등 전송 로직 추가 가능)
        await self.channel_layer.group_send(
            self.room_group_name,
            {'type': 'system_message', 'message': f'{self.user.username}님이 채팅에 참여했습니다.'}
        )
        logger.info(f"User {self.user.username} connected to room {self.room_id}. Total connections: {agent_manager.connection_counts[self.streamer_id]}")


    async def disconnect(self, close_code):
        # 개별 연결의 태스크들 정리
        if hasattr(self, 'response_processor_task') and not self.response_processor_task.done():
            self.response_processor_task.cancel()
            logger.info(f"🗑️ Response processor cancelled for connection {self.channel_name}")
            
        if hasattr(self, 'periodic_broadcast_task') and not self.periodic_broadcast_task.done():
            self.periodic_broadcast_task.cancel()
            logger.info(f"🗑️ Periodic broadcast cancelled for connection {self.channel_name}")
            
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

            # --- 정식 필터 적용 ---
            from .services.message_filter import is_message_blocked
            is_blocked = await is_message_blocked(message)

            if is_blocked:
                # 필터에 차단된 경우: 일반 채팅 메시지 형태로 차단 메시지를 브로드캐스트
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_message',
                        'message': '방송 가이드라인에 의해 차단된 채팅입니다.',
                        'sender': self.user.username
                    }
                )
                logger.info(f"🚫 메시지 차단됨: (사용자: {self.user.username}, 내용: {message[:30]}...)")
                return # 큐 적재 및 추가 처리 중단

            # --- 필터 통과 시 ---
            # 사용자 메시지를 DB에 저장
            await self.save_message(self.user, message)

            # 사용자 메시지 브로드캐스트
            await self.channel_layer.group_send(
                self.room_group_name,
                {'type': 'chat_message', 'message': message, 'sender': self.user.username}
            )

            # AI 에이전트에게 메시지 전달
            if self.agent:
                asyncio.create_task(self.agent.on_new_input_async({
                    "type": "normal",
                    "content": message,
                    "user_id": self.user.username,
                    "chat_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }))

    async def process_response_queue(self):
        """Response Queue를 처리하여 MediaPacket을 모든 클라이언트에게 브로드캐스트"""
        if not self.session: 
            logger.error("❌ No session available for response queue processing")
            return
        logger.info(f"🚀 Response Queue Processor started for {self.room_group_name}")
        try:
            async for media_packet in self.session.process_response_queue():
                if media_packet:
                    logger.info(f"📦 Broadcasting MediaPacket: seq={media_packet.seq}, hash={media_packet.hash[:8]}")
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {'type': 'mediapacket_broadcast', 'packet': media_packet.to_dict()}
                    )
                    logger.info(f"✅ MediaPacket broadcast sent to {self.room_group_name}")
                else:
                    logger.warning("⚠️ Received empty MediaPacket from response queue")
        except asyncio.CancelledError:
            logger.info(f"Response Queue Processor for {self.room_group_name} cancelled.")
        except Exception as e:
            logger.error(f"❌ Response Queue Processor error for {self.room_group_name}: {e}")
            import traceback
            traceback.print_exc()

    # --- WebSocket 메시지 핸들러들 ---
    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat_message', 'message': event['message'], 'sender': event['sender'],
            'message_type': 'user', 'timestamp': datetime.now().isoformat()
        }))

    async def system_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'system_message', 'message': event['message'],
            'message_type': 'system', 'timestamp': datetime.now().isoformat()
        }))

    async def mediapacket_broadcast(self, event):
        await self.send(text_data=json.dumps({
            'type': 'media_packet', 'packet': event['packet'],
            'message_type': 'ai_mediapacket', 'timestamp': datetime.now().isoformat()
        }))

    async def donation_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'donation_message', 
            'message': event['message'], 
            'user': event['user'],
            'amount': event['amount'],
            'message_type': 'donation', 
            'timestamp': event.get('timestamp', datetime.now().isoformat())
        }))

    async def queue_debug_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'queue_debug_update',
            'detailed_queue_info': event.get('detailed_queue_info'),
            'session_info': event.get('session_info'),
            'queue_status': event.get('queue_status'),
            'timestamp': event.get('timestamp')
        }))


    async def _periodic_queue_broadcast(self):
        """2초마다 큐 상태를 정기적으로 브로드캐스트"""
        logger.info(f"🔄 정기 큐 상태 브로드캐스트 시작: {self.room_group_name}")
        
        try:
            while True:
                await asyncio.sleep(2.0)  # 2초마다 실행
                
                # 에이전트가 존재하는지 확인
                if (hasattr(self, 'agent') and self.agent and 
                    hasattr(self.agent, 'broadcast_queue_state')):
                    try:
                        await self.agent.broadcast_queue_state(self.room_id)
                        logger.debug(f"🔄 정기 큐 상태 브로드캐스트 완료: {self.room_group_name}")
                    except Exception as e:
                        logger.error(f"❌ 정기 큐 브로드캐스트 오류: {e}")
                else:
                    # 에이전트가 없으면 루프 종료
                    logger.info("Agent not available, stopping periodic broadcast")
                    break
                    
        except asyncio.CancelledError:
            logger.info(f"🚫 정기 큐 브로드캐스트 취소됨: {self.room_group_name}")
        except Exception as e:
            logger.error(f"❌ 정기 큐 브로드캐스트 예외: {e}")