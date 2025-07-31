from django.shortcuts import render
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated # 권한 import
from .serializers import UserRegistrationSerializer
from .serializers import UserManagementSerializer # Serializer 이름 변경
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


class UserManagementAPIView(APIView): # 클래스 이름 변경
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserManagementSerializer(request.user) # Serializer 이름 변경
        return Response(serializer.data)