from rest_framework import serializers
from .models import TTSLog

class TTSLogSerializer(serializers.ModelSerializer):
    # ForeignKey 필드를 더 읽기 쉽게 표시하기 위해 추가
    user = serializers.StringRelatedField()
    influencer = serializers.StringRelatedField()

    class Meta:
        model = TTSLog
        fields = '__all__'
