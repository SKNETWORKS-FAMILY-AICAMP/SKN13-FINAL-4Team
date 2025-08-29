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

from .llm_text_service import ai_service
from .media_orchestrator import MediaProcessingHub

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
    
    # 🆕 클래스 변수로 변경: 모든 연결이 StreamSession을 공유
    stream_sessions = {}  # 룸별 StreamSession 관리
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # 🆕 StreamSession 기반 Queue 시스템 (기존 쿨다운 시스템 제거)
        self.media_processor = MediaProcessingHub()
        self.queue_processor_task = None  # Queue 처리 태스크

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
        
        logger.info(f"🔗 스트리밍 채팅 연결 시도: {self.streamer_id}")
        logger.info(f"📍 클라이언트 IP: {self.scope.get('client', ['unknown'])[0]}")
        logger.info(f"🔍 스코프 정보: {self.scope.get('query_string', b'').decode()}")
        logger.info(f"🎬 StreamSession 상태: {hasattr(self, 'session') and self.session is not None}")
        
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
        logger.info(f"🔐 사용자 인증 완료: {user.username}")
        
        # 🆕 StreamSession 초기화 (룸별 독립적 관리) - 강화된 디버깅
        try:
            logger.info(f"🔍 StreamSession 초기화 시작: {self.room_group_name}")
            logger.info(f"📊 현재 활성 세션 개수: {len(StreamingChatConsumer.stream_sessions)}")
            
            if self.room_group_name not in StreamingChatConsumer.stream_sessions:
                logger.info(f"💡 새로운 StreamSession 생성 중...")
                from .streaming.domain.stream_session import StreamSession
                logger.info(f"✅ StreamSession 클래스 import 성공")
                
                StreamingChatConsumer.stream_sessions[self.room_group_name] = StreamSession(session_id=self.room_group_name)
                logger.info(f"📡 새로운 StreamSession 생성 완료: {self.room_group_name}")
            else:
                logger.info(f"📡 기존 StreamSession 사용: {self.room_group_name}")
            
            self.session = StreamingChatConsumer.stream_sessions[self.room_group_name]
            logger.info(f"✅ StreamSession 설정 완료: {self.session.session_id}")
            
        except Exception as e:
            logger.error(f"❌ StreamSession 초기화 실패: {e}")
            import traceback
            logger.error(f"❌ 스택 트레이스: {traceback.format_exc()}")
            # StreamSession 초기화가 실패해도 연결은 유지하되, 세션은 None으로 설정
            self.session = None
        
        # 🆕 두 개의 독립적인 Queue Processor 시작 (Request Queue와 Response Queue 분리)
        if not hasattr(self, 'request_processor_task') or self.request_processor_task.done():
            self.request_processor_task = asyncio.create_task(self.process_request_queue())
            logger.info(f"🎬 Request Queue Processor 시작: {self.room_group_name}")
            
        if not hasattr(self, 'response_processor_task') or self.response_processor_task.done():
            self.response_processor_task = asyncio.create_task(self.process_response_queue())
            logger.info(f"🎵 Response Queue Processor 시작: {self.room_group_name}")
        
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
        
        # 🆕 초기 Queue 상태 전송 (안전한 처리)
        try:
            if hasattr(self, 'session') and self.session:
                session_info = self.session.get_session_info()
                detailed_queue_info = self.session.get_detailed_queue_info()
                
                # 기본 queue 상태 (JSON 직렬화 가능한 데이터만)
                safe_session_info = {
                    'session_id': session_info.get('session_id', ''),
                    'queue_length': session_info.get('queue_length', 0),
                    'is_processing': session_info.get('is_processing', False),
                    'current_seq': session_info.get('current_seq', 0),
                    'uptime_ms': session_info.get('uptime_ms', 0),
                    'recent_hashes_count': session_info.get('recent_hashes_count', 0)
                }
                
                await self.send(text_data=json.dumps({
                    'type': 'queue_status_update',
                    'session_info': safe_session_info,
                    'timestamp': time.time(),
                    'message_type': 'system_queue_status'
                }))
                
                # 상세 queue 정보는 간단한 형태로만
                safe_detailed_info = {
                    'session_id': detailed_queue_info.get('session_id', ''),
                    'queue_length': detailed_queue_info.get('queue_length', 0),
                    'is_processing': detailed_queue_info.get('is_processing', False),
                    'metrics': {
                        'total_processed': detailed_queue_info.get('metrics', {}).get('total_processed', 0),
                        'cancelled_requests': detailed_queue_info.get('metrics', {}).get('cancelled_requests', 0)
                    }
                }
                
                await self.send(text_data=json.dumps({
                    'type': 'queue_debug_update',
                    'detailed_queue_info': safe_detailed_info,
                    'timestamp': time.time(),
                    'message_type': 'debug_queue_info'
                }))
                
                logger.info(f"✅ 초기 Queue 상태 전송 완료: {user.username}")
            else:
                logger.warning(f"⚠️ StreamSession이 초기화되지 않음: {user.username}")
                
        except Exception as e:
            logger.error(f"❌ 초기 Queue 상태 전송 실패: {e}")
            # Queue 전송 실패해도 연결은 유지
        
        # 🆕 무조건 테스트용 Queue 메시지 강제 전송 (디버깅용)
        try:
            logger.info(f"🧪 테스트 Queue 메시지 전송 시작...")
            await self.send(text_data=json.dumps({
                'type': 'queue_status_update',
                'session_info': {
                    'session_id': 'test_session',
                    'queue_length': 0,
                    'is_processing': False,
                    'current_seq': 0
                },
                'timestamp': time.time(),
                'message_type': 'system_queue_status'
            }))
            logger.info(f"🧪 테스트 queue_status_update 메시지 전송 완료")
            
            await self.send(text_data=json.dumps({
                'type': 'queue_debug_update',
                'detailed_queue_info': {
                    'session_id': 'test_session',
                    'queue_length': 0,
                    'is_processing': False,
                    'metrics': {
                        'total_processed': 0,
                        'cancelled_requests': 0
                    }
                },
                'timestamp': time.time(),
                'message_type': 'debug_queue_info'
            }))
            logger.info(f"🧪 테스트 queue_debug_update 메시지 전송 완료")
            
        except Exception as e:
            logger.error(f"❌ 테스트 Queue 메시지 전송 실패: {e}")
            import traceback
            logger.error(f"❌ 스택 트레이스: {traceback.format_exc()}")

        # 입장 알림 메시지
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'system_message',
                'message': f'{user.username}님이 채팅에 참여했습니다.',
            }
        )

    async def disconnect(self, close_code):
        # 🆕 두 개의 Queue Processor 정리
        if hasattr(self, 'request_processor_task') and self.request_processor_task and not self.request_processor_task.done():
            self.request_processor_task.cancel()
            logger.info(f"🚫 Request Queue Processor 취소: {self.room_group_name}")
            
        if hasattr(self, 'response_processor_task') and self.response_processor_task and not self.response_processor_task.done():
            self.response_processor_task.cancel()
            logger.info(f"🚫 Response Queue Processor 취소: {self.room_group_name}")
        
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
            
            # 🆕 메시지 타입별 처리
            if 'type' in data:
                message_type = data.get('type')
                
                if message_type == 'playback_completed':
                    # 프론트엔드에서 재생 완료 신호
                    seq = data.get('seq')
                    if seq is not None and hasattr(self, 'session') and self.session:
                        self.session.mark_playback_completed(seq)
                        logger.info(f"✅ 재생 완료 신호 처리됨: seq={seq}")
                    return
                    
                elif message_type == 'chat_message':
                    message = data.get('message', '').strip()
                else:
                    logger.warning(f"알 수 없는 메시지 타입: {message_type}")
                    return
            else:
                # 기존 호환성: message 필드만 있는 경우
                message = data.get('message', '').strip()
            
            if not message:
                return
                
            logger.info(f"📨 [MESSAGE] 스트리밍 채팅 메시지: {self.user.username} → '{message[:50]}...' | 길이: {len(message)}자")
            
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
                logger.info(f"🤖 [AI-TRIGGER] AI 요청 감지: '{clean_message[:30]}...' | 사용자: {self.user.username}")
                await self.process_ai_response(clean_message)
            else:
                logger.debug(f"💬 [USER-ONLY] 일반 채팅 메시지 (AI 트리거 없음): {self.user.username}")
                
        except Exception as e:
            logger.error(f"메시지 처리 오류: {e}")

    async def process_ai_response(self, clean_message):
        """AI 요청을 StreamSession Queue에 추가 (기존 쿨다운 시스템 제거)"""
        try:
            logger.info(f"📝 [REQUEST] Queue에 AI 요청 추가: {clean_message[:30]}... | 사용자: {self.user.username}")
            
            # 스트리머 설정 조회
            current_tts_settings = await self.get_streamer_tts_settings(self.streamer_id)
            
            # 요청 데이터 구성
            request_data = {
                'message': clean_message,
                'user_id': self.user.id,
                'username': self.user.username,
                'room_group': self.room_group_name,
                'streamer_config': {
                    'streamer_id': self.streamer_id,
                    'character_id': self.streamer_id,
                    'voice_settings': current_tts_settings or {}
                },
                'timestamp': time.time()
            }
            
            # StreamSession Queue에 요청 추가
            await self.session.enqueue_request(request_data)
            
            queue_size = self.session.request_queue.qsize()
            logger.info(f"✅ [REQUEST] Queue에 요청 추가 완료: '{clean_message[:30]}...' | 큐 크기: {queue_size} | 처리중: {self.session.is_processing}")
            
        except Exception as e:
            logger.error(f"❌ [REQUEST] AI 요청 Queue 추가 실패: {e} | 사용자: {self.user.username} | 메시지: '{clean_message[:30]}...'")
    
    async def process_request_queue(self):
        """Request Queue 처리 - MediaPacket 생성만 담당"""
        try:
            logger.info(f"🎬 [REQ-PROCESSOR] Request Queue Processor 시작: {self.room_group_name}")
            
            # 🆕 제너레이터가 아닌 직접 호출 방식으로 변경
            await self.session.process_queue(self.media_processor)
                    
        except asyncio.CancelledError:
            logger.info(f"🚫 [REQ-PROCESSOR] Request Queue Processor 취소됨: {self.room_group_name}")
        except Exception as e:
            logger.error(f"❌ [REQ-PROCESSOR] Request Queue Processor 오류: {e}")
    
    async def process_response_queue(self):
        """Response Queue 처리 - MediaPacket 순차 재생 담당"""
        try:
            logger.info(f"🎵 [RES-PROCESSOR] Response Queue Processor 시작: {self.room_group_name}")
            
            # StreamSession의 process_response_queue 제너레이터 사용
            async for media_packet in self.session.process_response_queue():
                if media_packet:
                    logger.info(f"🎵 [RES-PROCESSOR] MediaPacket 순차 재생: seq={media_packet.seq}, hash={media_packet.hash[:8]}")
                    # MediaPacket 브로드캐스트 (순차 재생)
                    await self.broadcast_mediapacket(media_packet)
                    
                    # Response Queue 상태 업데이트 브로드캐스트
                    await self.broadcast_queue_status()
                    
        except asyncio.CancelledError:
            logger.info(f"🚫 [RES-PROCESSOR] Response Queue Processor 취소됨: {self.room_group_name}")
        except Exception as e:
            logger.error(f"❌ [RES-PROCESSOR] Response Queue Processor 오류: {e}")
    
    async def broadcast_mediapacket(self, media_packet):
        """MediaPacket을 WebSocket으로 브로드캐스트"""
        try:
            packet_dict = media_packet.to_dict()
            session_info = self.session.get_session_info()
            
            # 트랙 상세 정보 로깅
            track_info = []
            for track in media_packet.tracks:
                track_info.append(f"{track.kind}:{track.payload_ref[:30]}...")
            
            logger.info(f"📡 MediaPacket 브로드캐스트: seq={media_packet.seq}, hash={media_packet.hash[:8]}")
            logger.info(f"📡 MediaPacket 트랙들: [{', '.join(track_info)}]")
            logger.info(f"📡 직렬화된 패킷: {len(packet_dict.get('tracks', []))}개 트랙")
            
            # 모든 클라이언트에게 전송
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'mediapacket_broadcast',
                    'packet': packet_dict,
                    'session_info': session_info,
                    'server_timestamp': time.time()
                }
            )
            
        except Exception as e:
            logger.error(f"❌ MediaPacket 브로드캐스트 실패: {e}")
    
    async def broadcast_queue_status(self):
        """Queue 상태를 클라이언트에 브로드캐스트"""
        try:
            # 기본 세션 정보
            session_info = self.session.get_session_info()
            
            # 상세 큐 정보 (Debug Panel용)
            detailed_queue_info = self.session.get_detailed_queue_info()
            
            # 기본 상태 업데이트 전송
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'queue_status_update',
                    'session_info': session_info,
                    'timestamp': time.time()
                }
            )
            
            # 상세 큐 정보 전송 (Debug Panel용)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'queue_debug_update',
                    'detailed_queue_info': detailed_queue_info,
                    'timestamp': time.time()
                }
            )
            
        except Exception as e:
            logger.error(f"❌ Queue 상태 브로드캐스트 실패: {e}")
    
    def _extract_emotion_from_response(self, response: str) -> str:
        """AI 응답에서 감정 태그 추출"""
        import re
        emotion_match = re.search(r'\[emotion:(\w+)\]', response)
        if emotion_match:
            return emotion_match.group(1).lower()
        return 'neutral'
    
    def _clean_emotion_tags(self, response: str) -> str:
        """AI 응답에서 감정 태그 제거"""
        import re
        return re.sub(r'\[emotion:\w+\]', '', response).strip()
    
    # 🚫 기존 broadcast_synchronized_media 제거 (MediaPacket 시스템으로 대체)
    # → broadcast_mediapacket으로 대체됨

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
    
    async def mediapacket_broadcast(self, event):
        """MediaPacket 브로드캐스트 핸들러"""
        try:
            packet = event['packet']
            session_info = event['session_info']
            server_timestamp = event['server_timestamp']
            
            # 클라이언트에 MediaPacket 전송
            await self.send(text_data=json.dumps({
                'type': 'media_packet',
                'packet': packet,
                'session_info': session_info,
                'server_timestamp': server_timestamp,
                'message_type': 'ai_mediapacket',
                'timestamp': time.time()
            }))
            
            logger.debug(f"📤 MediaPacket 전송됨: seq={packet['seq']}, hash={packet['hash'][:8]}")
            
        except Exception as e:
            logger.error(f"❌ MediaPacket 전송 실패: {e}")
    
    async def queue_status_update(self, event):
        """Queue 상태 업데이트 핸들러"""
        try:
            session_info = event['session_info']
            
            await self.send(text_data=json.dumps({
                'type': 'queue_status_update',
                'session_info': session_info,
                'timestamp': event['timestamp'],
                'message_type': 'system_queue_status'
            }))
            
            logger.debug(f"📊 Queue 상태 전송됨: 큐={session_info.get('queue_length', 0)}, 처리중={session_info.get('is_processing', False)}")
            
        except Exception as e:
            logger.error(f"❌ Queue 상태 전송 실패: {e}")
    
    async def queue_debug_update(self, event):
        """상세 Queue 디버그 정보 업데이트 핸들러"""
        try:
            detailed_queue_info = event['detailed_queue_info']
            
            await self.send(text_data=json.dumps({
                'type': 'queue_debug_update',
                'detailed_queue_info': detailed_queue_info,
                'timestamp': event['timestamp'],
                'message_type': 'debug_queue_info'
            }))
            
            logger.debug(f"🔍 Queue 디버그 정보 전송됨: 큐={detailed_queue_info.get('queue_length', 0)}, 처리량={detailed_queue_info.get('metrics', {}).get('total_processed', 0)}")
            
        except Exception as e:
            logger.error(f"❌ Queue 디버그 정보 전송 실패: {e}")
    
    async def donation_message(self, event):
        """후원 메시지 브로드캐스트 핸들러"""
        try:
            donation_data = event['data']
            
            await self.send(text_data=json.dumps({
                'type': 'donation_message',
                'data': donation_data,
                'message_type': 'donation',
                'timestamp': time.time()
            }))
            
            logger.info(f"💰 후원 메시지 전송됨: {donation_data['username']} - {donation_data['amount']}크레딧")
            
            # 스트리머 세션에서만 1회 AI 감사 응답 트리거 (중복 방지)
            try:
                if getattr(self, 'user', None) and getattr(self, 'streamer_id', None):
                    # 현재 컨슈머의 사용자명이 스트리머 ID와 동일하면 스트리머 연결로 간주
                    if self.user.username == self.streamer_id and hasattr(self, 'session') and self.session:
                        donor = donation_data.get('username') or '시청자'
                        amount = donation_data.get('amount')
                        note = donation_data.get('message') or ''
                        # 감사 인사 프롬프트 구성
                        thank_prompt = (
                            f"후원 감사합니다. 후원자: {donor}, 금액: {amount} 크레딧. "
                            f"후원 메시지: {note}. 친근하고 간단한 감사 인사를 해주세요."
                            f"후원자의 질문이 "
                        )
                        logger.info("🤖 후원 감사 AI 응답 트리거")
                        await self.process_ai_response(thank_prompt)
            except Exception as e:
                logger.warning(f"후원 감사 AI 트리거 중 경고: {e}")
            
        except Exception as e:
            logger.error(f"❌ 후원 메시지 전송 실패: {e}")
    
    # 🚫 기존 synchronized_media_broadcast 제거 (MediaPacket으로 대체)
    # async def synchronized_media_broadcast(self, event): → mediapacket_broadcast로 대체
