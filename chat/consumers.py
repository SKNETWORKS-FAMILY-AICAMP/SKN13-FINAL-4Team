# chat/consumers.py
import json
import asyncio
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from .ai_service import ai_service

logger = logging.getLogger(__name__)

class ChatConsumer(AsyncWebsocketConsumer):
    """
    ChatConsumer는 채팅 애플리케이션의 WebSocket 연결을 처리합니다.
    사용자가 채팅방에 참여하고, 메시지를 보내고, 같은 방에 있는 다른 사용자와 메시지를 받을 수 있도록 합니다.
    AI 챗봇이 통합되어 모든 사용자 메시지에 자동으로 응답합니다.
    """
    async def connect(self):
        # URL 파라미터에서 방 이름을 가져옵니다.
        self.room_name = self.scope['url_route']['kwargs']['room_name']
        self.room_group_name = f'chat_{self.room_name}'
        
        # 대화 히스토리 저장용 (간단한 메모리 저장, 실제로는 DB 사용 권장)
        self.conversation_history = []

        # 그룹에 join
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()
        
        logger.info(f"WebSocket 연결 성공: {self.room_name}")

    async def disconnect(self, close_code):
        # 그룹에서 leave
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        
        logger.info(f"WebSocket 연결 종료: {self.room_name}")
        
        # 대화 히스토리 정리
        self.conversation_history = []

    # React로부터 메시지를 수신했을 때
    async def receive(self, text_data):
        try:
            text_data_json = json.loads(text_data)
            message = text_data_json.get('message', '')
            sender = text_data_json.get('sender', 'user')  # 사용자 구분용
            
            logger.info(f"메시지 수신: {message}")

            # 사용자 메시지를 모든 클라이언트에게 전송
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': message,
                    'sender': sender,
                    'message_type': 'user'
                }
            )
            
            # 대화 히스토리에 사용자 메시지 추가
            self.conversation_history.append({
                "role": "user", 
                "content": message
            })
            
            # AI 응답 생성 및 전송 (비동기로 처리)
            if ai_service.should_respond_to_message(message):
                task = asyncio.create_task(self.generate_and_send_ai_response(message))
                # 태스크 예외 처리를 위한 콜백 추가
                task.add_done_callback(self._handle_ai_task_exception)
                
        except json.JSONDecodeError as e:
            logger.error(f"JSON 디코딩 오류: {e}")
        except Exception as e:
            logger.error(f"메시지 처리 오류: {e}")
    
    def _handle_ai_task_exception(self, task):
        """AI 태스크 예외 처리"""
        try:
            if task.exception():
                logger.error(f"AI 태스크 실행 중 예외 발생: {task.exception()}")
        except Exception as e:
            logger.error(f"AI 태스크 예외 처리 중 오류: {e}")

    async def generate_and_send_ai_response(self, user_message):
        """
        AI 응답을 생성하고 WebSocket으로 전송
        """
        try:
            logger.info(f"AI 응답 생성 시작... (메시지: '{user_message}')")
            
            # AI 서비스로부터 응답 생성
            logger.info("AI 서비스 호출 중...")
            ai_response = await ai_service.generate_response(
                user_message, 
                self.conversation_history
            )
            logger.info(f"AI 서비스 호출 완료, 응답 길이: {len(ai_response) if ai_response else 0}")
            
            if ai_response:
                # 대화 히스토리에 AI 응답 추가
                self.conversation_history.append({
                    "role": "assistant", 
                    "content": ai_response
                })
                
                # 히스토리 크기 제한 (20개 메시지로 제한)
                if len(self.conversation_history) > 20:
                    self.conversation_history = self.conversation_history[-20:]
                
                # AI 응답을 모든 클라이언트에게 전송
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_message',
                        'message': ai_response,
                        'sender': 'ai',
                        'message_type': 'ai'
                    }
                )
                
                logger.info(f"AI 응답 전송 완료: {len(ai_response)} 문자")
            else:
                logger.warning("AI 응답 생성 실패")
                
        except Exception as e:
            logger.error(f"AI 응답 생성 오류: {e}")
    
    # group_send 로부터 메시지를 수신했을 때
    async def chat_message(self, event):
        message = event['message']
        sender = event.get('sender', 'unknown')
        message_type = event.get('message_type', 'user')
        
        # React로 메시지 전송
        await self.send(text_data=json.dumps({
            'message': message,
            'sender': sender,
            'message_type': message_type,
            'timestamp': str(asyncio.get_event_loop().time())
        }))