from django.db import models
from django.conf import settings
import uuid

class Payment(models.Model):
    """
    토스페이먼츠 결제 정보를 관리하는 모델
    """
    class PaymentStatus(models.TextChoices):
        READY = 'ready', '미결제'
        PAID = 'paid', '결제완료'
        CANCELLED = 'cancelled', '결제취소'
        FAILED = 'failed', '결제실패'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='payments',
        help_text='결제를 요청한 사용자'
    )
    amount = models.PositiveIntegerField(
        help_text='결제 요청 금액 (크레딧 양)'
    )
    order_id = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        unique=True,
        help_text='고유 주문 ID'
    )
    payment_key = models.CharField(
        max_length=200,
        null=True,
        blank=True,
        help_text='토스페이먼츠 결제 키'
    )
    status = models.CharField(
        max_length=10,
        choices=PaymentStatus.choices,
        default=PaymentStatus.READY,
        db_index=True,
        help_text='결제 상태'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text='거래 생성 시간'
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text='마지막 상태 변경 시간'
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'[{self.get_status_display()}] {self.user.username} - {self.amount}원'