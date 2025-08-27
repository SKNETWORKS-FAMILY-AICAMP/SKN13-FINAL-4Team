import React, { useState, useEffect } from 'react';
import { loadTossPayments, ANONYMOUS } from "@tosspayments/tosspayments-sdk";
import api from '../../utils/unifiedApiClient';
import './CreditChargeModal.css';

// 클라이언트 키는 노출되어도 괜찮은 값입니다.
const clientKey = "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm";

const CreditChargeModal = ({ show, onClose }) => {
  const [amount, setAmount] = useState({ currency: "KRW", value: 1000 });
  const [error, setError] = useState('');
  const [widgets, setWidgets] = useState(null);
  const [ready, setReady] = useState(false);

  // 위젯 초기화
  useEffect(() => {
    if (!show) {
      setReady(false);
      return;
    }

    const fetchPaymentWidgets = async () => {
      try {
        const tossPayments = await loadTossPayments(clientKey);
        const widget = tossPayments.widgets({ customerKey: ANONYMOUS });
        setWidgets(widget);
      } catch (error) {
        console.error("Error initializing Toss Payments:", error);
        setError("결제 위젯을 불러오는 중 오류가 발생했습니다.");
      }
    };

    fetchPaymentWidgets();
  }, [show]);

  // 위젯 렌더링
  useEffect(() => {
    if (widgets === null) {
      return;
    }

    const renderWidgets = async () => {
      try {
        await widgets.setAmount(amount);

        await Promise.all([
          widgets.renderPaymentMethods({
            selector: "#payment-method",
            variantKey: "DEFAULT",
          }),
          widgets.renderAgreement({
            selector: "#agreement",
            variantKey: "AGREEMENT",
          }),
        ]);
        setReady(true);
      } catch (error) {
        console.error("Error rendering Toss Payments widgets:", error);
        setError("결제 UI를 렌더링하는 중 오류가 발생했습니다.");
      }
    };

    renderWidgets();
  }, [widgets]);

  // 금액 변경 시 위젯 금액 업데이트
  useEffect(() => {
    if (widgets === null || !ready) {
      return;
    }
    
    const updateAmount = async () => {
      try {
        if (amount.value >= 1000 && amount.value % 100 === 0) {
          await widgets.setAmount(amount);
        }
      } catch (error) {
        console.error("Failed to update amount:", error);
      }
    };

    updateAmount();
  }, [amount, widgets, ready]);

  const handleAmountChange = (e) => {
    const value = Number(e.target.value);
    setAmount({ ...amount, value });
    validateAmount(value);
  };

  const validateAmount = (value) => {
    if (value < 1000) {
      setError('최소 충전 금액은 1,000크레딧입니다.');
    } else if (value % 100 !== 0) {
      setError('100크레딧 단위로 충전할 수 있습니다.');
    } else {
      setError('');
    }
  };

  const handlePresetAmount = (presetAmountValue) => {
    setAmount({ ...amount, value: presetAmountValue });
    validateAmount(presetAmountValue);
  };

  const handleCharge = async () => {
    if (error || !ready) {
        alert("결제를 진행할 수 없습니다. 입력 금액을 확인해주세요.");
        return;
    }
    try {
      const response = await api.post('/api/payments/prepare/', { amount: amount.value });
      const { order_id } = response.data;

      await widgets.requestPayment({
        orderId: order_id,
        orderName: `${amount.value.toLocaleString()} 크레딧 충전`,
        successUrl: `${window.location.origin}/success`,
        failUrl: `${window.location.origin}/fail`,
        customerName: "김토스",
      });
    } catch (error) {
      console.error("Payment request error:", error);
      alert("결제 요청에 실패했습니다.");
    }
  };

  if (!show) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>크레딧 충전</h2>
        <div className="amount-input-container">
          <input
            type="number"
            value={amount.value}
            onChange={handleAmountChange}
            step="100"
            min="1000"
            className="amount-input"
          />
          <span>크레딧</span>
        </div>
        <div className="preset-buttons">
          <button onClick={() => handlePresetAmount(1000)}>1,000</button>
          <button onClick={() => handlePresetAmount(5000)}>5,000</button>
          <button onClick={() => handlePresetAmount(10000)}>10,000</button>
          <button onClick={() => handlePresetAmount(50000)}>50,000</button>
        </div>
        <div className="price-display">
          <p>{amount.value.toLocaleString()} 크레딧 = {amount.value.toLocaleString()} 원</p>
        </div>
        {error && <p className="error-message">{error}</p>}
        
        <div id="payment-method" />
        <div id="agreement" />

        <div className="modal-actions">
          <button onClick={onClose} className="cancel-button">취소</button>
          <button onClick={handleCharge} disabled={!!error || !ready} className="charge-button">
            {amount.value.toLocaleString()}원 결제하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreditChargeModal;