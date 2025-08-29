import React, { useState, useEffect } from 'react';
import styles from './DonationIsland.module.css';
import api from '../../utils/unifiedApiClient';
import CreditChargeModal from '../payments/CreditChargeModal';

const DonationIsland = ({ roomId, streamerId, onClose }) => {
    const [donationMessage, setDonationMessage] = useState('');
    const [ttsEnabled, setTtsEnabled] = useState(true);
    const [creditAmount, setCreditAmount] = useState(0);
    const [userBalance, setUserBalance] = useState(0);
    const [isChargeModalOpen, setChargeModalOpen] = useState(false);

    // 보유 크레딧을 서버에서 조회하는 함수
    const fetchUserWallet = async () => {
        try {
            const response = await api.get('/api/users/wallet/');
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
            await api.post('/api/payments/donate/', {
                roomId: roomId,
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
            <div className={styles.backdrop}>
                <div className={styles.island}>
                    <button className={styles.closeButton} onClick={onClose}>&times;</button>
                    <h2 className={styles.title}>크리에이터 후원하기</h2>

                    <div className={styles.section}>
                        <label htmlFor="donation-message">후원 메시지</label>
                        <textarea
                            id="donation-message"
                            value={donationMessage}
                            onChange={(e) => setDonationMessage(e.target.value)}
                            placeholder="따뜻한 응원의 메시지를 남겨주세요."
                            rows="3"
                            className={styles.textarea}
                        />
                    </div>

                    <div className={`${styles.section} ${styles.ttsSwitch}`}>
                        <span>TTS 활성화</span>
                        <label className={styles.switch}>
                            <input
                                id="tts-enabled"
                                type="checkbox"
                                checked={ttsEnabled}
                                onChange={() => setTtsEnabled(!ttsEnabled)}
                            />
                            <span className={`${styles.slider} ${styles.round}`}></span>
                        </label>
                    </div>

                    <div className={`${styles.section} ${styles.creditInfo}`}>
                        <span>보유 크레딧: {userBalance.toLocaleString()} C</span>
                        <button onClick={handleCharge} className={styles.chargeButton}>충전</button>
                    </div>

                    <div className={styles.section}>
                        <label htmlFor="credit-amount">후원 크레딧</label>
                        <input
                            id="credit-amount"
                            type="number"
                            value={creditAmount}
                            onChange={(e) => setCreditAmount(parseInt(e.target.value, 10) || 0)}
                            placeholder="후원할 금액"
                            className={styles.creditInput}
                        />
                        <div className={styles.creditPresets}>
                            <button onClick={() => handleCreditPreset(1000)}>+1,000</button>
                            <button onClick={() => handleCreditPreset(3000)}>+3,000</button>
                            <button onClick={() => handleCreditPreset(5000)}>+5,000</button>
                            <button onClick={() => handleCreditPreset(10000)}>+10,000</button>
                        </div>
                    </div>

                    <button onClick={handleDonate} className={styles.donateButton} disabled={creditAmount <= 0}>
                        {creditAmount > 0 ? `${creditAmount.toLocaleString()} 크레딧 후원하기` : '후원하기'}
                    </button>
                </div>
            </div>
            <CreditChargeModal show={isChargeModalOpen} onClose={() => setChargeModalOpen(false)} />
        </>
    );
};

export default DonationIsland;