# chat/ai_service.py
import openai
import json
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class AIService:
    """
    OpenAI API를 사용한 AI 챗봇 서비스
    WebSocket 환경에서 사용자 메시지에 AI 응답을 생성
    """
    
    def __init__(self):
        self.client = None
        self._initialized = False
    
    def initialize_client(self):
        """OpenAI 클라이언트 지연 초기화"""
        if self._initialized:
            return
            
        try:
            from django.conf import settings
            
            if not hasattr(settings, 'OPENAI_API_KEY') or not settings.OPENAI_API_KEY:
                logger.error("OpenAI API 키가 설정되지 않았습니다")
                return
                
            self.client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            self._initialized = True
            logger.info("OpenAI 클라이언트가 성공적으로 초기화되었습니다")
            
        except Exception as e:
            logger.error(f"OpenAI 클라이언트 초기화 실패: {e}")
            self.client = None
    
    def is_available(self) -> bool:
        """AI 서비스 사용 가능 여부 확인"""
        if not self._initialized:
            self.initialize_client()
        return self.client is not None
    
    async def generate_response(self, user_message: str, conversation_history: list = None) -> Optional[str]:
        """
        사용자 메시지에 대한 AI 응답 생성
        
        Args:
            user_message (str): 사용자 메시지
            conversation_history (list): 이전 대화 히스토리 (선택사항)
            
        Returns:
            str: AI 응답 메시지 또는 None (실패시)
        """
        if not self.is_available():
            return None
            
        # settings를 지연 로딩
        from django.conf import settings
        
        try:
            # 메시지 구성
            logger.info(f"메시지 구성 시작 - 사용자 메시지: {user_message[:50]}...")
            messages = [
                {"role": "system", "content": settings.AI_CHATBOT_SETTINGS['SYSTEM_PROMPT']}
            ]
            
            # 대화 히스토리 추가 (선택사항)
            if conversation_history:
                messages.extend(conversation_history[-10:])  # 최근 10개 메시지만 유지
                logger.info(f"대화 히스토리 {len(conversation_history[-10:])}개 메시지 추가")
            
            # 현재 사용자 메시지 추가
            messages.append({"role": "user", "content": user_message})
            logger.info(f"총 {len(messages)}개 메시지로 OpenAI API 호출 시작")
            
            # OpenAI API 호출
            response = await self._make_async_request(messages)
            
            if response and response.choices:
                ai_message = response.choices[0].message.content.strip()
                logger.info(f"AI 응답 생성 성공: {len(ai_message)} 문자")
                return ai_message
            else:
                logger.warning("OpenAI API 응답이 비어있습니다")
                return None
                
        except Exception as e:
            logger.error(f"AI 응답 생성 실패: {e}")
            return None
    
    async def _make_async_request(self, messages):
        """비동기 OpenAI API 요청"""
        try:
            from django.conf import settings
            
            logger.info(f"OpenAI API 요청 시작 - 모델: {settings.AI_CHATBOT_SETTINGS['MODEL']}")
            
            # AsyncOpenAI 클라이언트를 사용한 비동기 호출
            response = await self.client.chat.completions.create(
                model=settings.AI_CHATBOT_SETTINGS['MODEL'],
                messages=messages,
                max_tokens=settings.AI_CHATBOT_SETTINGS['MAX_TOKENS'],
                temperature=settings.AI_CHATBOT_SETTINGS['TEMPERATURE'],
                stream=False  # WebSocket에서는 스트리밍을 직접 처리하지 않음
            )
            
            logger.info("OpenAI API 응답 수신 성공")
            return response
        except Exception as e:
            logger.error(f"OpenAI API 요청 실패: {e}")
            logger.error(f"API 설정값: 모델={getattr(settings, 'AI_CHATBOT_SETTINGS', {}).get('MODEL', 'NOT_SET')}")
            return None
    
    def should_respond_to_message(self, message: str) -> bool:
        """
        메시지에 AI가 응답해야 하는지 판단
        현재는 모든 메시지에 응답하지만, 향후 필터링 로직 추가 가능
        
        Args:
            message (str): 사용자 메시지
            
        Returns:
            bool: 응답 여부
        """
        # 빈 메시지나 너무 짧은 메시지는 무시
        if not message or len(message.strip()) < 2:
            return False
        
        # 시스템 메시지나 명령어는 무시 (예: /help, /quit 등)
        if message.strip().startswith('/'):
            return False
        
        # 모든 일반 메시지에 응답
        return True

# 전역 AI 서비스 인스턴스
ai_service = AIService()