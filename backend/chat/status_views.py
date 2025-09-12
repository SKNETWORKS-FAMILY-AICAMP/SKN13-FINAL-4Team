# chat/status_views.py
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import logging

# ElevenLabs import
try:
    from .tts_elevenlabs_service import elevenlabs_service
    ELEVENLABS_AVAILABLE = True
except ImportError:
    elevenlabs_service = None
    ELEVENLABS_AVAILABLE = False

logger = logging.getLogger(__name__)

@csrf_exempt
@require_http_methods(["GET"])
def tts_status_api(request):
    """TTS 엔진 상태 확인 API 엔드포인트"""
    try:
        status = {}
        
        # ElevenLabs TTS 상태 확인
        if ELEVENLABS_AVAILABLE and elevenlabs_service:
            try:
                elevenlabs_available = elevenlabs_service.is_available()
                status['elevenlabs'] = {
                    'available': elevenlabs_available,
                    'name': 'ElevenLabs',
                    'description': '초고품질 음성, 자연스러운 억양'
                }
            except Exception as e:
                logger.warning(f"ElevenLabs 상태 확인 실패: {e}")
                status['elevenlabs'] = {
                    'available': False,
                    'name': 'ElevenLabs', 
                    'description': '설정 오류'
                }
        else:
            status['elevenlabs'] = {
                'available': False,
                'name': 'ElevenLabs',
                'description': 'API 키가 설정되지 않음'
            }
        
        logger.info(f"TTS 상태 확인 - ElevenLabs: {status['elevenlabs']['available']}")
        
        return JsonResponse({
            'success': True,
            'engines': status
        })
        
    except Exception as e:
        logger.error(f"TTS 상태 확인 오류: {e}")
        return JsonResponse({
            'success': False,
            'error': 'TTS 상태 확인 중 오류가 발생했습니다'
        }, status=500)