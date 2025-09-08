from rest_framework import serializers
from .models import (
    Influencer, CoreValue, InfluencerCoreValue, 
    CommunicationStyle, PersonalityTrait, MoralCompass, 
    Story, Like, Donation
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