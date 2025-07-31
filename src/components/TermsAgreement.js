import React, { useState, useEffect } from 'react';
import { Form, Card } from 'react-bootstrap';

// 약관 동의 상태를 부모 컴포넌트로 전달하기 위한 props
function TermsAgreement({ onAgreementChange }) {
    const [agreements, setAgreements] = useState({
        all: false,
        termsOfService: false,
        privacyPolicy: false,
    });

    // 개별 약관 동의 상태가 변경될 때마다 부모 컴포넌트에 유효성 전달
    useEffect(() => {
        const allRequiredAgreed = agreements.termsOfService && agreements.privacyPolicy;
        setAgreements(prev => ({ ...prev, all: allRequiredAgreed }));
        if (onAgreementChange) {
            onAgreementChange(allRequiredAgreed);
        }
    }, [agreements.termsOfService, agreements.privacyPolicy, onAgreementChange]);

    // '전체 동의' 체크박스 핸들러
    const handleAllAgreement = (e) => {
        const { checked } = e.target;
        setAgreements({
            all: checked,
            termsOfService: checked,
            privacyPolicy: checked,
        });
    };

    // 개별 체크박스 핸들러
    const handleSingleAgreement = (e) => {
        const { name, checked } = e.target;
        setAgreements(prev => ({ ...prev, [name]: checked }));
    };

    const termsStyle = {
        height: '10rem',
        overflowY: 'scroll',
        border: '1px solid #dee2e6',
        padding: '1rem',
        fontSize: '0.875rem'
    };

    return (
        <Card className="p-3 my-4">
            <Form.Check 
                type="checkbox"
                id="all-agree"
                name="all"
                label="아래 약관에 모두 동의합니다."
                checked={agreements.all}
                onChange={handleAllAgreement}
                className="fw-bold mb-3"
            />
            <hr />

            {/* 이용약관 */}
            <Form.Group className="mb-3">
                <Form.Check 
                    type="checkbox"
                    id="terms-agree"
                    name="termsOfService"
                    label="이용약관 동의 (필수)"
                    checked={agreements.termsOfService}
                    onChange={handleSingleAgreement}
                    required
                />
                <div style={termsStyle} className="mt-2">
                    <strong>제1조 (목적)</strong><br />
                    이 약관은... (약관 내용) <br /><br />
                    <strong>제2조 (정의)</strong><br />
                    "이용자"란... (약관 내용) <br />
                    ... (스크롤 가능한 약관 내용) ...
                </div>
            </Form.Group>

            {/* 개인정보 수집 및 이용 동의 */}
            <Form.Group className="mb-3">
                <Form.Check 
                    type="checkbox"
                    id="privacy-agree"
                    name="privacyPolicy"
                    label="개인정보 수집 및 이용 동의 (필수)"
                    checked={agreements.privacyPolicy}
                    onChange={handleSingleAgreement}
                    required
                />
                <div style={termsStyle} className="mt-2">
                    <strong>1. 수집하는 개인정보 항목</strong><br />
                    회사는... (개인정보 수집 동의 내용) <br /><br />
                    <strong>2. 개인정보의 수집 및 이용 목적</strong><br />
                    회사는 수집한 개인정보를 다음의 목적을 위해 활용합니다... (내용) <br />
                    ... (스크롤 가능한 약관 내용) ...
                </div>
            </Form.Group>
        </Card>
    );
}

export default TermsAgreement;