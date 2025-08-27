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
import json
from typing import Dict, Any, Optional, Tuple, List
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
    
    async def generate_tracks_with_cancellation(self, request_data: Dict, cancel_event: 'asyncio.Event') -> Optional[List]:
        """
        취소 가능한 MediaTrack 생성 (StreamSession Queue 시스템 용)
        
        Args:
            request_data: 요청 데이터 (message, streamer_config 등)
            cancel_event: 취소 이벤트 (set되면 작업 중단)
            
        Returns:
            List[MediaTrack] or None: 생성된 트랙들 또는 취소 시 None
        """
        try:
            text = request_data.get('message', '')
            streamer_config = request_data.get('streamer_config', {})
            emotion = self._extract_emotion_from_text(text)
            
            logger.info(f"🎬 취소 가능한 MediaTrack 생성 시작: {text[:30]}... (감정: {emotion})")
            
            # AI 응답 생성 (최우선)
            from .llm_text_service import ai_service
            system_prompt = f"당신은 '{streamer_config.get('streamer_id', 'AI')}' 스트리밍의 AI 어시스턴트입니다. 시청자의 질문에 2-3줄로 간결하고 친근하게 답하세요. 응답 끝에 감정을 [emotion:happy], [emotion:sad], [emotion:neutral] 등의 형태로 추가하세요."
            conversation_history = [{"role": "system", "content": system_prompt}]
            
            ai_response = await ai_service.generate_response(text, conversation_history)
            if not ai_response or cancel_event.is_set():
                logger.info("🚫 AI 응답 생성 중 취소됨")
                return None
                
            # 감정 재추출 (AI 응답 기반)
            emotion = self._extract_emotion_from_response(ai_response)
            clean_response = self._clean_emotion_tags(ai_response)
            
            # 병렬 MediaTrack 생성 (취소 가능) - 코루틴을 Task로 변환
            tasks = [
                asyncio.create_task(self._create_audio_track_cancellable(clean_response, streamer_config, cancel_event)),
                asyncio.create_task(self._create_video_track_cancellable(emotion, streamer_config, cancel_event)),
                asyncio.create_task(self._create_subtitle_track_cancellable(clean_response, cancel_event))
            ]
            
            # 모든 MediaTrack 작업 완료 대기 (취소 체크와 함께)
            cancel_task = asyncio.create_task(cancel_event.wait())
            all_tasks = tasks + [cancel_task]
            
            done, pending = await asyncio.wait(all_tasks, return_when=asyncio.FIRST_COMPLETED)
            
            # 취소 이벤트가 먼저 완료된 경우
            if cancel_event.is_set():
                # 취소됨 - 모든 대기 중인 작업들 정리
                for task in tasks:
                    if not task.done():
                        task.cancel()
                logger.info("🚫 MediaTrack 생성이 취소되었습니다")
                return None
            
            # 취소되지 않았다면 모든 MediaTrack 작업 완료까지 대기
            cancel_task.cancel()  # 취소 태스크 정리
            
            # 남은 MediaTrack 작업들 완료 대기
            done, pending = await asyncio.wait(tasks, return_when=asyncio.ALL_COMPLETED)
            
            # 추가 취소 체크
            if cancel_event.is_set():
                logger.info("🚫 MediaTrack 생성 중 취소됨")
                return None
                
            # 완료된 트랙들 수집
            tracks = []
            for i, task in enumerate(tasks):
                task_name = ['audio', 'video', 'subtitle'][i]  # 순서대로 이름 매핑
                
                if task.done() and not task.cancelled():
                    try:
                        track = await task
                        if track:
                            tracks.append(track)
                            logger.info(f"✅ {task_name} 트랙 생성 성공: {track.kind}, {track.payload_ref[:50]}...")
                        else:
                            logger.warning(f"⚠️ {task_name} 트랙 생성 결과 None")
                    except Exception as e:
                        logger.warning(f"⚠️ {task_name} 트랙 생성 실패: {e}")
                else:
                    if task.cancelled():
                        logger.info(f"🚫 {task_name} 트랙 작업 취소됨")
                    else:
                        logger.warning(f"⚠️ {task_name} 트랙 작업 미완료")
                        
            if tracks:
                track_kinds = [t.kind for t in tracks]
                logger.info(f"✅ MediaTrack 생성 완료: {len(tracks)}개 트랙 ({', '.join(track_kinds)})")
                return tracks
            else:
                logger.warning("⚠️ 생성된 MediaTrack가 없습니다")
                return None
                
        except asyncio.CancelledError:
            logger.info("🚫 MediaTrack 생성 작업이 취소됨")
            return None
        except Exception as e:
            logger.error(f"❌ MediaTrack 생성 실패: {str(e)}")
            return None
    
    async def _create_audio_track_cancellable(self, text: str, streamer_config: Dict, cancel_event: 'asyncio.Event'):
        """취소 가능한 오디오 트랙 생성"""
        try:
            if cancel_event.is_set():
                logger.info("🚫 오디오 트랙 생성 시작 전 취소됨")
                return None
                
            logger.info(f"🎵 오디오 트랙 생성 시작: {text[:30]}...")
            
            # TTS 생성 (기존 로직 활용)
            tts_result = await self._generate_tts_async(text, streamer_config)
            logger.info(f"🔊 TTS 결과: {tts_result.get('audio_url', 'NO_URL')[:50]}..., 길이: {tts_result.get('duration', 0)}초")
            
            if cancel_event.is_set():
                logger.info("🚫 오디오 트랙 TTS 생성 후 취소됨")
                return None
                
            # StreamSession.MediaTrack 임포트
            from .streaming.domain.stream_session import MediaTrack
            
            duration_ms = int(tts_result['duration'] * 1000)
            
            audio_track = MediaTrack(
                kind="audio",
                pts_ms=0,  # 즉시 시작
                dur_ms=duration_ms,
                payload_ref=tts_result['audio_url'],
                codec="audio/mpeg",
                meta={
                    'engine': tts_result['tts_info']['engine'],
                    'voice': tts_result['tts_info'].get('voice'),
                    'file_size': tts_result['tts_info'].get('file_size', 0),
                    'emotion': streamer_config.get('emotion', 'neutral')
                }
            )
            
            logger.info(f"✅ 오디오 MediaTrack 생성 성공: {audio_track.payload_ref[:50]}...")
            return audio_track
            
        except Exception as e:
            if not cancel_event.is_set():
                logger.error(f"❌ 오디오 트랙 생성 실패: {e}")
            return None
    
    async def _create_video_track_cancellable(self, emotion: str, streamer_config: Dict, cancel_event: 'asyncio.Event'):
        """취소 가능한 비디오 트랙 생성"""
        try:
            if cancel_event.is_set():
                return None
                
            character_id = streamer_config.get('streamer_id', 'jammin-i')
            talk_video = self.video_selector.get_talk_video(emotion, character_id)
            
            if cancel_event.is_set():
                return None
                
            from .streaming.domain.stream_session import MediaTrack
            
            return MediaTrack(
                kind="video",
                pts_ms=0,  # 즉시 시작
                dur_ms=5000,  # 기본 5초 (TTS 길이에 맞춤)
                payload_ref=talk_video,
                codec="video/mp4",
                meta={
                    'emotion': emotion,
                    'character_id': character_id,
                    'clip_type': 'talk'
                }
            )
            
        except Exception as e:
            if not cancel_event.is_set():
                logger.error(f"❌ 비디오 트랙 생성 실패: {e}")
            return None
    
    async def _create_subtitle_track_cancellable(self, text: str, cancel_event: 'asyncio.Event'):
        """취소 가능한 자막 트랙 생성"""
        try:
            if cancel_event.is_set():
                return None
                
            # 자막 타이밍 생성 (빠른 작업)
            subtitle_data = self._generate_subtitle_timing(text, 3.0)  # 기본 3초
            
            if cancel_event.is_set():
                return None
                
            from .streaming.domain.stream_session import MediaTrack
            
            return MediaTrack(
                kind="subtitle",
                pts_ms=0,  # 즉시 시작
                dur_ms=int(subtitle_data['total_duration'] * 1000),
                payload_ref=json.dumps(subtitle_data),  # JSON 문자열로 저장
                codec="text/json",
                meta=subtitle_data
            )
            
        except Exception as e:
            if not cancel_event.is_set():
                logger.error(f"❌ 자막 트랙 생성 실패: {e}")
            return None
    
    def _extract_emotion_from_text(self, text: str) -> str:
        """텍스트에서 간단한 감정 추출"""
        text_lower = text.lower()
        if any(word in text_lower for word in ['행복', 'happy', '좋아', '기뻐', '웃음', '😊', '😄']):
            return 'happy'
        elif any(word in text_lower for word in ['슬퍼', 'sad', '우울', '😢', '😭']):
            return 'sad'
        elif any(word in text_lower for word in ['화나', 'angry', '짜증', '😠', '😡']):
            return 'angry'
        elif any(word in text_lower for word in ['놀라', 'surprised', '깜짝', '😱', '😲']):
            return 'surprised'
        else:
            return 'neutral'
    
    
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
    
    def _extract_emotion_from_response(self, response: str) -> str:
        """AI 응답에서 감정 태그 추출"""
        import re
        emotion_match = re.search(r'\[emotion:(\w+)\]', response)
        if emotion_match:
            return emotion_match.group(1).lower()
        return 'neutral'  # 기본값
    
    def _clean_emotion_tags(self, text: str) -> str:
        """텍스트에서 감정 태그 제거"""
        import re
        # [emotion:감정] 형태의 태그 제거
        cleaned = re.sub(r'\[emotion:\w+\]', '', text)
        # 앞뒤 공백 제거
        return cleaned.strip()