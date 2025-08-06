# chat/tts_service.py
import openai
import io
from typing import Optional
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

class TTSService:
    """
    OpenAI TTS API를 사용한 음성 합성 서비스
    Frontend에서 API 키를 노출하지 않고 Backend에서 안전하게 처리
    """
    
    def __init__(self):
        self.client = None
        self._initialized = False
    
    def initialize_client(self):
        """OpenAI 클라이언트 지연 초기화"""
        if self._initialized:
            return
            
        try:
            if not hasattr(settings, 'OPENAI_API_KEY') or not settings.OPENAI_API_KEY:
                logger.error("OpenAI API 키가 설정되지 않았습니다")
                return
                
            self.client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            self._initialized = True
            logger.info("OpenAI TTS 클라이언트가 성공적으로 초기화되었습니다")
            
        except Exception as e:
            logger.error(f"OpenAI TTS 클라이언트 초기화 실패: {e}")
            self.client = None
    
    def is_available(self) -> bool:
        """TTS 서비스 사용 가능 여부 확인"""
        if not self._initialized:
            self.initialize_client()
        return self.client is not None
    
    async def generate_speech(
        self, 
        text: str, 
        voice: str = "nova", 
        speed: float = 1.0,
        output_format: str = "mp3"
    ) -> Optional[bytes]:
        """
        텍스트를 음성으로 변환
        
        Args:
            text (str): 변환할 텍스트
            voice (str): 음성 종류 (nova, alloy, echo, fable, onyx, shimmer)
            speed (float): 재생 속도 (0.25 ~ 4.0)
            output_format (str): 출력 형식 (mp3, opus, aac, flac)
            
        Returns:
            bytes: 생성된 오디오 데이터 또는 None (실패시)
        """
        if not self.is_available():
            logger.error("TTS 서비스를 사용할 수 없습니다")
            return None
            
        try:
            logger.info(f"TTS 생성 시작: {text[:50]}... (voice: {voice}, speed: {speed})")
            
            # OpenAI TTS API 호출
            response = await self.client.audio.speech.create(
                model="tts-1",
                voice=voice,
                input=text,
                speed=speed,
                response_format=output_format
            )
            
            # 오디오 데이터 추출
            audio_data = b"".join(response.iter_bytes())
            logger.info(f"TTS 생성 성공: {len(audio_data)} bytes")
            
            return audio_data
            
        except Exception as e:
            logger.error(f"TTS 생성 실패: {e}")
            return None

# 전역 TTS 서비스 인스턴스
tts_service = TTSService()