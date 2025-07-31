from django.shortcuts import render
from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, IsAdminUser # 권한 import
from .models import User # User 모델을 import 해야 합니다
from .serializers import UserRegistrationSerializer
from .serializers import UserRegistrationSerializer, UserSerializer

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

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

class UserAdminViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminUser]
    serializer_class = UserSerializer
    def get_queryset(self):
        """
        이 ViewSet이 사용할 객체 목록을 반환합니다.
        관리자는 모든 사용자를 볼 수 있도록 합니다.
        """
        return User.objects.all().order_by('id')