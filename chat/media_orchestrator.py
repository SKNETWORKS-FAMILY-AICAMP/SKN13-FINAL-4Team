"""
AI 인플루언서 미디어 처리 허브
텍스트, TTS, 비디오를 통합 처리하여 동기화된 브로드캐스팅 패킷을 생성
DDD 아키텍처 기반 StreamSession 사용
"""
import time
import uuid
import asyncio
import logging
import base64
from typing import Dict, Any, Optional, Tuple
from datetime import datetime
from django.conf import settings
from django.core.cache import cache
import openai
import requests
from .video_manager import VideoSelector
from .streaming.domain.stream_session import StreamSession, MediaTrack, MediaPacket

logger = logging.getLogger(__name__)

class MediaProcessingHub:
    """미디어 처리 허브 - TTS, 비디오, 자막을 통합 처리 (DDD 기반 StreamSession 사용)"""
    
    def __init__(self):
        self.video_selector = VideoSelector()
        self.processing_cache = {}  # 중복 처리 방지용 캐시
        self.sessions: Dict[str, StreamSession] = {}  # 룸별 세션 관리
        
    async def process_ai_response(self, text: str, streamer_config: Dict, room_name: str, emotion: str = 'neutral') -> Dict[str, Any]:
        """
        AI 응답을 통합 처리하여 동기화된 미디어 패킷 생성 (단순화된 버전)
        
        Args:
            text: AI 응답 텍스트
            streamer_config: 스트리머 설정 (음성 등)
            room_name: 방송 룸 이름
            emotion: LLM에서 제공한 감정 (기본값: neutral)
            
        Returns:
            동기화된 미디어 패킷
        """
        try:
            process_start = time.time()
            sync_id = uuid.uuid4().hex
            
            logger.info(f"🎬 미디어 처리 시작: {sync_id[:8]} - {text[:50]}... (감정: {emotion})")
            
            # 1. 캐시 확인 (디버깅을 위해 임시 비활성화)
            cache_key = f"media_process_{hash(text)}_{emotion}"
            # cached_result = cache.get(cache_key)
            # if cached_result:
            #     logger.info(f"📦 캐시된 결과 사용: {sync_id[:8]}")
            #     cached_result['sync_id'] = sync_id
            #     return cached_result
            
            # 2. TTS 생성
            tts_result = await self._generate_tts_async(text, streamer_config)
            
            # 3. 비디오 클립 선택 (talk 비디오) - 캐릭터 ID 기반
            character_id = streamer_config.get('character_id', 'jammin-i')  # 기본값 설정
            talk_video = self.video_selector.get_talk_video(emotion, character_id)
            idle_video = self.video_selector.get_idle_video(emotion, character_id)
            
            # 4. 자막 타이밍 생성
            subtitle_timing = self._generate_subtitle_timing(text, tts_result['duration'])
            
            # 5. 동기화 패킷 생성
            sync_packet = {
                'sync_id': sync_id,
                'timestamp': time.time(),
                'room_name': room_name,
                'content': {
                    'text': text,
                    'audio_url': tts_result['audio_url'],
                    'audio_duration': tts_result['duration'],
                    'talk_video': talk_video,
                    'idle_video': idle_video,
                    'emotion': emotion,
                    'subtitle_timing': subtitle_timing,
                    'tts_info': tts_result.get('tts_info', {}),
                    'video_sequence': {
                        'start_state': 'talk',  # TTS 시작 시 talk 비디오
                        'end_state': 'idle',    # TTS 완료 후 idle 비디오
                        'talk_duration': tts_result['duration']
                    }
                },
                'sync_timing': {
                    'broadcast_delay': 0.5,  # 500ms 버퍼링
                    'processing_time': time.time() - process_start,
                    'scheduled_start': time.time() + 0.5,
                    'idle_return_delay': tts_result['duration'] + 1.0  # TTS 완료 1초 후 idle 복귀
                },
                'metadata': {
                    'streamer_id': streamer_config.get('streamer_id'),
                    'voice_settings': streamer_config.get('voice_settings', {}),
                    'created_at': datetime.now().isoformat(),
                    'system_version': 'simple_idle_talk'
                }
            }
            
            # 6. 결과 캐싱 (10분간)
            cache.set(cache_key, sync_packet, 600)
            
            logger.info(f"✅ 미디어 처리 완료: {sync_id[:8]} ({sync_packet['sync_timing']['processing_time']:.2f}s)")
            logger.info(f"   Talk 비디오: {talk_video}, Idle 복귀: {idle_video}")
            
            return sync_packet
            
        except Exception as e:
            logger.error(f"❌ 미디어 처리 실패: {str(e)}")
            return self._create_error_packet(text, str(e), room_name)
    
    
    async def _generate_tts_async(self, text: str, streamer_config: Dict) -> Dict[str, Any]:
        """TTS 생성 (비동기)"""
        logger.info(f"🔊 TTS 생성 시작: {text[:30]}...")
        voice_settings = streamer_config.get('voice_settings', {})
        engine = voice_settings.get('engine', 'elevenlabs')
        logger.info(f"🔊 TTS 엔진: {engine}, 설정: {voice_settings}")
        
        if engine == 'elevenlabs':
            return await self._generate_elevenlabs_tts(text, voice_settings)
        elif engine == 'openai':
            return await self._generate_openai_tts(text, voice_settings)
        else:
            # 기본값: ElevenLabs
            return await self._generate_elevenlabs_tts(text, voice_settings)
    
    async def _generate_elevenlabs_tts(self, text: str, voice_settings: Dict) -> Dict[str, Any]:
        """ElevenLabs TTS 생성"""
        try:
            logger.info(f"🎤 ElevenLabs TTS 호출 시작: {text[:30]}...")
            api_key = settings.ELEVENLABS_API_KEY
            if not api_key:
                logger.error("❌ ElevenLabs API key not configured")
                raise ValueError("ElevenLabs API key not configured")
            
            # 프론트엔드 설정 키 매핑 처리
            voice_id = voice_settings.get('voice_id') or voice_settings.get('elevenLabsVoice', 'aneunjin')
            logger.info(f"🎵 선택된 음성: {voice_id}")
            
            # 음성 설정 매핑 (tts_elevenlabs_service.py와 동일하게 통일)
            voice_map = {
                'kimtaeri': '6ZND2SlfJqI0OOEHe2by',    # 김태리 (한국 여성 배우)
                'kimminjeong': 'eTiuJAsb9mqCyH5gFsS9', # 김민정 (한국 여성 배우)  
                'jinseonkyu': 'pWPHfY5KntyWbx2FxSb7', # 진선규 (한국 남성 배우)
                'parkchangwook': 'RQVmMEdMMcmOuv6Fz268', # 박창욱 (한국 남성 배우)
                'aneunjin': 'pRxVZ0v1oH2CqQJWHAty',  # 안은진 (한국 여성 배우)
                'jiyoung': 'AW5wrnG1jVizOYY7R1Oo'     # JiYoung (활기찬 젊은 여성 음성) - 올바른 여성 Voice ID
            }
            
            actual_voice_id = voice_map.get(voice_id, voice_map['aneunjin'])
            
            url = f"https://api.elevenlabs.io/v1/text-to-speech/{actual_voice_id}"
            
            headers = {
                "Accept": "audio/mpeg",
                "Content-Type": "application/json",
                "xi-api-key": api_key
            }
            
            # 프론트엔드 설정 키 매핑
            model_id = voice_settings.get('model_id') or voice_settings.get('elevenLabsModel', 'eleven_multilingual_v2')
            stability = voice_settings.get('stability') or voice_settings.get('elevenLabsStability', 0.75)
            similarity = voice_settings.get('similarity_boost') or voice_settings.get('elevenLabsSimilarity', 0.85)
            style = voice_settings.get('style') or voice_settings.get('elevenLabsStyle', 0.0)
            speaker_boost = voice_settings.get('use_speaker_boost') 
            if speaker_boost is None:
                speaker_boost = voice_settings.get('elevenLabsSpeakerBoost', True)
            
            logger.info(f"🎛️ TTS 파라미터: model={model_id}, stability={stability}, similarity={similarity}")
            
            data = {
                "text": text,
                "model_id": model_id,
                "voice_settings": {
                    "stability": stability,
                    "similarity_boost": similarity,
                    "style": style,
                    "use_speaker_boost": speaker_boost
                }
            }
            
            # 비동기 HTTP 요청
            response = await asyncio.to_thread(requests.post, url, json=data, headers=headers)
            
            if response.status_code != 200:
                logger.error(f"❌ ElevenLabs API 응답 오류: {response.status_code}")
                raise Exception(f"ElevenLabs API error: {response.status_code}")
            
            logger.info(f"✅ ElevenLabs API 성공: {len(response.content)} bytes")
            
            # 오디오 데이터를 base64로 인코딩해서 직접 전달
            audio_base64 = base64.b64encode(response.content).decode('utf-8')
            audio_data_url = f"data:audio/mpeg;base64,{audio_base64}"
            logger.info(f"🎵 오디오 데이터 생성 완료: {len(response.content)} bytes -> base64")
            
            # 오디오 길이 추정 (실제로는 오디오 파일 분석 필요)
            estimated_duration = len(text) * 0.1  # 대략적 추정
            logger.info(f"⏱️ 추정 오디오 길이: {estimated_duration}초")
            
            return {
                'audio_url': audio_data_url,
                'duration': estimated_duration,
                'tts_info': {
                    'engine': 'elevenlabs',
                    'voice': voice_id,
                    'model': data['model_id'],
                    'file_size': len(response.content),
                    'format': 'base64_data_url'
                }
            }
            
        except Exception as e:
            logger.error(f"❌ ElevenLabs TTS 실패: {str(e)}")
            # OpenAI 폴백
            return await self._generate_openai_tts(text, voice_settings)
    
    async def _generate_openai_tts(self, text: str, voice_settings: Dict) -> Dict[str, Any]:
        """OpenAI TTS 생성 (폴백)"""
        try:
            client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            
            response = await client.audio.speech.create(
                model="tts-1-hd",
                voice=voice_settings.get('openai_voice', 'alloy'),
                input=text,
                speed=voice_settings.get('speed', 1.0)
            )
            
            # 오디오 데이터를 base64로 인코딩해서 직접 전달
            audio_base64 = base64.b64encode(response.content).decode('utf-8')
            audio_data_url = f"data:audio/mpeg;base64,{audio_base64}"
            logger.info(f"🎵 OpenAI 오디오 데이터 생성 완료: {len(response.content)} bytes -> base64")
            
            estimated_duration = len(text) * 0.08
            
            return {
                'audio_url': audio_data_url,
                'duration': estimated_duration,
                'tts_info': {
                    'engine': 'openai',
                    'voice': voice_settings.get('openai_voice', 'alloy'),
                    'model': 'tts-1-hd',
                    'fallback_used': True,
                    'format': 'base64_data_url'
                }
            }
            
        except Exception as e:
            logger.error(f"❌ OpenAI TTS 폴백 실패: {str(e)}")
            return self._create_tts_error_result(text, str(e))
    
    
    def _generate_subtitle_timing(self, text: str, duration: float) -> Dict[str, Any]:
        """자막 타이밍 생성"""
        words = text.split()
        time_per_word = duration / len(words) if words else 0
        
        subtitle_segments = []
        current_time = 0
        
        for i, word in enumerate(words):
            segment_duration = time_per_word
            subtitle_segments.append({
                'word': word,
                'start': current_time,
                'end': current_time + segment_duration,
                'index': i
            })
            current_time += segment_duration
        
        return {
            'segments': subtitle_segments,
            'total_duration': duration,
            'words_count': len(words)
        }
    
    
    def _create_error_packet(self, text: str, error: str, room_name: str) -> Dict[str, Any]:
        """에러 패킷 생성"""
        return {
            'sync_id': uuid.uuid4().hex,
            'timestamp': time.time(),
            'room_name': room_name,
            'content': {
                'text': text,
                'error': error,
                'fallback_mode': True
            },
            'sync_timing': {
                'broadcast_delay': 0,
                'processing_time': 0,
                'scheduled_start': time.time()
            },
            'metadata': {
                'error': True,
                'created_at': datetime.now().isoformat()
            }
        }
    
    def _create_tts_error_result(self, text: str, error: str) -> Dict[str, Any]:
        """TTS 에러 결과 생성"""
        return {
            'audio_url': '',
            'duration': 0,
            'tts_info': {
                'engine': 'none',
                'error': error,
                'fallback_failed': True
            }
        }