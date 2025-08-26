# chat/elevenlabs_service.py
import httpx
import json
import logging
from typing import Optional, Dict, List, Any
from django.conf import settings

logger = logging.getLogger(__name__)

class ElevenLabsService:
    """
    ElevenLabs API를 사용한 TTS 서비스
    고품질 음성 생성을 위한 ElevenLabs API 통합
    """
    
    def __init__(self):
        self.api_key = getattr(settings, 'ELEVENLABS_API_KEY', None)
        self.base_url = "https://api.elevenlabs.io/v1"
        self.voice_map = {
            # 한국 배우 음성 (검증된 유효한 음성만)
            'kimtaeri': '6ZND2SlfJqI0OOEHe2by',    # 김태리 (한국 여성 배우)
            'kimminjeong': 'eTiuJAsb9mqCyH5gFsS9', # 김민정 (한국 여성 배우)  
            'jinseonkyu': 'pWPHfY5KntyWbx2FxSb7', # 진선규 (한국 남성 배우)
            'parkchangwook': 'RQVmMEdMMcmOuv6Fz268', # 박창욱 (한국 남성 배우)
            'aneunjin': 'pRxVZ0v1oH2CqQJWHAty',  # 안은진 (한국 여성 배우)
            
            # 다국어 지원 음성 (검증된 유효한 음성만)
            'charlie': 'IKne3meq5aSn9XLyUdCD',  # Charlie (호주 남성, 다국어)
            'liam': 'TX3LPaxmHKxFdv7VOQHJ',     # Liam (미국 남성, 다국어) 
            'daniel': 'onwK4e9ZLuTAKqWW03F9',   # Daniel (영국 남성, 다국어)
            'matilda': 'XrExE9yKIg1WjnnlVkGX',  # Matilda (여성, 따뜻함)
            'jeremy': '2EiwWnXFnvU5JabPnv8n',   # Jeremy (남성, 미국)
            'rachel': '21m00Tcm4TlvDq8ikWAM',   # Rachel (미국 여성)
            'bella': 'EXAVITQu4vr4xnSDxMaL',   # Bella (미국 여성)
            
            # JiYoung 음성 - 올바른 여성 Voice ID
            'jiyoung': 'AW5wrnG1jVizOYY7R1Oo',     # JiYoung (활기찬 젊은 여성 음성)
        }
        self._initialized = False
    
    def is_available(self) -> bool:
        """ElevenLabs 서비스 사용 가능 여부 확인"""
        if not self._initialized:
            self._check_configuration()
        return bool(self.api_key)
    
    def _check_configuration(self):
        """설정 확인"""
        if not self.api_key:
            logger.warning("ElevenLabs API 키가 설정되지 않았습니다")
        else:
            logger.info("ElevenLabs 서비스가 사용 가능합니다")
        self._initialized = True
    
    def _get_voice_id(self, voice_name: str) -> str:
        """
        음성 이름을 ElevenLabs 음성 ID로 변환
        폴백 메커니즘 포함
        """
        voice_id = self.voice_map.get(voice_name.lower())
        
        if voice_id:
            return voice_id
        else:
            # 요청된 음성을 찾을 수 없는 경우 기본 음성으로 폴백
            logger.warning(f"요청된 음성 '{voice_name}'를 찾을 수 없어 기본 음성 'aneunjin'으로 폴백")
            return self.voice_map['aneunjin']
    
    async def validate_single_voice_id(self, voice_id: str) -> bool:
        """
        단일 Voice ID가 유효한지 검증
        
        Args:
            voice_id (str): 검증할 Voice ID
            
        Returns:
            bool: 유효 여부
        """
        if not self.is_available():
            return False
        
        try:
            # 특정 음성 정보 API 호출
            url = f"{self.base_url}/voices/{voice_id}"
            headers = {"xi-api-key": self.api_key}
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, headers=headers)
                return response.status_code == 200
                
        except Exception as e:
            logger.error(f"Voice ID {voice_id} 검증 실패: {e}")
            return False
    
    def _detect_korean_text(self, text: str) -> bool:
        """텍스트에 한국어가 포함되어 있는지 감지"""
        import re
        # 한글 문자 패턴 (가-힣: 완성된 한글, ㄱ-ㅎ: 자음, ㅏ-ㅣ: 모음)
        korean_pattern = re.compile(r'[가-힣ㄱ-ㅎㅏ-ㅣ]')
        korean_chars = len(korean_pattern.findall(text))
        total_chars = len(re.sub(r'[^\w]', '', text))  # 공백, 특수문자 제외
        
        # 전체 문자의 30% 이상이 한글이면 한국어 텍스트로 판단
        return korean_chars > 0 and (korean_chars / max(total_chars, 1)) >= 0.3
    
    def _get_optimal_model(self, text: str, requested_model: str = None) -> str:
        """텍스트에 따른 최적 모델 선택"""
        if requested_model:
            return requested_model
            
        if self._detect_korean_text(text):
            # 한국어 텍스트는 다국어 모델 사용
            return 'eleven_multilingual_v2'
        else:
            # 영어 텍스트는 기본 모델 사용 (더 나은 품질)
            return 'eleven_multilingual_v2'  # 호환성을 위해 다국어 모델 사용
    
    async def validate_voice_ids(self) -> Dict[str, bool]:
        """
        현재 매핑된 모든 Voice ID들이 ElevenLabs API에서 유효한지 검증
        
        Returns:
            Dict[str, bool]: 음성명 -> 유효성 매핑
        """
        if not self.is_available():
            logger.error("ElevenLabs API를 사용할 수 없습니다")
            return {}
        
        validation_results = {}
        
        try:
            # ElevenLabs 음성 목록 API 호출
            url = f"{self.base_url}/voices"
            headers = {"xi-api-key": self.api_key}
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=headers)
                
                if response.status_code == 200:
                    voices_data = response.json()
                    valid_voice_ids = {voice['voice_id'] for voice in voices_data.get('voices', [])}
                    
                    # 현재 매핑된 모든 Voice ID 검증
                    for voice_name, voice_id in self.voice_map.items():
                        is_valid = voice_id in valid_voice_ids
                        validation_results[voice_name] = is_valid
                        
                        if is_valid:
                            logger.info(f"✅ Voice ID 유효: {voice_name} -> {voice_id}")
                        else:
                            logger.error(f"❌ Voice ID 무효: {voice_name} -> {voice_id}")
                    
                    return validation_results
                else:
                    logger.error(f"ElevenLabs voices API 오류: {response.status_code}")
                    return {}
                    
        except Exception as e:
            logger.error(f"Voice ID 검증 실패: {e}")
            return {}
    
    async def get_available_voices_from_api(self) -> List[Dict[str, Any]]:
        """
        ElevenLabs API에서 실제 사용 가능한 음성 목록을 가져옴
        
        Returns:
            List[Dict]: 음성 정보 리스트
        """
        if not self.is_available():
            logger.error("ElevenLabs API를 사용할 수 없습니다")
            return []
        
        try:
            url = f"{self.base_url}/voices"
            headers = {"xi-api-key": self.api_key}
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=headers)
                
                if response.status_code == 200:
                    voices_data = response.json()
                    voices = []
                    
                    for voice in voices_data.get('voices', []):
                        voices.append({
                            'voice_id': voice['voice_id'],
                            'name': voice['name'],
                            'description': voice.get('description', ''),
                            'category': voice.get('category', 'general'),
                            'language': voice.get('language', 'en'),
                            'gender': voice.get('labels', {}).get('gender', 'unknown'),
                            'accent': voice.get('labels', {}).get('accent', 'unknown'),
                            'use_case': voice.get('labels', {}).get('use case', 'general')
                        })
                    
                    logger.info(f"ElevenLabs API에서 {len(voices)}개 음성 로드 완료")
                    return voices
                else:
                    logger.error(f"ElevenLabs voices API 오류: {response.status_code}")
                    return []
                    
        except Exception as e:
            logger.error(f"API 음성 목록 가져오기 실패: {e}")
            return []
    
    async def generate_speech(
        self, 
        text: str, 
        voice: str = 'rachel',
        model_id: str = 'eleven_multilingual_v2',
        stability: float = 0.5,
        similarity_boost: float = 0.8,
        style: float = 0.0,
        use_speaker_boost: bool = True,
        output_format: str = 'mp3'
    ) -> Optional[bytes]:
        """
        ElevenLabs API를 사용하여 음성 생성
        
        Args:
            text (str): 변환할 텍스트
            voice (str): 음성 이름
            model_id (str): ElevenLabs 모델 ID
            stability (float): 안정성 (0-1)
            similarity_boost (float): 유사성 부스트 (0-1)
            style (float): 스타일 강도 (0-1)
            use_speaker_boost (bool): 스피커 부스트 사용 여부
            output_format (str): 출력 형식
            
        Returns:
            bytes: 생성된 오디오 데이터 또는 None
        """
        if not self.is_available():
            logger.error("ElevenLabs API를 사용할 수 없습니다")
            return None
        
        if not text or not text.strip():
            logger.error("텍스트가 비어있습니다")
            return None
        
        # 텍스트 길이 제한 (ElevenLabs: 5000자)
        if len(text) > 5000:
            logger.warning(f"텍스트 길이 ({len(text)})가 제한(5000자)을 초과하여 잘립니다")
            text = text[:5000]
        
        voice_id = self._get_voice_id(voice)
        url = f"{self.base_url}/text-to-speech/{voice_id}"
        
        # 텍스트에 따른 최적 모델 선택
        optimal_model = self._get_optimal_model(text, model_id)
        is_korean = self._detect_korean_text(text)
        
        logger.info(f"ElevenLabs TTS 생성 시작: voice={voice} → voice_id={voice_id}, model={optimal_model}, korean={is_korean}")
        
        # 음성 성별 확인을 위한 추가 로깅
        voice_gender_info = {
            # 한국 배우 남성 음성
            'jinseonkyu': 'Korean Male Actor (Jin Seon-kyu)',
            'parkchangwook': 'Korean Male Actor (Park Chang-wook)',
            # 한국 배우 여성 음성
            'kimtaeri': 'Korean Female Actress (Kim Tae-ri)',
            'kimminjeong': 'Korean Female Actress (Kim Min-jeong)',
            'aneunjin': 'Korean Female Actress (Ahn Eun-jin)',
            'jiyoung': 'JiYoung (활기찬 젊은 여성 음성)',
            # 다국어 음성
            'charlie': 'Australian Male',
            'liam': 'American Male',
            'daniel': 'British Male',
            'matilda': 'Female (Warm)',
            'jeremy': 'American Male',
            'rachel': 'American Female',
            'bella': 'American Female'
        }
        
        if voice.lower() in voice_gender_info:
            logger.info(f"음성 정보: {voice} = {voice_gender_info[voice.lower()]}")
        
        # 요청 데이터 구성
        data = {
            "text": text,
            "model_id": optimal_model,
            "voice_settings": {
                "stability": max(0, min(1, stability)),
                "similarity_boost": max(0, min(1, similarity_boost)),
                "style": max(0, min(1, style)),
                "use_speaker_boost": use_speaker_boost
            }
        }
        
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": self.api_key
        }
        
        try:
            logger.info(f"ElevenLabs TTS 요청 시작 - 음성: {voice}, 모델: {model_id}")
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=data, headers=headers)
                
                if response.status_code == 200:
                    audio_data = response.content
                    logger.info(f"ElevenLabs TTS 생성 성공: {len(audio_data)} bytes")
                    return audio_data
                else:
                    error_msg = response.text if response.text else f"HTTP {response.status_code}"
                    logger.error(f"ElevenLabs API 오류: {error_msg}")
                    return None
                    
        except httpx.TimeoutException:
            logger.error("ElevenLabs API 요청 시간 초과")
            return None
        except Exception as e:
            logger.error(f"ElevenLabs TTS 생성 실패: {e}")
            return None
    
    def get_available_voices(self) -> list:
        """사용 가능한 음성 목록 반환 (검증된 음성만)"""
        return [
            # 한국 배우 음성
            {"id": "kimtaeri", "name": "김태리", "gender": "female", "accent": "Korean"},
            {"id": "kimminjeong", "name": "김민정", "gender": "female", "accent": "Korean"},
            {"id": "jinseonkyu", "name": "진선규", "gender": "male", "accent": "Korean"},
            {"id": "parkchangwook", "name": "박창욱", "gender": "male", "accent": "Korean"},
            {"id": "aneunjin", "name": "안은진", "gender": "female", "accent": "Korean"},
            {"id": "jiyoung", "name": "JiYoung", "gender": "female", "accent": "Korean"},
            # 다국어 음성 (검증된 것만)
            {"id": "charlie", "name": "Charlie", "gender": "male", "accent": "Australian"},
            {"id": "liam", "name": "Liam", "gender": "male", "accent": "American"},
            {"id": "daniel", "name": "Daniel", "gender": "male", "accent": "British"},
            {"id": "matilda", "name": "Matilda", "gender": "female", "accent": "English"},
            {"id": "jeremy", "name": "Jeremy", "gender": "male", "accent": "American"},
            {"id": "rachel", "name": "Rachel", "gender": "female", "accent": "American"},
            {"id": "bella", "name": "Bella", "gender": "female", "accent": "American"}
        ]
    
    def get_available_models(self) -> list:
        """사용 가능한 모델 목록 반환"""
        return [
            {"id": "eleven_multilingual_v2", "name": "Multilingual v2", "description": "최신 다국어 모델"},
            {"id": "eleven_monolingual_v1", "name": "Monolingual v1", "description": "영어 전용 최적화"},
            {"id": "eleven_turbo_v2", "name": "Turbo v2", "description": "고속 생성"},
            {"id": "eleven_multilingual_v1", "name": "Multilingual v1", "description": "구버전 다국어"}
        ]

# 전역 ElevenLabs 서비스 인스턴스
elevenlabs_service = ElevenLabsService()