# chat/melotts_service.py
import io
import logging
from typing import Optional, Dict, Any
import numpy as np
import soundfile as sf
from django.conf import settings

logger = logging.getLogger(__name__)

class MeloTTSService:
    """
    MeloTTS를 사용한 음성 합성 서비스
    CPU에서도 실시간 추론 가능한 고품질 다국어 TTS
    """
    
    def __init__(self):
        self.models = {}
        self._initialized = False
        self.supported_languages = ['EN', 'KR', 'ZH', 'JP', 'ES', 'FR']
        self.voice_mapping = {
            'default': 0,
            'female': 0,
            'male': 1,
            'child': 2
        }
    
    def initialize_models(self):
        """MeloTTS 모델 지연 초기화"""
        if self._initialized:
            return True
            
        try:
            try:
                from melo.api import TTS
            except ImportError:
                logger.error("MeloTTS가 설치되지 않았습니다. 설치 명령: pip install git+https://github.com/myshell-ai/MeloTTS.git")
                return False
            
            # 주요 언어 모델 초기화 (한국어, 영어)
            languages_to_init = ['EN', 'KR']
            
            for lang in languages_to_init:
                try:
                    # device='auto'로 설정하면 가용한 GPU 사용, 없으면 CPU 사용
                    self.models[lang] = TTS(language=lang, device='auto')
                    logger.info(f"MeloTTS {lang} 모델이 성공적으로 초기화되었습니다")
                except Exception as e:
                    logger.warning(f"MeloTTS {lang} 모델 초기화 실패: {e}")
            
            if self.models:
                self._initialized = True
                logger.info(f"MeloTTS 서비스 초기화 완료: {list(self.models.keys())}")
                return True
            else:
                logger.error("MeloTTS 모델을 하나도 초기화하지 못했습니다")
                return False
                
        except ImportError as e:
            logger.error(f"MeloTTS 라이브러리 임포트 실패: {e}")
            logger.error("설치 명령: pip install git+https://github.com/myshell-ai/MeloTTS.git")
            return False
        except Exception as e:
            logger.error(f"MeloTTS 초기화 실패: {e}")
            import traceback
            logger.error(f"상세 오류: {traceback.format_exc()}")
            return False
    
    def is_available(self) -> bool:
        """MeloTTS 서비스 사용 가능 여부 확인"""
        if not self._initialized:
            return self.initialize_models()
        return bool(self.models)
    
    def get_language_from_text(self, text: str) -> str:
        """텍스트에서 언어 자동 감지"""
        # 간단한 언어 감지 로직
        # 한글이 포함되어 있으면 한국어
        if any('\uac00' <= char <= '\ud7a3' for char in text):
            return 'KR'
        # 중국어 간체자
        elif any('\u4e00' <= char <= '\u9fff' for char in text):
            return 'ZH'
        # 일본어 히라가나/가타카나
        elif any('\u3040' <= char <= '\u309f' for char in text) or \
             any('\u30a0' <= char <= '\u30ff' for char in text):
            return 'JP'
        # 그 외는 영어로 처리
        else:
            return 'EN'
    
    def get_speaker_id(self, voice: str, language: str) -> int:
        """음성 타입을 speaker_id로 변환"""
        # MeloTTS는 언어별로 다른 speaker를 지원
        # 기본적으로 0부터 시작하는 인덱스 사용
        if language == 'EN':
            # 영어는 여러 액센트 지원
            voice_map = {
                'default': 0,  # EN-US
                'female': 0,   # EN-US
                'male': 1,     # EN-BR
                'british': 2,  # EN-UK
                'indian': 3,   # EN-India
                'australian': 4 # EN-AU
            }
        elif language == 'KR':
            # 한국어 음성
            voice_map = {
                'default': 0,  # 여성
                'female': 0,
                'male': 1
            }
        else:
            # 기타 언어는 기본 매핑 사용
            voice_map = self.voice_mapping
        
        return voice_map.get(voice, 0)
    
    async def generate_speech(
        self, 
        text: str, 
        voice: str = "default",
        speed: float = 1.0,
        output_format: str = "mp3",
        language: Optional[str] = None
    ) -> Optional[bytes]:
        """
        텍스트를 음성으로 변환
        
        Args:
            text (str): 변환할 텍스트
            voice (str): 음성 타입 (default, female, male, etc.)
            speed (float): 재생 속도 (0.5 ~ 2.0)
            output_format (str): 출력 형식 (mp3, wav, etc.)
            language (str, optional): 언어 코드. None이면 자동 감지
            
        Returns:
            bytes: 생성된 오디오 데이터 또는 None (실패시)
        """
        if not self.is_available():
            logger.error("MeloTTS 서비스를 사용할 수 없습니다")
            return None
        
        try:
            # 언어 감지 또는 지정
            if language:
                lang = language.upper()
            else:
                lang = self.get_language_from_text(text)
            
            # 해당 언어 모델이 없으면 영어로 폴백
            if lang not in self.models:
                logger.warning(f"언어 {lang} 모델이 없습니다. 영어로 대체합니다.")
                lang = 'EN' if 'EN' in self.models else list(self.models.keys())[0]
            
            model = self.models[lang]
            
            # Speaker ID 결정
            speaker_id = self.get_speaker_id(voice, lang)
            
            logger.info(f"MeloTTS 생성 시작: {text[:50]}... (lang: {lang}, voice: {voice}, speaker: {speaker_id}, speed: {speed})")
            
            # 임시 파일로 생성 (메모리 효율성)
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=f'.{output_format}', delete=False) as tmp_file:
                tmp_path = tmp_file.name
            
            try:
                # MeloTTS로 음성 생성
                # speed 파라미터 적용
                model.tts_to_file(
                    text=text,
                    speaker_id=speaker_id,
                    output_path=tmp_path,
                    speed=speed
                )
                
                # 파일 읽기
                with open(tmp_path, 'rb') as f:
                    audio_data = f.read()
                
                logger.info(f"MeloTTS 생성 성공: {len(audio_data)} bytes")
                return audio_data
                
            finally:
                # 임시 파일 삭제
                import os
                try:
                    os.unlink(tmp_path)
                except:
                    pass
                    
        except Exception as e:
            logger.error(f"MeloTTS 생성 실패: {e}")
            return None
    
    def get_available_voices(self, language: str = 'KR') -> list:
        """사용 가능한 음성 목록 반환"""
        if language.upper() == 'EN':
            return [
                {'value': 'default', 'label': 'American (Female)'},
                {'value': 'male', 'label': 'Brazilian (Male)'},
                {'value': 'british', 'label': 'British'},
                {'value': 'indian', 'label': 'Indian'},
                {'value': 'australian', 'label': 'Australian'}
            ]
        elif language.upper() == 'KR':
            return [
                {'value': 'default', 'label': '한국어 (여성)'},
                {'value': 'male', 'label': '한국어 (남성)'}
            ]
        else:
            return [
                {'value': 'default', 'label': 'Default'},
                {'value': 'female', 'label': 'Female'},
                {'value': 'male', 'label': 'Male'}
            ]
    
    def cleanup(self):
        """리소스 정리"""
        self.models.clear()
        self._initialized = False
        logger.info("MeloTTS 서비스 리소스 정리 완료")

# 전역 MeloTTS 서비스 인스턴스
melotts_service = MeloTTSService()