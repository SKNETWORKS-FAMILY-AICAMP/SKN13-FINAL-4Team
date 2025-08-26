import React, { useState, useEffect } from 'react';
import './DonationIsland.css';
import apiClient from '../../utils/apiClient';
import CreditChargeModal from '../payments/CreditChargeModal';

const DonationIsland = ({ chatRoomId, streamerId, onClose }) => {
    const [donationMessage, setDonationMessage] = useState('');
    const [ttsEnabled, setTtsEnabled] = useState(true);
    const [creditAmount, setCreditAmount] = useState(0);
    const [userBalance, setUserBalance] = useState(0);
    const [isChargeModalOpen, setChargeModalOpen] = useState(false);

    // 보유 크레딧을 서버에서 조회하는 함수
    const fetchUserWallet = async () => {
        try {
            const response = await apiClient.get('/api/users/wallet/');
            setUserBalance(response.data.balance);
        } catch (error) {
            console.error('Error fetching user wallet:', error);
            // alert('보유 크레딧을 불러오는 데 실패했습니다.');
            setUserBalance(5432); // 에러 발생 시
        }
    };

    // 컴포넌트가 처음 로드될 때 보유 크레딧을 조회합니다.
    useEffect(() => {
        fetchUserWallet();
    }, []);

    const handleCreditPreset = (amount) => {
        setCreditAmount(prev => prev + amount);
    };

    const handleCharge = () => {
        setChargeModalOpen(true);
    };

    const handleDonate = async () => {
        if (creditAmount <= 0) {
            alert('후원할 크레딧을 입력해주세요.');
            return;
        }
        if (creditAmount > userBalance) {
            alert('보유 크레딧이 부족합니다.');
            return;
        }

        try {
            await apiClient.post(`/api/chat/rooms/${chatRoomId}/donate/`, {
                amount: creditAmount,
                message: donationMessage,
                tts_enabled: ttsEnabled,
            });
            alert('후원이 성공적으로 완료되었습니다.');
            
            // 후원 후 최신 잔액을 다시 불러옵니다.
            fetchUserWallet(); 
            
            setCreditAmount(0);
            setDonationMessage('');
            onClose(); // 후원 창 닫기
        } catch (error) {
            console.error('Error making donation:', error);
            alert(error.response?.data?.error || '후원에 실패했습니다.');
        }
    };

    return (
        <>
            <div className="donation-island-backdrop">
                <div className="donation-island">
                    <button className="close-button" onClick={onClose}>&times;</button>
                    <h2>크리에이터 후원하기</h2>

                    <div className="form-section">
                        <label htmlFor="donation-message">후원 메시지</label>
                        <textarea
                            id="donation-message"
                            value={donationMessage}
                            onChange={(e) => setDonationMessage(e.target.value)}
                            placeholder="따뜻한 응원의 메시지를 남겨주세요."
                            rows="3"
                        />
                    </div>

                    <div className="form-section tts-switch">
                        <span>TTS 활성화</span>
                        <label className="switch">
                            <input
                                id="tts-enabled"
                                type="checkbox"
                                checked={ttsEnabled}
                                onChange={() => setTtsEnabled(!ttsEnabled)}
                            />
                            <span className="slider round"></span>
                        </label>
                    </div>

                    <div className="form-section credit-info">
                        <span>보유 크레딧: {userBalance.toLocaleString()} C</span>
                        <button onClick={handleCharge} className="charge-button">충전</button>
                    </div>

                    <div className="form-section">
                        <label htmlFor="credit-amount">후원 크레딧</label>
                        <input
                            id="credit-amount"
                            type="number"
                            value={creditAmount}
                            onChange={(e) => setCreditAmount(parseInt(e.target.value, 10) || 0)}
                            placeholder="후원할 금액"
                            className="credit-input"
                        />
                        <div className="credit-presets">
                            <button onClick={() => handleCreditPreset(1000)}>+1,000</button>
                            <button onClick={() => handleCreditPreset(3000)}>+3,000</button>
                            <button onClick={() => handleCreditPreset(5000)}>+5,000</button>
                            <button onClick={() => handleCreditPreset(10000)}>+10,000</button>
                        </div>
                    </div>

                    <button onClick={handleDonate} className="donate-button" disabled={creditAmount <= 0}>
                        {creditAmount > 0 ? `${creditAmount.toLocaleString()} 크레딧 후원하기` : '후원하기'}
                    </button>
                </div>
            </div>
            <CreditChargeModal show={isChargeModalOpen} onClose={() => setChargeModalOpen(false)} />
        </>
    );
};

export default DonationIsland;