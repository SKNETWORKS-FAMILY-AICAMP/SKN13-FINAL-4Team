import httpx
import os
import base64
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Payment
from .serializers import (
    PaymentPrepareSerializer,
    PaymentConfirmSerializer,
    PaymentDetailSerializer,
)
from users.models import UserWallet, CashLog
from chat.models import ChatRoom
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import logging

logger = logging.getLogger(__name__)
channel_layer = get_channel_layer()


class DonationAPIView(APIView):
    """
    채팅방에 크레딧을 후원하는 API
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        room_id = request.data.get('roomId')
        amount = request.data.get('amount')
        message = request.data.get('message', '')
        tts_enabled = request.data.get('tts_enabled', False)

        if not all([room_id, amount]):
            return Response({'error': 'roomId와 amount는 필수입니다.'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            amount = int(amount)
            if amount <= 0:
                raise ValueError
        except (ValueError, TypeError):
            return Response({'error': 'amount는 0보다 큰 정수여야 합니다.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            chatroom = get_object_or_404(ChatRoom, id=room_id)
            user = request.user
            wallet = user.wallet

            if wallet.balance < amount:
                return Response({'error': '보유 크레딧이 부족합니다.'}, status=status.HTTP_400_BAD_REQUEST)

            # DB 트랜잭션 시작
            with transaction.atomic():
                wallet.balance -= amount
                wallet.save()

                CashLog.objects.create(
                    wallet=wallet,
                    log_type='use',
                    amount=-amount,
                    description=f"'{chatroom.name}' 방 후원"
                )

            # WebSocket으로 후원 메시지 전송
            # 여기서 room_id는 채팅방의 pk(id)를 사용합니다.
            room_group_name = f'streaming_chat_{chatroom.influencer.username}'
            async_to_sync(channel_layer.group_send)(
                room_group_name,
                {
                    'type': 'donation_message',
                    'data': {
                        'username': user.nickname or user.username,
                        'amount': amount,
                        'message': message,
                        'tts_enabled': tts_enabled,
                    }
                }
            )
            
            return Response({'success': '후원이 완료되었습니다.'}, status=status.HTTP_200_OK)

        except UserWallet.DoesNotExist:
            return Response({'error': '지갑 정보를 찾을 수 없습니다.'}, status=status.HTTP_404_NOT_FOUND)
        except ChatRoom.DoesNotExist:
            return Response({'error': '채팅방을 찾을 수 없습니다.'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"후원 처리 중 오류 발생: {e}")
            return Response({'error': '후원 처리 중 오류가 발생했습니다.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PaymentPrepareAPIView(APIView):
    """
    결제 정보를 생성하고 프론트엔드에 order_id를 반환하는 API
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PaymentPrepareSerializer(data=request.data)
        if serializer.is_valid():
            amount = serializer.validated_data['amount']
            user = request.user

            # 데이터베이스에 예비 결제 정보 저장
            payment = Payment.objects.create(
                user=user,
                amount=amount,
                status=Payment.PaymentStatus.READY
            )
            
            response_data = {
                'order_id': payment.order_id,
            }
            return Response(response_data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PaymentConfirmAPIView(APIView):
    """
    토스페이먼츠 결제를 최종 승인하고 처리하는 API
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PaymentConfirmSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        order_id = str(serializer.validated_data['orderId'])
        payment_key = serializer.validated_data['paymentKey']
        amount = serializer.validated_data['amount']

        # 1. DB에서 주문 정보 조회
        payment = get_object_or_404(Payment, order_id=order_id)

        # 2. 요청된 금액과 DB에 저장된 금액이 일치하는지 확인 (보안)
        if payment.amount != amount:
            return Response({'error': '결제 금액이 일치하지 않습니다.'}, status=status.HTTP_400_BAD_REQUEST)

        # 3. 토스페이먼츠에 결제 승인 요청
        TOSS_SECRET_KEY = os.environ.get('TOSS_SECRET_KEY')
        if not TOSS_SECRET_KEY:
             return Response({'error': '결제 설정이 올바르지 않습니다.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        url = "https://api.tosspayments.com/v1/payments/confirm"
        encoded_key = base64.b64encode(f"{TOSS_SECRET_KEY}:".encode('utf-8')).decode('utf-8')
        headers = {
            "Authorization": f"Basic {encoded_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "orderId": order_id,
            "amount": amount,
            "paymentKey": payment_key,
        }

        try:
            response = httpx.post(url, json=payload, headers=headers)
            response.raise_for_status()  # HTTP 오류 발생 시 예외 발생
            response_data = response.json()

            # 4. 결제 승인 성공 시 DB 처리 (트랜잭션으로 원자성 보장)
            with transaction.atomic():
                # 4-1. Payment 모델 업데이트
                payment.payment_key = payment_key
                payment.status = Payment.PaymentStatus.PAID
                payment.save()

                # 4-2. UserWallet 잔액 업데이트
                wallet, created = UserWallet.objects.get_or_create(user=request.user)
                wallet.balance += amount
                wallet.save()

                # 4-3. CashLog 기록
                CashLog.objects.create(
                    wallet=wallet,
                    log_type='charge',
                    amount=amount,
                    description=f"{amount} 크레딧 충전"
                )
            
            # 5. 프론트엔드에 최종 결과 반환
            final_payment_data = PaymentDetailSerializer(payment).data
            return Response(final_payment_data, status=status.HTTP_200_OK)

        except httpx.HTTPStatusError as e:
            # 토스페이먼츠 API 호출 실패 시
            payment.status = Payment.PaymentStatus.FAILED
            payment.save()
            error_data = e.response.json()
            return Response(error_data, status=e.response.status_code)
        except Exception as e:
            # 기타 예외 처리
            payment.status = Payment.PaymentStatus.FAILED
            payment.save()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)