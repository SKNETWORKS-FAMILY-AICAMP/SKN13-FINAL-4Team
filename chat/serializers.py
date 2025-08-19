from rest_framework import serializers
from .models import ChatRoom
from users.serializers import UserSerializer

class ChatRoomSerializer(serializers.ModelSerializer):
    """
    채팅방 정보를 보여주기 위한 시리얼라이저 (조회용)
    """
    host = UserSerializer(read_only=True)
    influencer = UserSerializer(read_only=True)

    class Meta:
        model = ChatRoom
        fields = '__all__'

class ChatRoomCreateSerializer(serializers.ModelSerializer):
    """
    채팅방 생성을 위한 시리얼라이저 (생성용)
    """
    class Meta:
        model = ChatRoom
        fields = ('name', 'description', 'thumbnail', 'influencer', 'status')