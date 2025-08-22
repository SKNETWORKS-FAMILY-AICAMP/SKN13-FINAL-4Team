# chat/status_views.py
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
# OpenAI TTS 서비스 제거됨
import logging

# MeloTTS는 선택적 import
try:
    from .melotts_service import melotts_service
    MELOTTS_AVAILABLE = True
except ImportError:
    melotts_service = None
    MELOTTS_AVAILABLE = False

# ElevenLabs는 선택적 import
try:
    from .elevenlabs_service import elevenlabs_service
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
        
        # OpenAI TTS 제거됨
        
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
        
        # MeloTTS 상태 확인
        if MELOTTS_AVAILABLE and melotts_service:
            try:
                melo_available = melotts_service.is_available()
                status['melotts'] = {
                    'available': melo_available,
                    'name': 'MeloTTS',
                    'description': '다국어 지원, CPU 실시간 추론'
                }
            except Exception as e:
                logger.warning(f"MeloTTS 상태 확인 실패: {e}")
                status['melotts'] = {
                    'available': False,
                    'name': 'MeloTTS', 
                    'description': '라이브러리 오류'
                }
        else:
            status['melotts'] = {
                'available': False,
                'name': 'MeloTTS',
                'description': '설치되지 않음'
            }
        
        logger.info(f"TTS 상태 확인 - ElevenLabs: {status['elevenlabs']['available']}, MeloTTS: {status['melotts']['available']}")
        
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