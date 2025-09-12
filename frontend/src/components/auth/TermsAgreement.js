import React, { useState, useEffect } from 'react';
import { Form, Card, Button, Container, Row, Col } from 'react-bootstrap';

// 약관 내용을 별도의 객체나 파일로 분리하면 관리가 더 용이합니다.
const termsContent = {
  termsOfService: `
    <strong>제1조 (목적)</strong><br />
    이 약관은... (약관 내용) <br /><br />
    <strong>제2조 (정의)</strong><br />
    "이용자"란... (약관 내용) <br />
    ... (스크롤 가능한 약관 내용) ...
  `,
  privacyPolicy: `
    <strong>1. 수집하는 개인정보 항목</strong><br />
    회사는... (개인정보 수집 동의 내용) <br /><br />
    <strong>2. 개인정보의 수집 및 이용 목적</strong><br />
    회사는 수집한 개인정보를 다음의 목적을 위해 활용합니다... (내용) <br />
    ... (스크롤 가능한 약관 내용) ...
  `,
};

// -----------------------------------------------------------------------------
// 자식 컴포넌트: 사용자가 제공한 약관 동의 UI
// -----------------------------------------------------------------------------
function TermsAgreement({ onAgreementChange }) {
    const [agreements, setAgreements] = useState({
        all: false,
        termsOfService: false,
        privacyPolicy: false,
    });

    // 개별 약관 동의 상태가 변경될 때마다 부모 컴포넌트에 유효성 전달
    useEffect(() => {
        const allRequiredAgreed = agreements.termsOfService && agreements.privacyPolicy;
        // '전체 동의' 체크박스 상태 업데이트
        setAgreements(prev => ({ ...prev, all: allRequiredAgreed }));
        // 부모 컴포넌트로 동의 상태 전달
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
                className="fw-bold mb-3 text-start d-block"
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
                    className="text-start"
                />
                <div 
                    style={termsStyle} 
                    className="mt-2 text-start" 
                    dangerouslySetInnerHTML={{ __html: termsContent.termsOfService }} 
                />
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
                    className="text-start"
                />
                <div 
                    style={termsStyle} 
                    className="mt-2 text-start"
                    dangerouslySetInnerHTML={{ __html: termsContent.privacyPolicy }}
                />
            </Form.Group>
        </Card>
    );
}


// -----------------------------------------------------------------------------
// 부모 컴포넌트: 전체 회원가입 페이지
// -----------------------------------------------------------------------------
function SignupPage() {
    // 필수 약관 동의 여부를 관리하는 state
    const [isAgreed, setIsAgreed] = useState(false);

    // 자식(TermsAgreement) 컴포넌트로부터 동의 상태를 전달받을 콜백 함수
    const handleAgreementChange = (agreed) => {
        setIsAgreed(agreed);
    };

    const handleNextClick = () => {
        if (isAgreed) {
            alert('모든 필수 약관에 동의하셨습니다. 다음 단계로 진행합니다.');
            // 예: navigate('/signup-form');
        } else {
            alert('필수 약관에 모두 동의해야 합니다.');
        }
    };

    return (
        <Container className="my-5">
            <Row className="justify-content-md-center">
                <Col md={8} lg={6}>
                    <h1 className="text-center mb-4">회원가입</h1>
                    
                    {/* 약관 동의 컴포넌트 렌더링 */}
                    <TermsAgreement onAgreementChange={handleAgreementChange} />

                    {/* '다음' 버튼 */}
                    <div className="d-grid">
                        <Button 
                            variant="primary" 
                            size="lg"
                            onClick={handleNextClick}
                            disabled={!isAgreed} // isAgreed가 false이면 버튼 비활성화
                        >
                            다음
                        </Button>
                    </div>
                </Col>
            </Row>
        </Container>
    );
}

export default SignupPage;