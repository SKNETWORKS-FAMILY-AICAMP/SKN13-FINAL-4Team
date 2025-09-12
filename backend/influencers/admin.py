from django.contrib import admin
from .models import (
    Influencer, CoreValue, InfluencerCoreValue, 
    CommunicationStyle, PersonalityTrait, MoralCompass, 
    Story, Like, Donation, InfluencerTTSSettings
)

@admin.register(Influencer)
class InfluencerAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'age', 'gender', 'is_active', 'like_count']
    list_filter = ['gender', 'is_active']
    search_fields = ['name', 'job']
    ordering = ['name']

@admin.register(InfluencerTTSSettings) 
class InfluencerTTSSettingsAdmin(admin.ModelAdmin):
    list_display = [
        'influencer', 'tts_engine', 'elevenlabs_voice', 'elevenlabs_voice_name',
        'auto_play', 'last_updated_by', 'updated_at'
    ]
    list_filter = ['tts_engine', 'auto_play', 'elevenlabs_voice']
    search_fields = ['influencer__name', 'elevenlabs_voice_name']
    ordering = ['influencer__name']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('기본 정보', {
            'fields': ('influencer', 'tts_engine')
        }),
        ('ElevenLabs 설정', {
            'fields': (
                'elevenlabs_voice', 'elevenlabs_voice_name', 'elevenlabs_model',
                'elevenlabs_stability', 'elevenlabs_similarity', 'elevenlabs_style', 
                'elevenlabs_speaker_boost'
            )
        }),
        ('재생 설정', {
            'fields': ('auto_play', 'streaming_delay', 'tts_delay', 'chunk_size', 'sync_mode')
        }),
        ('메타 정보', {
            'fields': ('last_updated_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

@admin.register(CoreValue)
class CoreValueAdmin(admin.ModelAdmin):
    list_display = ['value_name', 'description']
    search_fields = ['value_name']

@admin.register(Story)
class StoryAdmin(admin.ModelAdmin):
    list_display = ['influencer', 'title', 'author', 'is_anonymous', 'created_at']
    list_filter = ['is_anonymous', 'influencer', 'created_at']
    search_fields = ['title', 'content', 'author__username']
    ordering = ['-created_at']

@admin.register(Donation)
class DonationAdmin(admin.ModelAdmin):
    list_display = ['influencer', 'donor', 'amount', 'donated_at']
    list_filter = ['influencer', 'donated_at']
    search_fields = ['donor__username', 'influencer__name']
    ordering = ['-donated_at']

@admin.register(Like)
class LikeAdmin(admin.ModelAdmin):
    list_display = ['influencer', 'user', 'created_at']
    list_filter = ['influencer', 'created_at']
    search_fields = ['user__username', 'influencer__name']
    ordering = ['-created_at']
