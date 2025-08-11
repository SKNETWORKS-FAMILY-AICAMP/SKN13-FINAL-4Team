from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import json
import logging

from .models import StreamerTTSSettings

logger = logging.getLogger(__name__)
channel_layer = get_channel_layer()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_streamer_tts_settings(request, streamer_id):
    """
    스트리머의 TTS 설정을 가져오는 API
    """
    try:
        settings, created = StreamerTTSSettings.get_or_create_for_streamer(streamer_id)
        
        if created:
            logger.info(f"새로운 스트리머 TTS 설정 생성: {streamer_id}")
        
        return Response({
            'success': True,
            'settings': settings.to_dict(),
            'created': created
        })
        
    except Exception as e:
        logger.error(f"TTS 설정 조회 오류 ({streamer_id}): {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_streamer_tts_settings(request, streamer_id):
    """
    스트리머의 TTS 설정을 업데이트하고 모든 클라이언트에게 브로드캐스트
    테스트용: 모든 사용자가 설정 변경 가능
    """
    try:
        settings, created = StreamerTTSSettings.get_or_create_for_streamer(streamer_id)
        
        # 요청 데이터에서 설정 값 추출
        data = request.data
        logger.info(f"🔧 TTS 설정 업데이트 요청: 스트리머={streamer_id}, 사용자={request.user.username}")
        logger.info(f"📝 요청 데이터: {data}")
        logger.info(f"📄 현재 설정 (변경 전): 엔진={settings.tts_engine}, 음성={settings.elevenlabs_voice}")
        
        # TTS 엔진 설정
        if 'ttsEngine' in data:
            old_engine = settings.tts_engine
            settings.tts_engine = data['ttsEngine']
            logger.info(f"🎵 TTS 엔진 변경: {old_engine} → {settings.tts_engine}")
        
        # ElevenLabs 설정
        if 'elevenLabsVoice' in data:
            old_voice = settings.elevenlabs_voice
            settings.elevenlabs_voice = data['elevenLabsVoice']
            logger.info(f"🎤 ElevenLabs 음성 변경: {old_voice} → {settings.elevenlabs_voice}")
        if 'elevenLabsModel' in data:
            settings.elevenlabs_model = data['elevenLabsModel']
        if 'elevenLabsStability' in data:
            settings.elevenlabs_stability = float(data['elevenLabsStability'])
        if 'elevenLabsSimilarity' in data:
            settings.elevenlabs_similarity = float(data['elevenLabsSimilarity'])
        if 'elevenLabsStyle' in data:
            settings.elevenlabs_style = float(data['elevenLabsStyle'])
        if 'elevenLabsSpeakerBoost' in data:
            settings.elevenlabs_speaker_boost = bool(data['elevenLabsSpeakerBoost'])
        
        # MeloTTS 설정
        if 'meloVoice' in data:
            settings.melo_voice = data['meloVoice']
        
        # Coqui 설정
        if 'coquiModel' in data:
            settings.coqui_model = data['coquiModel']
        if 'coquiSpeaker' in data:
            settings.coqui_speaker = int(data['coquiSpeaker'])
        
        # 기타 설정
        if 'autoPlay' in data:
            settings.auto_play = bool(data['autoPlay'])
        if 'streamingDelay' in data:
            settings.streaming_delay = int(data['streamingDelay'])
        if 'ttsDelay' in data:
            settings.tts_delay = int(data['ttsDelay'])
        if 'chunkSize' in data:
            settings.chunk_size = int(data['chunkSize'])
        if 'syncMode' in data:
            settings.sync_mode = data['syncMode']
        
        # 설정 변경자 정보 저장
        settings.last_updated_by = request.user
        settings.save()
        
        logger.info(f"💾 TTS 설정 저장 완료: {streamer_id} by {request.user.username}")
        logger.info(f"📄 저장된 설정: 엔진={settings.tts_engine}, 음성={settings.elevenlabs_voice}")
        
        # 저장 후 DB에서 다시 조회하여 확인
        saved_settings = StreamerTTSSettings.objects.get(streamer_id=streamer_id)
        logger.info(f"✅ DB 확인: 엔진={saved_settings.tts_engine}, 음성={saved_settings.elevenlabs_voice}")
        
        # WebSocket을 통해 모든 클라이언트에게 설정 변경 브로드캐스트
        room_group_name = f'streaming_chat_{streamer_id}'
        
        broadcast_data = {
            'type': 'tts_settings_changed',
            'settings': settings.to_dict(),
            'changed_by': request.user.username,
            'timestamp': settings.updated_at.isoformat()
        }
        
        async_to_sync(channel_layer.group_send)(
            room_group_name,
            broadcast_data
        )
        
        logger.info(f"TTS 설정 브로드캐스트 완료: {room_group_name}")
        
        return Response({
            'success': True,
            'settings': settings.to_dict(),
            'message': f'TTS 설정이 모든 사용자에게 적용되었습니다.',
            'changed_by': request.user.username
        })
        
    except Exception as e:
        logger.error(f"TTS 설정 업데이트 오류 ({streamer_id}): {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_all_tts_settings(request):
    """
    모든 스트리머의 TTS 설정을 조회하는 API (관리용)
    """
    try:
        all_settings = StreamerTTSSettings.objects.all()
        settings_list = [setting.to_dict() for setting in all_settings]
        
        return Response({
            'success': True,
            'settings': settings_list,
            'count': len(settings_list)
        })
        
    except Exception as e:
        logger.error(f"모든 TTS 설정 조회 오류: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
