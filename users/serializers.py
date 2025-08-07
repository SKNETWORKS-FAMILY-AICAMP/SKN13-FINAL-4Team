from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # 토큰의 payload에 사용자 이름을 추가합니다.
        token['username'] = user.username
        return token


class UserRegistrationSerializer(serializers.ModelSerializer):
    password_confirm = serializers.CharField(write_only=True, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = ('username', 'password', 'password_confirm', 'nickname', 'email')
        extra_kwargs = {
            'password': {'write_only': True}
        }

    def validate_username(self, value):
        if len(value) < 6:
            raise serializers.ValidationError("ID는 6자리 이상이어야 합니다.")
        return value
        
    def validate_nickname(self, value):
        if value and len(value) < 2: # 닉네임이 입력되었을 경우에만 검사
            raise serializers.ValidationError("닉네임은 2글자 이상이어야 합니다.")
        return value
    
    def validate_password(self, value):
        if len(value) < 9:
            raise serializers.ValidationError("비밀번호는 9자리 이상이어야 합니다.")
        return value

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({"password_confirm": "비밀번호가 일치하지 않습니다."})
        return data

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(**validated_data)
        return user

class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        # 수정할 필드인 nickname과 profile_image만 포함합니다.
        fields = ('nickname', 'profile_image')

    def validate_nickname(self, value):
        if value and len(value) < 2:
            raise serializers.ValidationError("닉네임은 2글자 이상으로 설정해야 합니다.")
        
        # self.instance는 현재 요청을 보낸 사용자(user) 객체입니다.
        if self.instance:
            if User.objects.filter(nickname=value).exclude(pk=self.instance.pk).exists():
                raise serializers.ValidationError("이미 사용 중인 닉네임입니다.")
        return value

# UserSerializer는 이제 프로필 조회(GET) 용도로만 사용됩니다.
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'nickname', 'email', 'date_joined', 'is_staff', 'profile_image')
        # 모든 필드를 읽기 전용으로 만들어도 안전합니다.
        read_only_fields = fields

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])
        token['username'] = user.username
        token['is_staff'] = user.is_staff
        return token
    
class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True)
    new_password_confirm = serializers.CharField(required=True, write_only=True)

    def validate_current_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("현재 비밀번호가 일치하지 않습니다.")
        return value

    def validate(self, data):
        if data['new_password'] != data['new_password_confirm']:
            raise serializers.ValidationError({"new_password_confirm": "새 비밀번호가 일치하지 않습니다."})
        return data

    def save(self, **kwargs):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user