from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.response import Response
from rest_framework import status
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import json
import logging
import time 
from django.core.cache import cache
from django_redis import get_redis_connection

from .models import StreamerTTSSettings, ChatRoom
from .serializers import ChatRoomSerializer, ChatRoomCreateSerializer
from debugging.models import TTSLog 
from influencers.models import Influencer 
from rest_framework.views import APIView

logger = logging.getLogger(__name__)
channel_layer = get_channel_layer()


# ---------------------------------
# TTS 설정 관련 뷰
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
    log_entry = TTSLog.objects.create(
        user=request.user,
        request_text=f"Update TTS settings for {streamer_id}",
        status='PENDING'
    )
    start_time = time.time()
    # ---------------------------------

    try:
        settings, created = StreamerTTSSettings.get_or_create_for_streamer(streamer_id)
        data = request.data
        
        old_settings_snapshot = settings.to_dict()
        log_entry.tts_settings_snapshot = old_settings_snapshot

        # 필드 업데이트
        for field, value in data.items():
            if hasattr(settings, field):
                field_type = type(getattr(settings, field))
                try:
                    if field_type == bool:
                        setattr(settings, field, str(value).lower() in ['true', '1'])
                    else:
                        setattr(settings, field, field_type(value))
                except (ValueError, TypeError):
                    logger.warning(f"Type conversion failed for field {field}: {value}")

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
        
        end_time = time.time()
        log_entry.status = 'SUCCESS'
        log_entry.latency_ms = int((end_time - start_time) * 1000)
        try:
            # streamer_id (활동명)으로 Influencer 객체를 찾습니다.
            influencer_obj = Influencer.objects.get(name_ko=streamer_id)
            log_entry.influencer = influencer_obj
        except Influencer.DoesNotExist:
            logger.warning(f"Could not find Influencer with name_ko={streamer_id} for logging.")
        log_entry.save()
        # ---------------------------------
        
        return Response({'success': True, 'settings': settings.to_dict()})

    except Exception as e:
        end_time = time.time()
        log_entry.status = 'ERROR'
        log_entry.error_message = str(e)
        log_entry.latency_ms = int((end_time - start_time) * 1000)
        log_entry.save()
        # ---------------------------------
        
        logger.error(f"TTS 설정 업데이트 오류 ({streamer_id}): {e}")
        return Response({'success': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_all_tts_settings(request):
    try:
        all_settings = StreamerTTSSettings.objects.all()
        settings_list = [setting.to_dict() for setting in all_settings]
        return Response({'success': True, 'settings': settings_list, 'count': len(settings_list)})
    except Exception as e:
        logger.error(f"모든 TTS 설정 조회 오류: {e}")
        return Response({'success': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ChatRoomViewSet(viewsets.ModelViewSet):
    queryset = ChatRoom.objects.all().order_by('-created_at')
    CHATROOM_LIST_CACHE_KEY = 'chatrooms_list'

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
        try:
            cached_list_json = cache.get(self.CHATROOM_LIST_CACHE_KEY)
            if cached_list_json:
                logger.info("Cache Hit: Fetching room list from cache")
                cached_list = json.loads(cached_list_json)
                return Response({
                    'count': len(cached_list),
                    'next': None,
                    'previous': None,
                    'results': cached_list
                })
        except Exception as e:
            logger.error(f"Cache get failed: {e}")

        logger.info("Cache Miss: Fetching rooms from DB and populating cache")
        response = super().list(request, *args, **kwargs)
        results = response.data.get('results', [])
        if results:
            try:
                cache.set(self.CHATROOM_LIST_CACHE_KEY, json.dumps(results))
            except Exception as e:
                logger.error(f"Cache set failed: {e}")
            
        return response

    def perform_create(self, serializer):
        serializer.save(host=self.request.user)
        try:
            cache.delete(self.CHATROOM_LIST_CACHE_KEY)
            logger.info(f"✅ Cache invalidated due to new room creation.")
        except Exception as e:
            logger.error(f"Cache invalidation failed during create: {e}")

    def perform_update(self, serializer):
        serializer.save()
        try:
            cache.delete(self.CHATROOM_LIST_CACHE_KEY)
            logger.info(f"✅ Cache invalidated due to room update.")
        except Exception as e:
            logger.error(f"Cache invalidation failed during update: {e}")

    def perform_destroy(self, instance):
        instance.delete()
        try:
            cache.delete(self.CHATROOM_LIST_CACHE_KEY)
            logger.info(f"✅ Cache invalidated due to room deletion.")
        except Exception as e:
            logger.error(f"Cache invalidation failed during destroy: {e}")

