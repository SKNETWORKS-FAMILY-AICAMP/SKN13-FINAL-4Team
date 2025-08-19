# chat/signals.py (새 파일)

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache
from django_redis import get_redis_connection
from .models import ChatRoom
from .serializers import ChatRoomSerializer

@receiver(post_save, sender=ChatRoom)
def update_chatroom_cache(sender, instance, **kwargs):
    # Redis Raw 클라이언트 가져오기
    redis_conn = get_redis_connection("default")
    
    key = f"chatroom:{instance.id}"
    
    # 캐싱할 데이터 구성
    influencer_data = {
        'id': instance.influencer.id, 'username': instance.influencer.username, 'nickname': instance.influencer.nickname,
    } if instance.influencer else None
    host_data = {
        'id': instance.host.id, 'username': instance.host.username, 'nickname': instance.host.nickname,
    }
    room_data = {
        'id': instance.id, 'host': host_data, 'name': instance.name,
        'description': instance.description,
        'thumbnail': instance.thumbnail.url if instance.thumbnail else None,
        'influencer': influencer_data, 'status': instance.status,
        'created_at': instance.created_at.isoformat(),
        'closed_at': instance.closed_at.isoformat() if instance.closed_at else None,
    }

    # 개별 데이터 저장은 기본 cache 객체 사용
    cache.set(key, room_data, timeout=None) # timeout=None 으로 만료되지 않게 설정
    
    score = instance.created_at.timestamp()
    
    # Sorted Set 관련 명령어는 redis_conn 객체로 실행
    redis_conn.zadd('all_chatrooms', {key: score})

    if instance.status == 'live':
        redis_conn.zadd('live_chatrooms', {key: score})
    else:
        redis_conn.zrem('live_chatrooms', key)

@receiver(post_delete, sender=ChatRoom)
def remove_chatroom_cache(sender, instance, **kwargs):
    """
    ChatRoom 객체가 삭제될 때 Redis 캐시에서도 제거합니다.
    """
    redis_conn = get_redis_connection("default")
    key = f"chatroom:{instance.id}"
    
    cache.delete(key)
    redis_conn.zrem('all_chatrooms', key)
    redis_conn.zrem('live_chatrooms', key)
