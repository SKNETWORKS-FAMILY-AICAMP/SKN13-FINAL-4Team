# backend/payments/urls.py
from django.urls import path
from .views import PaymentPrepareAPIView, PaymentConfirmAPIView

urlpatterns = [
    path('prepare/', PaymentPrepareAPIView.as_view(), name='payment-prepare'),
    path('confirm/', PaymentConfirmAPIView.as_view(), name='payment-confirm'),
]
