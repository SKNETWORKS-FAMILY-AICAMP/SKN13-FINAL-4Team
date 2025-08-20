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
    """
    try:
        settings, created = StreamerTTSSettings.get_or_create_for_streamer(streamer_id)
        
        data = request.data
        
        # TTS 엔진 및 관련 설정 업데이트
        if 'ttsEngine' in data: settings.tts_engine = data['ttsEngine']
        if 'elevenLabsVoice' in data: settings.elevenlabs_voice = data['elevenLabsVoice']
        if 'elevenLabsModel' in data: settings.elevenlabs_model = data['elevenLabsModel']
        if 'elevenLabsStability' in data: settings.elevenlabs_stability = float(data['elevenLabsStability'])
        if 'elevenLabsSimilarity' in data: settings.elevenlabs_similarity = float(data['elevenLabsSimilarity'])
        if 'elevenLabsStyle' in data: settings.elevenlabs_style = float(data['elevenLabsStyle'])
        if 'elevenLabsSpeakerBoost' in data: settings.elevenlabs_speaker_boost = bool(data['elevenLabsSpeakerBoost'])
        if 'meloVoice' in data: settings.melo_voice = data['meloVoice']
        if 'coquiModel' in data: settings.coqui_model = data['coquiModel']
        if 'coquiSpeaker' in data: settings.coqui_speaker = int(data['coquiSpeaker'])
        if 'autoPlay' in data: settings.auto_play = bool(data['autoPlay'])
        if 'streamingDelay' in data: settings.streaming_delay = int(data['streamingDelay'])
        if 'ttsDelay' in data: settings.tts_delay = int(data['ttsDelay'])
        if 'chunkSize' in data: settings.chunk_size = int(data['chunkSize'])
        if 'syncMode' in data: settings.sync_mode = data['syncMode']
        
        settings.last_updated_by = request.user
        settings.save()
        
        logger.info(f"💾 TTS 설정 저장 완료: {streamer_id} by {request.user.username}")
        
        # WebSocket 브로드캐스트
        room_group_name = f'streaming_chat_{streamer_id}'
        async_to_sync(channel_layer.group_send)(
            room_group_name,
            {
                'type': 'tts_settings_changed',
                'settings': settings.to_dict(),
                'changed_by': request.user.username,
                'timestamp': settings.updated_at.isoformat()
            }
        )
        logger.info(f"TTS 설정 브로드캐스트 완료: {room_group_name}")
        
        return Response({
            'success': True,
            'settings': settings.to_dict(),
        })
        
    except Exception as e:
        logger.error(f"TTS 설정 업데이트 오류 ({streamer_id}): {e}")
        return Response({'success': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_all_tts_settings(request):
    """
    모든 스트리머의 TTS 설정을 조회하는 API (관리용)
    """
    try:
        all_settings = StreamerTTSSettings.objects.all()
        settings_list = [setting.to_dict() for setting in all_settings]
        return Response({'success': True, 'settings': settings_list, 'count': len(settings_list)})
    except Exception as e:
        logger.error(f"모든 TTS 설정 조회 오류: {e}")
        return Response({'success': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ChatRoomViewSet(viewsets.ModelViewSet):
    queryset = ChatRoom.objects.all().order_by('-created_at')

    def get_permissions(self):
        if self.action == 'list':
            permission_classes = [AllowAny]
        else:
            permission_classes = [IsAdminUser]
        return [permission() for permission in permission_classes]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ChatRoomCreateSerializer
        return ChatRoomSerializer

    def perform_create(self, serializer):
        serializer.save(host=self.request.user)

    def list(self, request, *args, **kwargs):
        redis_conn = get_redis_connection("default")
        room_keys_bytes = redis_conn.zrevrange('all_chatrooms', 0, -1)
        room_keys = [key.decode('utf-8') for key in room_keys_bytes]
        
        if room_keys:
            print("Cache Hit: Fetching all rooms from Redis")
            cached_rooms = cache.get_many(room_keys)
            
            # Redis 캐시 데이터는 페이지네이션이 없으므로 그대로 반환합니다.
            # (만약 페이지네이션이 필요하다면, 이 부분에 별도 로직이 필요합니다.)
            response_data = [cached_rooms[key] for key in room_keys if key in cached_rooms]
            return Response(response_data)

        print("Cache Miss: Fetching rooms from DB and populating cache")
        response = super().list(request, *args, **kwargs)
        
        for room_data in response.data.get('results', []):
            key = f"chatroom:{room_data['id']}"
            created_at_str = room_data.get('created_at')
            if created_at_str:
                created_at_ts = timezone.datetime.fromisoformat(created_at_str).timestamp()
                cache.set(key, room_data)
                redis_conn.zadd('all_chatrooms', {key: created_at_ts})
                if room_data.get('status') == 'live':
                    redis_conn.zadd('live_chatrooms', {key: created_at_ts})
                
        return response

    # --- ▼▼▼ 캐시 무효화를 위한 코드 추가 ▼▼▼ ---
    def update(self, request, *args, **kwargs):
        # 부모 클래스의 update를 먼저 호출하여 DB를 업데이트합니다.
        response = super().update(request, *args, **kwargs)
        
        # 업데이트에 성공했을 경우 (200 OK) 캐시를 삭제합니다.
        if response.status_code == 200:
            instance = self.get_object()
            key = f"chatroom:{instance.id}"
            
            redis_conn = get_redis_connection("default")
            cache.delete(key) # 개별 채팅방 객체 캐시 삭제
            redis_conn.zrem('all_chatrooms', key) # 'all_chatrooms' 목록에서도 해당 키 삭제
            redis_conn.zrem('live_chatrooms', key) # 'live_chatrooms' 목록에서도 해당 키 삭제
            print(f"✅ Cache invalidated for updated room: {key}")

        return response

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        key = f"chatroom:{instance.id}"
        
        # DB에서 객체를 삭제하기 전에 관련된 캐시를 먼저 삭제합니다.
        redis_conn = get_redis_connection("default")
        cache.delete(key)
        redis_conn.zrem('all_chatrooms', key)
        redis_conn.zrem('live_chatrooms', key)
        print(f"✅ Cache invalidated for deleted room: {key}")

        # 부모 클래스의 destroy를 호출하여 DB에서 객체를 실제로 삭제합니다.
        return super().destroy(request, *args, **kwargs)