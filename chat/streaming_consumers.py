# chat/streaming_consumers.py
import json
import asyncio
import time
import logging
from urllib.parse import parse_qs
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .ai_service import ai_service

logger = logging.getLogger(__name__)

class StreamingChatConsumer(AsyncWebsocketConsumer):
    """
    스트리밍 페이지 전용 채팅 컨슈머
    - 스트리머별 개별 채팅방
    - 로그인 사용자만 채팅 참여
    - 특수문자 기반 AI 선별적 응답
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.ai_response_queue = []
        self.last_ai_response_time = 0
        self.AI_RESPONSE_COOLDOWN = 3  # 3초 간격으로 AI 응답 제한

    @database_sync_to_async
    def get_user_by_id(self, user_id):
        """DB에서 user_id로 사용자 정보 조회"""
        try:
            from users.models import User
            return User.objects.get(id=user_id)
        except Exception as e:
            logger.warning(f"사용자 조회 실패: {e}")
            return None

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

    async def authenticate_user(self):
        """사용자 인증 처리 (JWT 전용)"""
        # JWT 토큰 확인
        query_string = self.scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)
        token = query_params.get('token', [None])[0]
        
        if token and len(token) > 10:
            logger.info("JWT 토큰 발견 - JWT 인증 시도")
            return await self.authenticate_jwt(token)
        
        logger.warning("인증 실패: JWT 토큰이 없음")
        return None
    
    async def authenticate_jwt(self, token):
        """JWT 토큰 기반 인증"""
        try:
            # JWT 토큰의 payload 부분만 디코딩하여 사용자 정보 추출
            import json
            import base64
            
            # JWT 토큰을 . 으로 분리하여 payload 부분 추출
            parts = token.split('.')
            if len(parts) >= 2:
                # payload를 base64 디코딩 (패딩 추가)
                payload = parts[1]
                payload += '=' * (4 - len(payload) % 4)
                decoded_payload = base64.urlsafe_b64decode(payload)
                payload_data = json.loads(decoded_payload)
                logger.info(f"JWT 페이로드: {payload_data}")
                
                # user_id로 실제 사용자 정보 조회
                user_id_str = payload_data.get('user_id')
                if user_id_str:
                    try:
                        user_id = int(user_id_str)
                        real_user = await self.get_user_by_id(user_id)
                        if real_user:
                            logger.info(f"JWT 토큰에서 실제 사용자 조회 성공: {real_user.username} (ID: {real_user.id})")
                            return real_user
                    except (ValueError, TypeError):
                        pass
                
                # DB 조회 실패 시 임시 사용자 생성
                logger.warning("JWT user_id로 사용자 조회 실패, 임시 사용자 생성")
            else:
                logger.warning("JWT 토큰 형식 오류")
        except Exception as e:
            logger.warning(f"JWT 토큰 파싱 오류: {e}")
        
        # JWT 처리 실패 시 임시 사용자 생성
        class TempUser:
            def __init__(self):
                self.username = 'JWT_User'
                self.id = 999
                self.is_authenticated = True
        return TempUser()

    async def connect(self):
        # 스트리머 ID 추출
        self.streamer_id = self.scope['url_route']['kwargs']['streamer_id']
        self.room_group_name = f'streaming_chat_{self.streamer_id}'
        
        logger.info(f"스트리밍 채팅 연결 시도: {self.streamer_id}")
        
        # 사용자 인증 (세션 또는 JWT)
        user = await self.authenticate_user()
        if not user:
            logger.warning(f"미인증 사용자의 채팅 연결 시도: {self.streamer_id}")
            await self.close(code=4001)  # 인증 실패
            return
        
        # 사용자 정보 저장
        self.user = user
        
        # 채팅방 그룹에 입장
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        logger.info(f"스트리밍 채팅 연결 성공: {user.username} → {self.streamer_id}")
        logger.info(f"채널명: {self.channel_name}")
        
        # 현재 TTS 설정을 새로 접속한 클라이언트에게 전송
        tts_settings = await self.get_streamer_tts_settings(self.streamer_id)
        if tts_settings:
            await self.send(text_data=json.dumps({
                'type': 'initial_tts_settings',
                'settings': tts_settings,
                'message': 'TTS 설정이 서버에서 로드되었습니다.'
            }))
        
        # 입장 알림 메시지
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'system_message',
                'message': f'{user.username}님이 채팅에 참여했습니다.',
                'message_type': 'system'
            }
        )

    async def disconnect(self, close_code):
        # 채팅방 그룹에서 떠남
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
                        'message_type': 'system'
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
                    'message_type': 'user',
                    'timestamp': time.time()
                }
            )
            
            # AI 응답이 필요한 메시지인지 확인
            ai_trigger = self.check_ai_trigger(message)
            if ai_trigger:
                await self.process_ai_response(message, ai_trigger)
                
        except json.JSONDecodeError:
            logger.error(f"JSON 파싱 오류: {text_data}")
        except Exception as e:
            logger.error(f"메시지 처리 오류: {e}")

    def check_ai_trigger(self, message):
        """@ 멘션 기반 AI 트리거 확인"""
        # @ 멘션만 AI 호출 트리거로 사용
        if message.startswith('@'):
            return {
                'trigger': True, 
                'priority': 'high', 
                'type': 'mention',
                'clean_message': message[1:].strip()  # @ 제거
            }
        
        return None

    async def process_ai_response(self, original_message, ai_trigger):
        """우선순위 기반 AI 응답 처리"""
        try:
            current_time = time.time()
            
            # AI 응답 쿨다운 체크 (스팸 방지)
            if current_time - self.last_ai_response_time < self.AI_RESPONSE_COOLDOWN:
                logger.info(f"AI 응답 쿨다운: {self.AI_RESPONSE_COOLDOWN}초 대기")
                return
            
            # 큐에 추가
            self.ai_response_queue.append({
                'original_message': original_message,
                'clean_message': ai_trigger['clean_message'],
                'priority': ai_trigger['priority'],
                'type': ai_trigger['type'],
                'user': self.user.username,
                'timestamp': current_time
            })
            
            logger.info(f"AI 응답 큐에 추가: {ai_trigger['type']} - {ai_trigger['clean_message'][:30]}...")
            
            # 비동기로 AI 응답 생성
            asyncio.create_task(self.generate_ai_response_from_queue())
            
        except Exception as e:
            logger.error(f"AI 응답 처리 오류: {e}")

    async def generate_ai_response_from_queue(self):
        """큐에서 AI 응답 생성 및 전송"""
        if not self.ai_response_queue:
            return
        
        try:
            # 우선순위별 정렬 (high -> medium -> low)
            priority_order = {'high': 0, 'medium': 1, 'low': 2}
            self.ai_response_queue.sort(key=lambda x: priority_order.get(x['priority'], 3))
            
            # 가장 우선순위 높은 메시지 처리
            queue_item = self.ai_response_queue.pop(0)
            
            logger.info(f"AI 응답 생성 시작: {queue_item['type']} - {queue_item['clean_message'][:30]}...")
            
            # 스트리밍 컨텍스트에 맞는 시스템 프롬프트 생성
            system_prompt = self.get_streaming_system_prompt(queue_item['type'], self.streamer_id)
            
            # AI 응답 생성 (기존 AI 서비스 활용)
            conversation_history = [
                {"role": "system", "content": system_prompt}
            ]
            
            ai_response = await ai_service.generate_response(
                queue_item['clean_message'],
                conversation_history
            )
            
            if ai_response:
                # AI 응답 시간 업데이트
                self.last_ai_response_time = time.time()
                
                # 현재 TTS 설정을 가져와서 AI 응답과 함께 전송
                current_tts_settings = await self.get_streamer_tts_settings(self.streamer_id)
                
                # AI 응답을 채팅방에 브로드캐스트 (TTS 설정 포함)
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_message',
                        'message': ai_response,
                        'sender': f'AI_Assistant',
                        'message_type': 'ai',
                        'ai_trigger_type': queue_item['type'],
                        'replied_to': queue_item['user'],
                        'tts_settings': current_tts_settings,  # TTS 설정 추가
                        'timestamp': time.time()
                    }
                )
                
                logger.info(f"AI 응답 완료: {len(ai_response)} 문자")
            else:
                logger.warning("AI 응답 생성 실패")
                
        except Exception as e:
            logger.error(f"AI 응답 생성 오류: {e}")

    def get_streaming_system_prompt(self, trigger_type, streamer_id):
        """스트리밍 컨텍스트에 맞는 시스템 프롬프트 생성"""
        base_prompt = f"""당신은 '{streamer_id}' 스트리밍 채팅방의 AI 어시스턴트입니다.
시청자들의 질문에 친근하고 도움이 되는 답변을 제공하세요.
답변은 간결하고 채팅 환경에 적합하게 2-3줄 이내로 작성하세요."""
        
        if trigger_type == 'mention':
            return base_prompt + "\n스트리머에게 전하는 메시지나 인사에 대해 대신 응답하세요."
        elif trigger_type == 'command':
            return base_prompt + "\n특별한 요청이나 명령에 대해 적절히 응답하세요."
        elif trigger_type == 'question':
            return base_prompt + "\n질문에 대해 정확하고 유용한 정보를 제공하세요."
        elif trigger_type == 'urgent':
            return base_prompt + "\n긴급하거나 중요한 메시지에 대해 신속히 응답하세요."
        else:
            return base_prompt + "\n일반적인 요청에 대해 친근하게 응답하세요."

    # WebSocket 메시지 핸들러들
    async def chat_message(self, event):
        """채팅 메시지를 클라이언트에게 전송"""
        message_data = {
            'type': 'chat_message',
            'message': event['message'],
            'sender': event['sender'],
            'message_type': event.get('message_type', 'user'),
            'ai_trigger_type': event.get('ai_trigger_type'),
            'replied_to': event.get('replied_to'),
            'timestamp': event.get('timestamp', time.time())
        }
        
        # AI 메시지인 경우 TTS 설정 포함
        if event.get('tts_settings'):
            message_data['tts_settings'] = event['tts_settings']
        
        await self.send(text_data=json.dumps(message_data))

    async def system_message(self, event):
        """시스템 메시지를 클라이언트에게 전송"""
        await self.send(text_data=json.dumps({
            'type': 'system_message',
            'message': event['message'],
            'message_type': event.get('message_type', 'system'),
            'timestamp': time.time()
        }))

    async def tts_settings_changed(self, event):
        """TTS 설정 변경을 클라이언트에게 브로드캐스트"""
        await self.send(text_data=json.dumps({
            'type': 'tts_settings_changed',
            'settings': event['settings'],
            'changed_by': event['changed_by'],
            'timestamp': event['timestamp'],
            'message': f'{event["changed_by"]}님이 TTS 설정을 변경했습니다.'
        }))