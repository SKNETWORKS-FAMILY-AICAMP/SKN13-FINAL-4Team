# backend/payments/serializers.py
from rest_framework import serializers
from .models import Payment

class PaymentPrepareSerializer(serializers.Serializer):
    """
    결제 준비 단계에서 프론트엔드로부터 받을 데이터에 대한 Serializer
    """
    amount = serializers.IntegerField(min_value=1000, help_text="충전할 크레딧 금액")

    def validate_amount(self, value):
        if value % 100 != 0:
            raise serializers.ValidationError("금액은 100원 단위여야 합니다.")
        return value

class PaymentConfirmSerializer(serializers.Serializer):
    """
    결제 승인 단계에서 프론트엔드로부터 받을 데이터에 대한 Serializer
    """
    paymentKey = serializers.CharField(max_length=200)
    orderId = serializers.UUIDField()
    amount = serializers.IntegerField(min_value=1000)

class PaymentDetailSerializer(serializers.ModelSerializer):
    """
    결제 정보 응답을 위한 Serializer
    """
    class Meta:
        model = Payment
        fields = ('order_id', 'status', 'amount', 'updated_at')
