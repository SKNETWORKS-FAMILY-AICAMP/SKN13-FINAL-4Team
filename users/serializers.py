from rest_framework import serializers
from .models import User

class UserRegistrationSerializer(serializers.ModelSerializer):
    # 비밀번호 필드는 응답에 포함시키지 않도록 write_only=True 설정
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = ('username', 'password', 'nickname', 'email')

    # 유효성 검사를 통과한 데이터로 유저를 생성할 때 호출됩니다.
    def create(self, validated_data):
        # User.objects.create_user를 사용해 비밀번호를 해싱(암호화)합니다.
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            nickname=validated_data.get('nickname', ''),
            email=validated_data.get('email', '')
        )
        return user