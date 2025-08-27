from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.response import Response
from rest_framework import status
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import json
import logging
from django.core.cache import cache

from .models import StreamerTTSSettings, ChatRoom
from .serializers import ChatRoomSerializer, ChatRoomCreateSerializer

logger = logging.getLogger(__name__)
channel_layer = get_channel_layer()


# ---------------------------------
# TTS 설정 관련 뷰 (기존과 동일)
# ---------------------------------
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
        return Response({'success': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_streamer_tts_settings(request, streamer_id):
    """
    스트리머의 TTS 설정을 업데이트하고 모든 클라이언트에게 브로드캐스트
    """
    try:
        settings, created = StreamerTTSSettings.get_or_create_for_streamer(streamer_id)
        data = request.data
        
        # 필드 업데이트 (기존 로직과 동일)
        for field, value in data.items():
            if hasattr(settings, field):
                # 필요에 따라 타입 변환
                field_type = type(getattr(settings, field))
                try:
                    setattr(settings, field, field_type(value))
                except (ValueError, TypeError):
                    # bool("False")는 True이므로 별도 처리
                    if field_type == bool:
                        setattr(settings, field, str(value).lower() in ['true', '1'])
        
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
        
        return Response({'success': True, 'settings': settings.to_dict()})
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
    
    # 캐시 키를 상수로 정의하여 중복 방지
    CHATROOM_LIST_CACHE_KEY = 'chatrooms_list'
    # 방 기준 변경안:
    # - 프론트는 roomId(pk)로 조회합니다.
    # - lookup_field를 기본 pk로 사용하고, lookup_url_kwarg도 기본값(id)로 둡니다.
    #   chat/urls.py에서 생성한 detail 경로가 rooms/<pk>/로 동작하도록 맞춥니다.
    # lookup_field = 'pk'
    # lookup_url_kwarg = 'pk'

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            permission_classes = [AllowAny]
        else:
            permission_classes = [IsAdminUser]
        return [permission() for permission in permission_classes]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ChatRoomCreateSerializer
        return ChatRoomSerializer

    def list(self, request, *args, **kwargs):
        # 1. 목록 캐시를 먼저 확인
        cached_list_json = cache.get(self.CHATROOM_LIST_CACHE_KEY)
        if cached_list_json:
            logger.info("Cache Hit: Fetching room list from cache")
            cached_list = json.loads(cached_list_json)        # DRF 페이지네이션 형식에 맞춰 반환
        
        # redis_conn = get_redis_connection("default")
        # room_keys_bytes = redis_conn.zrevrange('all_chatrooms', 0, -1)
        # room_keys = [key.decode('utf-8') for key in room_keys_bytes]
        
        # if room_keys:
        #     print("Cache Hit: Fetching all rooms from Redis")
        #     cached_rooms = cache.get_many(room_keys)
            
        #     # Redis 캐시 데이터는 페이지네이션이 없으므로 그대로 반환합니다.
        #     # (만약 페이지네이션이 필요하다면, 이 부분에 별도 로직이 필요합니다.)
        #     response_data = [cached_rooms[key] for key in room_keys if key in cached_rooms]
            return Response({
                'count': len(cached_list),
                'next': None,
                'previous': None,
                'results': cached_list
            })

        # 2. 캐시가 없으면 DB에서 조회하고 캐시에 저장
        logger.info("Cache Miss: Fetching rooms from DB and populating cache")
        response = super().list(request, *args, **kwargs)
        results = response.data.get('results', [])
        if results:
            # 60초간 캐시 저장
            cache.set(self.CHATROOM_LIST_CACHE_KEY, json.dumps(results), timeout=60)
            
        return response

    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        
        if response.status_code == 200:
            instance = self.get_object()
            key = f"chatroom:{instance.id}"
            
            redis_conn = get_redis_connection("default")
            cache.delete(key)
            redis_conn.zrem('all_chatrooms', key)
            redis_conn.zrem('live_chatrooms', key)
            print(f"✅ Cache invalidated for updated room: {key}")

    def perform_create(self, serializer):
        serializer.save(host=self.request.user)
        # 데이터가 생성되었으므로, 목록 캐시를 삭제하여 다음 조회 시 갱신되도록 함
        cache.delete(self.CHATROOM_LIST_CACHE_KEY)
        logger.info(f"✅ Cache invalidated due to new room creation.")


    def perform_update(self, serializer):
        serializer.save()
        # 데이터가 수정되었으므로, 목록 캐시를 삭제
        cache.delete(self.CHATROOM_LIST_CACHE_KEY)
        logger.info(f"✅ Cache invalidated due to room update.")

        return response

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        key = f"chatroom:{instance.id}"
        
        redis_conn = get_redis_connection("default")
        cache.delete(key)
        redis_conn.zrem('all_chatrooms', key)
        redis_conn.zrem('live_chatrooms', key)
        print(f"✅ Cache invalidated for deleted room: {key}")
        return super().destroy(request, *args, **kwargs)
    

    def perform_destroy(self, instance):
        instance.delete()
        # 데이터가 삭제되었으므로, 목록 캐시를 삭제
        cache.delete(self.CHATROOM_LIST_CACHE_KEY)
        logger.info(f"✅ Cache invalidated due to room deletion.")