# chat/voice_validation_views.py
"""
Voice ID 검증 및 동적 음성 목록 관리를 위한 Django 뷰
"""
import asyncio
import logging
from typing import Dict, Any, List
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.core.cache import cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

# ElevenLabs 서비스 import 안전 처리
try:
    from .tts_elevenlabs_service import elevenlabs_service
    ELEVENLABS_AVAILABLE = True
except ImportError:
    elevenlabs_service = None
    ELEVENLABS_AVAILABLE = False

logger = logging.getLogger(__name__)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def validate_voice_ids(request):
    """
    현재 시스템의 모든 Voice ID 유효성 검증
    """
    try:
        # ElevenLabs 서비스 가용성 확인
        if not ELEVENLABS_AVAILABLE or not elevenlabs_service:
            return Response({
                'success': False,
                'error': 'ElevenLabs 서비스를 사용할 수 없습니다. 서비스 설정을 확인하세요.'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        
        if not elevenlabs_service.is_available():
            return Response({
                'success': False,
                'error': 'ElevenLabs API 키가 설정되지 않았거나 유효하지 않습니다.'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        
        # 캐시에서 검증 결과 확인 (1시간 유효)
        cache_key = 'elevenlabs_voice_validation'
        cached_result = cache.get(cache_key)
        
        if cached_result:
            logger.info("캐시된 Voice ID 검증 결과 반환")
            return Response(cached_result)
        
        # 비동기 함수 실행 (Django 호환 방식)
        def run_async_task():
            new_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(new_loop)
            try:
                return new_loop.run_until_complete(elevenlabs_service.validate_voice_ids())
            finally:
                new_loop.close()
        
        validation_results = run_async_task()
        
        if not validation_results:
            # API 연결 실패 시에도 기본 음성 목록 제공
            default_voices = ['aneunjin', 'kimtaeri', 'kimminjeong', 'jinseonkyu', 'parkchangwook', 'jiyoung']
            fallback_results = {voice: False for voice in default_voices}  # 모두 검증 불가로 표시
            
            logger.warning("ElevenLabs API 연결 실패, 폴백 모드로 전환")
            return Response({
                'success': True,
                'validation_results': fallback_results,
                'summary': {
                    'total_voices': len(fallback_results),
                    'valid_count': 0,
                    'invalid_count': len(fallback_results),
                    'valid_voices': [],
                    'invalid_voices': list(fallback_results.keys()),
                    'fallback_mode': True,
                    'api_error': 'ElevenLabs API 연결 실패 (401 Unauthorized) - API 키 확인 필요'
                },
                'timestamp': 'fallback_mode'
            })
        
        # 결과 분석
        valid_voices = {k: v for k, v in validation_results.items() if v}
        invalid_voices = {k: v for k, v in validation_results.items() if not v}
        
        response_data = {
            'success': True,
            'validation_results': validation_results,
            'summary': {
                'total_voices': len(validation_results),
                'valid_count': len(valid_voices),
                'invalid_count': len(invalid_voices),
                'valid_voices': list(valid_voices.keys()),
                'invalid_voices': list(invalid_voices.keys())
            },
            'timestamp': cache.get('elevenlabs_voice_validation_time', 'unknown')
        }
        
        # 결과 캐시 (1시간)
        cache.set(cache_key, response_data, 3600)
        cache.set('elevenlabs_voice_validation_time', str(asyncio.get_event_loop().time()), 3600)
        
        logger.info(f"Voice ID 검증 완료: {len(valid_voices)}개 유효, {len(invalid_voices)}개 무효")
        return Response(response_data)
        
    except Exception as e:
        logger.error(f"Voice ID 검증 API 오류: {str(e)}")
        return Response({
            'success': False,
            'error': f'Voice ID 검증 실패: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_available_voices(request):
    """
    ElevenLabs API에서 사용 가능한 모든 음성 목록 가져오기
    """
    try:
        # ElevenLabs 서비스 가용성 확인
        if not ELEVENLABS_AVAILABLE or not elevenlabs_service:
            return Response({
                'success': False,
                'error': 'ElevenLabs 서비스를 사용할 수 없습니다.'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        
        if not elevenlabs_service.is_available():
            return Response({
                'success': False,
                'error': 'ElevenLabs API 키가 설정되지 않았습니다.'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        
        # 캐시에서 음성 목록 확인 (30분 유효)
        cache_key = 'elevenlabs_available_voices'
        cached_voices = cache.get(cache_key)
        
        if cached_voices:
            logger.info("캐시된 음성 목록 반환")
            return Response({
                'success': True,
                'voices': cached_voices,
                'cached': True
            })
        
        # 비동기 함수 실행 (Django 호환 방식)
        def run_async_voices():
            new_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(new_loop)
            try:
                return new_loop.run_until_complete(elevenlabs_service.get_available_voices_from_api())
            finally:
                new_loop.close()
        
        voices = run_async_voices()
        
        if not voices:
            return Response({
                'success': False,
                'error': 'ElevenLabs API에서 음성 목록을 가져올 수 없습니다'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        
        # 음성 데이터 가공
        processed_voices = []
        for voice in voices:
            processed_voices.append({
                'id': voice['voice_id'],
                'name': voice['name'],
                'description': voice['description'],
                'category': voice['category'],
                'language': voice['language'],
                'gender': voice['gender'],
                'accent': voice['accent'],
                'use_case': voice['use_case'],
                'is_mapped': voice['voice_id'] in elevenlabs_service.voice_map.values()
            })
        
        # 결과 캐시 (30분)
        cache.set(cache_key, processed_voices, 1800)
        
        logger.info(f"ElevenLabs API에서 {len(processed_voices)}개 음성 로드")
        return Response({
            'success': True,
            'voices': processed_voices,
            'count': len(processed_voices),
            'cached': False
        })
        
    except Exception as e:
        logger.error(f"음성 목록 API 오류: {str(e)}")
        return Response({
            'success': False,
            'error': f'음성 목록 가져오기 실패: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def validate_single_voice(request):
    """
    단일 Voice ID 유효성 검증
    """
    try:
        # ElevenLabs 서비스 가용성 확인
        if not ELEVENLABS_AVAILABLE or not elevenlabs_service:
            return Response({
                'success': False,
                'error': 'ElevenLabs 서비스를 사용할 수 없습니다.'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        
        if not elevenlabs_service.is_available():
            return Response({
                'success': False,
                'error': 'ElevenLabs API 키가 설정되지 않았습니다.'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        
        voice_id = request.data.get('voice_id')
        if not voice_id:
            return Response({
                'success': False,
                'error': 'voice_id 파라미터가 필요합니다'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 비동기 함수 실행 (Django 호환 방식)
        def run_async_single():
            new_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(new_loop)
            try:
                return new_loop.run_until_complete(elevenlabs_service.validate_single_voice_id(voice_id))
            finally:
                new_loop.close()
        
        is_valid = run_async_single()
        
        return Response({
            'success': True,
            'voice_id': voice_id,
            'is_valid': is_valid,
            'message': '유효한 Voice ID입니다' if is_valid else '무효한 Voice ID입니다'
        })
        
    except Exception as e:
        logger.error(f"단일 Voice ID 검증 오류: {str(e)}")
        return Response({
            'success': False,
            'error': f'Voice ID 검증 실패: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def get_voice_mapping_status(request):
    """
    현재 시스템의 음성 매핑 상태 정보
    """
    try:
        # ElevenLabs 서비스 가용성 확인
        if not ELEVENLABS_AVAILABLE or not elevenlabs_service:
            return Response({
                'success': False,
                'error': 'ElevenLabs 서비스를 사용할 수 없습니다.',
                'service_available': False,
                'voice_mappings': [],
                'total_mappings': 0
            })
        
        service_available = elevenlabs_service.is_available()
        voice_map = elevenlabs_service.voice_map
        
        mapping_info = []
        for voice_name, voice_id in voice_map.items():
            # Available voices에서 해당 음성 정보 찾기
            available_voices = elevenlabs_service.get_available_voices()
            voice_info = next(
                (v for v in available_voices if v.get('id') == voice_name), 
                {'name': voice_name, 'description': 'Unknown'}
            )
            
            mapping_info.append({
                'name': voice_name,
                'voice_id': voice_id,
                'description': voice_info.get('name', voice_name),
                'gender': voice_info.get('gender', 'unknown'),
                'accent': voice_info.get('accent', 'unknown')
            })
        
        return Response({
            'success': True,
            'voice_mappings': mapping_info,
            'total_mappings': len(voice_map),
            'service_available': service_available
        })
        
    except Exception as e:
        logger.error(f"음성 매핑 상태 조회 오류: {str(e)}")
        return Response({
            'success': False,
            'error': f'매핑 상태 조회 실패: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def debug_voice_service(request):
    """
    Voice 서비스 디버깅 정보 제공
    """
    debug_info = {
        'elevenlabs_available': ELEVENLABS_AVAILABLE,
        'service_exists': elevenlabs_service is not None,
        'service_info': {}
    }
    
    if ELEVENLABS_AVAILABLE and elevenlabs_service:
        try:
            debug_info['service_info'] = {
                'is_available': elevenlabs_service.is_available(),
                'api_key_configured': bool(elevenlabs_service.api_key),
                'api_key_length': len(elevenlabs_service.api_key) if elevenlabs_service.api_key else 0,
                'base_url': elevenlabs_service.base_url,
                'voice_map_count': len(elevenlabs_service.voice_map),
                'voice_names': list(elevenlabs_service.voice_map.keys())
            }
        except Exception as e:
            debug_info['service_error'] = str(e)
    
    return Response({
        'success': True,
        'debug_info': debug_info
    })