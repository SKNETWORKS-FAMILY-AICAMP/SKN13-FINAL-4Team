from rest_framework import serializers
from .models import (
    Influencer, CoreValue, InfluencerCoreValue, 
    CommunicationStyle, PersonalityTrait, MoralCompass
)

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
    
    # core_values는 이름만 보이도록 간단하게 설정
    core_values = serializers.StringRelatedField(many=True, read_only=True)

    class Meta:
        model = Influencer
        # API 응답에 포함될 필드 목록
        fields = [
            'id',  'name', 'age', 'gender', 'mbti', 'job', 
            'social_status', 'audience_term', 'origin_story', 'profile_image',
            'core_values', 'communication_style', 'personality_trait', 'moral_compass'
        ]

class InfluencerWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Influencer
        fields = ['name', 'age', 'gender', 'mbti']
