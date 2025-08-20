# chat/signals.py

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache
from django_redis import get_redis_connection
from .models import ChatRoom

@receiver(post_save, sender=ChatRoom)
def update_chatroom_cache(sender, instance, **kwargs):
    """
    ChatRoom 객체가 저장될 때 Redis 캐시를 업데이트합니다.
    """
    redis_conn = get_redis_connection("default")
    
    # Django 캐시가 내부적으로 사용할 키 (접두어 없음)
    key_without_prefix = f"chatroom:{instance.id}"
    
    # 캐싱할 데이터 직렬화
    # (Serializer를 사용하는 것이 더 좋지만, 기존 로직을 유지합니다)
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
        'influencer': influencer_data, 
        'influencer_nickname': instance.influencer.nickname if instance.influencer else None,
        'host_username': instance.host.username,
        'status': instance.status,
        'created_at': instance.created_at.isoformat(),
        'closed_at': instance.closed_at.isoformat() if instance.closed_at else None,
    }

    # `cache.set`은 Django가 알아서 키에 접두어(prefix)를 붙여 저장합니다.
    cache.set(key_without_prefix, room_data, timeout=None)
    
    # --- ▼▼▼ 가장 중요한 수정 부분 ▼▼▼ ---
    # Django 캐시가 실제로 Redis에 저장한 키(접두어가 포함된)를 가져옵니다.
    prefixed_key = cache.make_key(key_without_prefix)
    # --- ▲▲▲ 수정된 부분 끝 ▲▲▲ ---
    
    score = instance.created_at.timestamp()
    
    # Sorted Set에는 반드시 접두어가 포함된 키를 저장해야 합니다.
    redis_conn.zadd('all_chatrooms', {prefixed_key: score})

    if instance.status == 'live':
        redis_conn.zadd('live_chatrooms', {prefixed_key: score})
    else:
        redis_conn.zrem('live_chatrooms', prefixed_key)

@receiver(post_delete, sender=ChatRoom)
def remove_chatroom_cache(sender, instance, **kwargs):
    """
    ChatRoom 객체가 삭제될 때 Redis 캐시에서도 제거합니다.
    """
    redis_conn = get_redis_connection("default")
    key_without_prefix = f"chatroom:{instance.id}"
    prefixed_key = cache.make_key(key_without_prefix)
    
    # `cache.delete`는 접두어가 없는 키를 사용합니다.
    cache.delete(key_without_prefix)
    
    # Sorted Set에서는 접두어가 포함된 키를 제거해야 합니다.
    redis_conn.zrem('all_chatrooms', prefixed_key)
    redis_conn.zrem('live_chatrooms', prefixed_key)
