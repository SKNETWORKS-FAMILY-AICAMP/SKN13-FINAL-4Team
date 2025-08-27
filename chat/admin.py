from django.contrib import admin
from .models import ChatRoom, ChatMessage, ChatRoomLog, StreamerTTSSettings


@admin.register(ChatRoom)
class ChatRoomAdmin(admin.ModelAdmin):
    list_display = ['name', 'host', 'created_at', 'closed_at']
    list_filter = ['created_at', 'closed_at']
    search_fields = ['name', 'host__username']
    readonly_fields = ['created_at']


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ['room', 'sender', 'content_preview', 'created_at']
    list_filter = ['created_at', 'room']
    search_fields = ['content', 'sender__username', 'room__name']
    readonly_fields = ['created_at']
    
    def content_preview(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
    content_preview.short_description = 'Content Preview'


@admin.register(ChatRoomLog)
class ChatRoomLogAdmin(admin.ModelAdmin):
    list_display = ['room', 'user', 'action', 'timestamp']
    list_filter = ['action', 'timestamp']
    search_fields = ['user__username', 'room__name']
    readonly_fields = ['timestamp']


@admin.register(StreamerTTSSettings)
class StreamerTTSSettingsAdmin(admin.ModelAdmin):
    list_display = ['streamer_id', 'tts_engine', 'elevenlabs_voice', 'auto_play', 'last_updated_by', 'updated_at']
    list_filter = ['tts_engine', 'auto_play', 'updated_at']
    search_fields = ['streamer_id', 'elevenlabs_voice']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('기본 정보', {
            'fields': ('streamer_id', 'tts_engine', 'auto_play')
        }),
        ('ElevenLabs 설정', {
            'fields': ('elevenlabs_voice', 'elevenlabs_model', 'elevenlabs_stability', 
                      'elevenlabs_similarity', 'elevenlabs_style', 'elevenlabs_speaker_boost'),
            'classes': ('collapse',)
        }),
        ('기타 TTS 설정', {
            'fields': ('melo_voice', 'coqui_model', 'coqui_speaker'),
            'classes': ('collapse',)
        }),
        ('고급 설정', {
            'fields': ('streaming_delay', 'tts_delay', 'chunk_size', 'sync_mode'),
            'classes': ('collapse',)
        }),
        ('메타 정보', {
            'fields': ('last_updated_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def save_model(self, request, obj, form, change):
        """관리자가 설정을 저장할 때 last_updated_by를 자동 설정"""
        obj.last_updated_by = request.user
        super().save_model(request, obj, form, change)
        
        # 저장 후 WebSocket을 통해 모든 클라이언트에게 브로드캐스트
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        channel_layer = get_channel_layer()
        room_group_name = f'streaming_chat_{obj.streamer_id}'
        
        broadcast_data = {
            'type': 'tts_settings_changed',
            'settings': obj.to_dict(),
            'changed_by': request.user.username,
            'timestamp': obj.updated_at.isoformat()
        }
        
        async_to_sync(channel_layer.group_send)(room_group_name, broadcast_data)
