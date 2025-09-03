from rest_framework import status
from django.shortcuts import render
from rest_framework import viewsets, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.views import APIView
from django.db.models import Q
from django.conf import settings 
import random 
from django.utils import timezone
from datetime import timedelta
from django.core.mail import send_mail

from .models import User, UserWallet, CashLog
from .serializers import MyTokenObtainPairSerializer, UserRegistrationSerializer, UserSerializer,CustomTokenObtainPairSerializer, PasswordChangeSerializer, ProfileUpdateSerializer, UserWalletSerializer

class UserWalletAPIView(APIView):
    """사용자 크레딧 정보 API"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        wallet, created = UserWallet.objects.get_or_create(user=request.user)
        serializer = UserWalletSerializer(wallet)
        return Response(serializer.data)

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

from django.db.models import Q # ✅ 1. Q 객체를 import 합니다.
from rest_framework import viewsets, filters
from rest_framework.permissions import IsAdminUser
from .models import User
from .serializers import UserSerializer

# ... (다른 View 클래스들은 그대로 둡니다)

class UserAdminViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminUser]
    serializer_class = UserSerializer

    def get_queryset(self):
        """
        URL의 'search' 쿼리 파라미터를 사용하여 사용자 목록을 필터링합니다.
        검색어가 숫자이면 ID를, 문자이면 username/nickname을 검색합니다.
        """
        queryset = User.objects.all().order_by('id')
        
        search_query = self.request.query_params.get('search', None)
        if search_query:
            # 1. 검색어가 숫자로만 이루어져 있는지 확인합니다.
            if search_query.isdigit():
                # 2. 숫자이면 id 필드에서 정확히 일치하는 것을 찾습니다.
                queryset = queryset.filter(id=search_query)
            else:
                # 3. 숫자가 아니면 기존처럼 username과 nickname에서 검색합니다.
                queryset = queryset.filter(
                    Q(username__icontains=search_query) | 
                    Q(nickname__icontains=search_query)
                )
        return queryset

    
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


class DevAddCreditsAPIView(APIView):
    """개발용 크레딧 추가 API (개발 환경 전용)"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        # 개발 환경에서만 활성화
        if not settings.DEBUG:
            return Response({'error': '개발 환경에서만 사용 가능합니다.'}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            amount = int(request.data.get('amount', 0))
            if amount <= 0 or amount > 10000000:  # 최대 1천만 크레딧
                return Response({'error': '유효하지 않은 금액입니다. (1-10,000,000)'}, status=status.HTTP_400_BAD_REQUEST)
            
            # 지갑 가져오거나 생성
            wallet, created = UserWallet.objects.get_or_create(user=request.user)
            
            # 크레딧 추가
            wallet.balance += amount
            wallet.save()
            
            # 로그 기록
            CashLog.objects.create(
                wallet=wallet,
                log_type='charge',
                amount=amount,
                description=f"[DEV] 개발용 크레딧 추가 {amount:,}C"
            )
            
            return Response({
                'success': True,
                'message': f'{amount:,} 크레딧이 추가되었습니다.',
                'balance': wallet.balance
            }, status=status.HTTP_200_OK)
            
        except (ValueError, TypeError):
            return Response({'error': '올바른 숫자를 입력해주세요.'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f'서버 오류: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            
class FindUsernameAPIView(APIView):
    """
    이메일을 기반으로 사용자 아이디를 찾아 반환하는 API
    """
    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({"error": "이메일을 입력해주세요."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
            username = user.username
            # 보안을 위해 username의 뒤 3자리를 '*'로 마스킹
            masked_username = username[:-3] + '***' if len(username) > 3 else username[0] + '***'
            return Response({"username": masked_username}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({"error": "해당 이메일로 가입된 사용자를 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)


class PasswordResetRequestAPIView(APIView):
    """
    사용자 확인 후, 비밀번호 재설정 인증번호를 이메일로 발송합니다.
    """
    def post(self, request):
        username = request.data.get('username')
        email = request.data.get('email')

        try:
            user = User.objects.get(username=username, email=email)
            
            # 6자리 인증번호 생성
            code = str(random.randint(100000, 999999))
            
            # 인증번호 만료 시간 설정 (예: 10분 후)
            expires_at = timezone.now() + timedelta(minutes=10)
            
            # 사용자 정보에 인증번호와 만료시간 저장
            user.verification_code = code
            user.code_expires_at = expires_at
            user.save()
            
            # 이메일 발송
            send_mail(
                subject='[MyService] 비밀번호 재설정 인증번호 안내',
                message=f'회원님의 인증번호는 [{code}] 입니다. 10분 이내에 입력해주세요.',
                from_email='noreply@myservice.com', # settings.py에 설정된 발신자
                recipient_list=[user.email],
                fail_silently=False,
            )
            
            return Response({"message": "가입하신 이메일로 인증번호가 발송되었습니다."}, status=status.HTTP_200_OK)
        
        except User.DoesNotExist:
            # 사용자가 존재하지 않더라도, 계정 존재 여부를 알려주지 않기 위해 동일한 메시지를 반환합니다.
            return Response({"message": "가입하신 이메일로 인증번호가 발송되었습니다."}, status=status.HTTP_200_OK)

# users/views.py

class PasswordResetConfirmAPIView(APIView):
    """
    인증번호를 확인하고 새 비밀번호로 재설정합니다.
    """
    def post(self, request):
        username = request.data.get('username')
        code = request.data.get('code')
        new_password = request.data.get('new_password')
        # --- 새 비밀번호 확인 필드 추가 ---
        new_password_confirm = request.data.get('new_password_confirm')
        
        # --- 새 비밀번호와 확인 필드가 일치하는지 검사 ---
        if new_password != new_password_confirm:
            return Response({"error": "새 비밀번호가 일치하지 않습니다."}, status=status.HTTP_400_BAD_REQUEST)

        if not all([username, code, new_password, new_password_confirm]):
            return Response({"error": "모든 필드를 입력해주세요."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = User.objects.get(username=username)
            
            if user.verification_code != code or timezone.now() > user.code_expires_at:
                return Response({"error": "인증번호가 유효하지 않거나 만료되었습니다."}, status=status.HTTP_400_BAD_REQUEST)
            
            serializer = UserRegistrationSerializer()
            try:
                serializer.validate_password(new_password)
            except serializers.ValidationError as e:
                return Response({"error": e.detail[0]}, status=status.HTTP_400_BAD_REQUEST)

            user.set_password(new_password)
            user.verification_code = None
            user.code_expires_at = None
            user.save()
            
            return Response({"message": "비밀번호가 성공적으로 재설정되었습니다."}, status=status.HTTP_200_OK)
            
        except User.DoesNotExist:
            return Response({"error": "사용자를 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)