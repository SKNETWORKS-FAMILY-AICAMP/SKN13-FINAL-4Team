from rest_framework import serializers
from .models import (
    Influencer, CoreValue, InfluencerCoreValue, 
    CommunicationStyle, PersonalityTrait, MoralCompass, 
    Story, Like, Donation, InfluencerTTSSettings
)
from users.serializers import UserSerializer

class CommunicationStyleSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommunicationStyle
        exclude = ['influencer']

class PersonalityTraitSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonalityTrait
        exclude = ['influencer']

class MoralCompassSerializer(serializers.ModelSerializer):
    class Meta:
        model = MoralCompass
        exclude = ['influencer']

class InfluencerSerializer(serializers.ModelSerializer):
    # 위에서 만든 상세 정보 Serializer들을 포함시킵니다.
    communication_style = CommunicationStyleSerializer(read_only=True)
    personality_trait = PersonalityTraitSerializer(read_only=True)
    moral_compass = MoralCompassSerializer(read_only=True)
    tts_settings = serializers.SerializerMethodField()
    
    core_values = serializers.StringRelatedField(many=True, read_only=True)

    is_liked_by_user = serializers.SerializerMethodField()

    class Meta:
        model = Influencer
        fields = '__all__'

    def get_is_liked_by_user(self, obj):
        user = self.context.get('request').user
        
        if user and user.is_authenticated: # 유저 로그인 상태 확인
            return Like.objects.filter(influencer=obj, user=user).exists()
        
        return False
    
    def get_tts_settings(self, obj):
        """인플루언서의 TTS 설정을 가져옵니다. 없으면 기본값으로 생성합니다."""
        try:
            tts_settings = obj.tts_settings
            return InfluencerTTSSettingsSerializer(tts_settings, context=self.context).data
        except InfluencerTTSSettings.DoesNotExist:
            # TTS 설정이 없으면 None 반환 (프론트엔드에서 처리)
            return None

class InfluencerWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Influencer
        fields = '__all__'

class StorySerializer(serializers.ModelSerializer):
    author_nickname = serializers.CharField(source='author.nickname', read_only=True)

    class Meta:
        model = Story
        fields = ['id', 'title', 'content', 'is_anonymous', 'created_at', 'author', 'author_nickname', 'influencer']
        read_only_fields = ['author', 'author_nickname']

class DonationRankingSerializer(serializers.Serializer):
    """열혈 순위 응답을 위한 커스텀 시리얼라이저"""
    rank = serializers.IntegerField()
    donor_nickname = serializers.CharField()
    total_amount = serializers.IntegerField()

class InfluencerTTSSettingsSerializer(serializers.ModelSerializer):
    """인플루언서별 TTS 설정 시리얼라이저"""
    influencer_name = serializers.CharField(source='influencer.name', read_only=True)
    
    class Meta:
        model = InfluencerTTSSettings
        fields = [
            'influencer', 'influencer_name', 'tts_engine', 
            'elevenlabs_voice', 'elevenlabs_voice_name', 'elevenlabs_model',
            'elevenlabs_stability', 'elevenlabs_similarity', 'elevenlabs_style', 
            'elevenlabs_speaker_boost', 'auto_play', 'streaming_delay', 
            'tts_delay', 'chunk_size', 'sync_mode', 'last_updated_by', 
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'last_updated_by']
    
    def create(self, validated_data):
        # 현재 사용자를 last_updated_by로 설정
        request = self.context.get('request')
        if request and request.user:
            validated_data['last_updated_by'] = request.user
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        # 현재 사용자를 last_updated_by로 설정
        request = self.context.get('request')
        if request and request.user:
            validated_data['last_updated_by'] = request.user
        return super().update(instance, validated_data)