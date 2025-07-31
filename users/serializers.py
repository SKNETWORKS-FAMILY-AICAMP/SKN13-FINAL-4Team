from rest_framework import serializers
from .models import User

class UserRegistrationSerializer(serializers.ModelSerializer):
    password_confirm = serializers.CharField(
        write_only=True, 
        style={'input_type': 'password'},
        label='Password Confirmation'
    )

    class Meta:
        model = User
        fields = ('username', 'password', 'password_confirm', 'nickname', 'email')
        extra_kwargs = {
            'password': {'write_only': True}
        }

    #유효성 검사 추가
    def validate_username(self, value):
        if len(value) < 6:
            raise serializers.ValidationError("ID는 6자리 이상이어야 합니다.")
        return value

    #비밀번호가 일치하는지 검사
    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({"password_confirm": "비밀번호가 일치하지 않습니다."})
        
        # 비밀번호 길이 검사
        if len(data['password']) < 8:
            raise serializers.ValidationError({"password": "비밀번호는 8자리 이상이어야 합니다."})
            
        return data

    def create(self, validated_data):
        # validated_data에서 password_confirm 필드를 제거.
        validated_data.pop('password_confirm')
        
        user = User.objects.create_user(**validated_data)
        return user
    
class UserManagementSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('username', 'nickname', 'email', 'date_joined')