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
            engine = data.get('engine', 'elevenlabs')  # ElevenLabs 전용
            voice = data.get('voice', 'aneunjin')
            speed = float(data.get('speed', 1.0))
            output_format = data.get('format', 'mp3')
            
            if not text:
                return JsonResponse({'error': 'Text is required'}, status=400)
            
            logger.info(f"TTS API 요청: {text[:50]}... (engine: {engine}, voice: {voice}, speed: {speed})")
            
            # ElevenLabs TTS 전용 처리
            if engine != 'elevenlabs':
                return JsonResponse({
                    'success': False,
                    'error': 'ElevenLabs TTS만 지원됩니다.'
                }, status=400)
                
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
                    'error': 'ElevenLabs TTS 생성에 실패했습니다'
                }, status=500)
                
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except ValueError as e:
            return JsonResponse({'error': f'Invalid parameter: {e}'}, status=400)
        except Exception as e:
            logger.error(f"TTS API 오류: {e}")
            return JsonResponse({'error': 'Internal server error'}, status=500)
    
    return asyncio.run(async_handler())