# chat/api_views.py
import json
import logging
import asyncio
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .ai_service import ai_service

# ElevenLabs TTS 서비스 (기본 엔진)
try:
    from .elevenlabs_service import elevenlabs_service
    ELEVENLABS_AVAILABLE = True
except ImportError:
    elevenlabs_service = None
    ELEVENLABS_AVAILABLE = False
    print("ElevenLabs 서비스를 사용할 수 없습니다.")

# MeloTTS는 선택사항으로 처리
try:
    from .melotts_service import melotts_service
    MELOTTS_AVAILABLE = True
except ImportError:
    melotts_service = None
    MELOTTS_AVAILABLE = False
    print("MeloTTS 서비스를 사용할 수 없습니다. 필요시 'pip install git+https://github.com/myshell-ai/MeloTTS.git' 실행")

logger = logging.getLogger(__name__)

@csrf_exempt
@require_http_methods(["POST"])
def ai_chat_api(request):
    """AI 채팅 API 엔드포인트"""
    async def async_handler():
        try:
            # UTF-8 인코딩 처리
            body_unicode = request.body.decode('utf-8')
            data = json.loads(body_unicode)
            message = data.get('message', '')
            conversation_history = data.get('conversation_history', [])
            
            if not message:
                return JsonResponse({'error': 'Message is required'}, status=400)
            
            logger.info(f"AI 채팅 API 요청: {message[:50]}...")
            
            # AI 응답 생성
            response = await ai_service.generate_response(message, conversation_history)
            
            if response:
                return JsonResponse({
                    'success': True,
                    'response': response
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'AI 응답 생성에 실패했습니다'
                }, status=500)
                
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            logger.error(f"AI 채팅 API 오류: {e}")
            return JsonResponse({'error': 'Internal server error'}, status=500)
    
    return asyncio.run(async_handler())

@csrf_exempt
@require_http_methods(["POST"])
def tts_api(request):
    """TTS API 엔드포인트 - ElevenLabs, MeloTTS, Coqui 지원"""
    async def async_handler():
        try:
            # UTF-8 인코딩 처리
            body_unicode = request.body.decode('utf-8')
            data = json.loads(body_unicode)
            text = data.get('text', '')
            engine = data.get('engine', 'elevenlabs')  # 엔진 선택 (elevenlabs, melotts, coqui)
            voice = data.get('voice', 'aneunjin' if engine == 'elevenlabs' else 'default')
            speed = float(data.get('speed', 1.0))
            output_format = data.get('format', 'mp3')
            language = data.get('language', None)  # MeloTTS용 언어 파라미터
            
            if not text:
                return JsonResponse({'error': 'Text is required'}, status=400)
            
            logger.info(f"TTS API 요청: {text[:50]}... (engine: {engine}, voice: {voice}, speed: {speed})")
            
            # 엔진별 처리
            if engine == 'elevenlabs':
                # ElevenLabs TTS 사용
                if not ELEVENLABS_AVAILABLE or not elevenlabs_service.is_available():
                    return JsonResponse({
                        'success': False,
                        'error': 'ElevenLabs API 키가 설정되지 않았습니다.'
                    }, status=503)
                
                # ElevenLabs 파라미터 검증 및 추출
                model_id = data.get('model_id', 'eleven_multilingual_v2')
                stability = float(data.get('stability', 0.5))
                similarity_boost = float(data.get('similarity_boost', 0.8))
                style = float(data.get('style', 0.0))
                use_speaker_boost = data.get('use_speaker_boost', True)
                
                # ElevenLabs 음성 옵션 검증 (한국 배우 음성 포함)
                valid_elevenlabs_voices = [
                    # 한국 배우 음성
                    'kimtaeri', 'kimminjeong', 'jinseonkyu', 'parkchangwook', 'aneunjin',
                    # 다국어 음성
                    'charlie', 'liam', 'charlotte', 'daniel', 'james', 'joseph', 'jeremy',
                    # 영어 음성 (기본)
                    'rachel', 'domi', 'bella', 'antoni', 'elli', 'josh', 'arnold', 'adam', 'sam'
                ]
                if voice not in valid_elevenlabs_voices:
                    voice = 'aneunjin'  # 기본값을 안은진 배우 음성으로 변경
                
                # ElevenLabs로 생성
                audio_data = await elevenlabs_service.generate_speech(
                    text=text,
                    voice=voice,
                    model_id=model_id,
                    stability=stability,
                    similarity_boost=similarity_boost,
                    style=style,
                    use_speaker_boost=use_speaker_boost,
                    output_format=output_format
                )
                
            elif engine == 'melotts':
                # MeloTTS 사용
                if not MELOTTS_AVAILABLE:
                    return JsonResponse({
                        'success': False,
                        'error': 'MeloTTS가 설치되지 않았습니다. OpenAI TTS를 사용해주세요.'
                    }, status=503)
                
                # MeloTTS 음성 옵션 검증
                valid_melo_voices = ['default', 'female', 'male', 'child', 'british', 'indian', 'australian']
                if voice not in valid_melo_voices:
                    voice = 'default'
                
                # MeloTTS 속도 범위: 0.5 ~ 2.0
                if not (0.5 <= speed <= 2.0):
                    speed = 1.0
                
                # MeloTTS로 생성
                audio_data = await melotts_service.generate_speech(
                    text=text,
                    voice=voice,
                    speed=speed,
                    output_format=output_format,
                    language=language
                )
            else:
                # 지원하지 않는 엔진
                return JsonResponse({
                    'success': False,
                    'error': f'지원하지 않는 TTS 엔진: {engine}'
                }, status=400)
            
            if audio_data:
                # Content-Type 설정
                content_types = {
                    'mp3': 'audio/mpeg',
                    'opus': 'audio/opus',
                    'aac': 'audio/aac',
                    'flac': 'audio/flac',
                    'wav': 'audio/wav'
                }
                
                response = HttpResponse(
                    audio_data, 
                    content_type=content_types.get(output_format, 'audio/mpeg')
                )
                response['Content-Disposition'] = f'attachment; filename="speech.{output_format}"'
                return response
            else:
                return JsonResponse({
                    'success': False,
                    'error': f'{engine.upper()} TTS 생성에 실패했습니다'
                }, status=500)
                
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except ValueError as e:
            return JsonResponse({'error': f'Invalid parameter: {e}'}, status=400)
        except Exception as e:
            logger.error(f"TTS API 오류: {e}")
            return JsonResponse({'error': 'Internal server error'}, status=500)
    
    return asyncio.run(async_handler())