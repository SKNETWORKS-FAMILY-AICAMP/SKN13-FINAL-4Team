from django.shortcuts import render
from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.parsers import MultiPartParser, FormParser

from .models import User 
from .serializers import MyTokenObtainPairSerializer, UserRegistrationSerializer, UserSerializer,CustomTokenObtainPairSerializer, PasswordChangeSerializer, ProfileUpdateSerializer


class UserRegistrationAPIView(APIView):
    def post(self, request):
        # 사용자가 보낸 데이터를 Serializer에 전달
        serializer = UserRegistrationSerializer(data=request.data)
        
        # 유효성 검사
        if serializer.is_valid():
            serializer.save() # .create() 메소드가 호출됨
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        # 유효성 검사 실패 시 에러 응답
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MyProfileAPIView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        # GET 요청 시에는 기존처럼 UserSerializer를 사용합니다.
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
        
    def patch(self, request):
        """
        프로필 정보(닉네임, 프로필 이미지)를 업데이트합니다.
        """
        # ✅ PATCH 요청 시에는 새로 만든 ProfileUpdateSerializer를 사용합니다.
        serializer = ProfileUpdateSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            # 성공 응답으로는 전체 사용자 정보를 다시 보내줍니다.
            return Response(UserSerializer(request.user).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



class UserAdminViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminUser]
    serializer_class = UserSerializer
    def get_queryset(self):
        """
        이 ViewSet이 사용할 객체 목록을 반환합니다.
        관리자는 모든 사용자를 볼 수 있도록 합니다.
        """
        return User.objects.all().order_by('id')
    
class CustomTokenObtainPairView(TokenObtainPairView):
    """
    last_login 필드를 업데이트하는 커스텀 토큰 발급 뷰
    """
    serializer_class = CustomTokenObtainPairSerializer

# ...

class NicknameCheckAPIView(APIView):
    """
    닉네임 중복 체크 API
    - 로그인 여부에 따라 다른 로직으로 중복 검사 수행
    """
    def get(self, request):
        nickname = request.query_params.get('nickname')
        
        if not nickname:
            return Response(
                {"error": "닉네임을 입력해주세요."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        #  2. 사용자가 로그인했는지 여부에 따라 분기 처리
        if request.user.is_authenticated:
            # 로그인한 사용자는 자기 자신을 제외하고 중복 검사
            is_taken = User.objects.filter(nickname=nickname).exclude(pk=request.user.pk).exists()
        else:
            # 로그인하지 않은 사용자(회원가입 시)는 전체 DB에서 중복 검사
            is_taken = User.objects.filter(nickname=nickname).exists()
        
        return Response({"is_taken": is_taken})
    
class UsernameCheckAPIView(APIView):
    """
    아이디 중복 체크 API
    """
    def get(self, request):
        username = request.query_params.get('username')
        if not username:
            return Response(
                {"error": "아이디를 입력해주세요."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        is_taken = User.objects.filter(username=username).exists()
        
        return Response({"is_taken": is_taken}, status=status.HTTP_200_OK)
    
class PasswordChangeAPIView(APIView):
    """
    비밀번호 변경 API
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response({"detail": "비밀번호가 성공적으로 변경되었습니다."}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
class MyTokenObtainPairView(TokenObtainPairView):
    """
    로그인 시 username을 포함한 커스텀 토큰을 발급하는 View
    """
    serializer_class = MyTokenObtainPairSerializer