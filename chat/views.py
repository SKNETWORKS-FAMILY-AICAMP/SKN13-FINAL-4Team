from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny 
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import json
import logging
from django.core.cache import cache
from django_redis import get_redis_connection
from django.utils import timezone

from .models import StreamerTTSSettings, ChatRoom 
from .serializers import ChatRoomSerializer, ChatRoomCreateSerializer 



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

class ChatRoomViewSet(viewsets.ModelViewSet):
    queryset = ChatRoom.objects.all().order_by('-created_at')
    # permission_classes = [IsAdminUser] # 관리자만 채팅방을 관리할 수 있도록 설정

    def get_permissions(self):
        """
        요청 종류(action)에 따라 다른 권한을 적용합니다.
        - 'list': 목록 조회는 누구나 가능
        - 그 외(create, update 등): 관리자만 가능
        """
        if self.action == 'list':
            permission_classes = [AllowAny]
        else:
            permission_classes = [IsAdminUser]
        return [permission() for permission in permission_classes]
    
    def get_serializer_class(self):
        # 생성(create) 시에는 ChatRoomCreateSerializer를, 그 외에는 ChatRoomSerializer를 사용
        if self.action == 'create':
            return ChatRoomCreateSerializer
        return ChatRoomSerializer

    def perform_create(self, serializer):
        # 채팅방 생성 시, 현재 요청을 보낸 사용자를 'host'로 자동 할당
        serializer.save(host=self.request.user)

    def list(self, request, *args, **kwargs):
        # Redis Raw 클라이언트 가져오기
        redis_conn = get_redis_connection("default")
        
        # redis_conn으로 Sorted Set 조회
        # (zrevrange는 byte 문자열로 반환하므로 utf-8로 디코딩 필요)
        room_keys_bytes = redis_conn.zrevrange('all_chatrooms', 0, -1)
        room_keys = [key.decode('utf-8') for key in room_keys_bytes]
        
        if room_keys:
            print("Cache Hit: Fetching all rooms from Redis")
            # key 목록으로 데이터 조회는 Django 기본 캐시(get_many) 사용 가능
            cached_rooms = cache.get_many(room_keys)
            response_data = [cached_rooms[key] for key in room_keys if key in cached_rooms]
            return Response(response_data)

        print("Cache Miss: Fetching rooms from DB and populating cache")
        response = super().list(request, *args, **kwargs)
        
        for room_data in response.data:
            key = f"chatroom:{room_data['id']}"
            created_at_ts = timezone.datetime.fromisoformat(room_data['created_at']).timestamp()
            cache.set(key, room_data)
            # [수정] redis_conn으로 Sorted Set에 저장
            redis_conn.zadd('all_chatrooms', {key: created_at_ts})
            if room_data['status'] == 'live':
                redis_conn.zadd('live_chatrooms', {key: created_at_ts})
                
        return response