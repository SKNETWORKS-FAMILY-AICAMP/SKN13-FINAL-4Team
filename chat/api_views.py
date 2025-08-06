# chat/api_views.py
import json
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .ai_service import ai_service
from .tts_service import tts_service
import logging
import asyncio

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
    """TTS API 엔드포인트"""
    async def async_handler():
        try:
            # UTF-8 인코딩 처리
            body_unicode = request.body.decode('utf-8')
            data = json.loads(body_unicode)
            text = data.get('text', '')
            voice = data.get('voice', 'nova')
            speed = float(data.get('speed', 1.0))
            output_format = data.get('format', 'mp3')
            
            if not text:
                return JsonResponse({'error': 'Text is required'}, status=400)
            
            # 음성 파라미터 검증
            if voice not in ['nova', 'alloy', 'echo', 'fable', 'onyx', 'shimmer']:
                voice = 'nova'
            
            if not (0.25 <= speed <= 4.0):
                speed = 1.0
                
            if output_format not in ['mp3', 'opus', 'aac', 'flac']:
                output_format = 'mp3'
            
            logger.info(f"TTS API 요청: {text[:50]}... (voice: {voice}, speed: {speed})")
            
            # TTS 생성
            audio_data = await tts_service.generate_speech(text, voice, speed, output_format)
            
            if audio_data:
                # Content-Type 설정
                content_types = {
                    'mp3': 'audio/mpeg',
                    'opus': 'audio/opus',
                    'aac': 'audio/aac',
                    'flac': 'audio/flac'
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
                    'error': 'TTS 생성에 실패했습니다'
                }, status=500)
                
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except ValueError as e:
            return JsonResponse({'error': f'Invalid parameter: {e}'}, status=400)
        except Exception as e:
            logger.error(f"TTS API 오류: {e}")
            return JsonResponse({'error': 'Internal server error'}, status=500)
    
    return asyncio.run(async_handler())