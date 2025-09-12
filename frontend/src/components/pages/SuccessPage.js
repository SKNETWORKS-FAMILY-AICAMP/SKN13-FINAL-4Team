import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from "react-router-dom";
import api from '../../utils/unifiedApiClient';

export function SuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [paymentResult, setPaymentResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const confirmPayment = async () => {
      const paymentKey = searchParams.get("paymentKey");
      const orderId = searchParams.get("orderId");
      const amount = searchParams.get("amount");

      if (!paymentKey || !orderId || !amount) {
        setError("결제 정보가 올바르지 않습니다.");
        return;
      }

      try {
        const response = await api.post('/api/payments/confirm/', {
          paymentKey,
          orderId,
          amount: Number(amount),
        });
        setPaymentResult(response.data);
      } catch (err) {
        console.error("Payment confirmation error:", err);
        setError(err.response?.data?.message || "결제 승인 중 오류가 발생했습니다.");
        // 실패 페이지로 리디렉션
        navigate(`/fail?message=${err.response?.data?.message || "결제 승인 실패"}&code=${err.response?.data?.code || "UNKNOWN_ERROR"}`);
      }
    };

    confirmPayment();
  }, [searchParams, navigate]);

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      {error && (
        <div>
          <h1>결제 승인 실패</h1>
          <p style={{ color: 'red' }}>{error}</p>
        </div>
      )}
      {!error && !paymentResult && (
        <div>
          <h1>결제 승인 중...</h1>
          <p>잠시만 기다려주세요.</p>
        </div>
      )}
      {paymentResult && (
        <div>
          <h1>결제 성공</h1>
          <p>주문이 성공적으로 완료되었습니다.</p>
          <p>{`주문번호: ${paymentResult.order_id}`}</p>
          <p>{`결제 금액: ${Number(paymentResult.amount).toLocaleString()}원`}</p>
          <p>이 창을 닫고 방송으로 돌아가세요.</p>
        </div>
      )}
    </div>
  );
}

export default SuccessPage;
