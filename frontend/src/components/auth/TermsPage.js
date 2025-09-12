import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Card, Button, Container, Row, Col } from 'react-bootstrap';

function TermsPage() {
    const [agreements, setAgreements] = useState({
        all: false,
        termsOfService: false,
        privacyPolicy: false,
    });

    const navigate = useNavigate();

    useEffect(() => {
        const allRequiredAgreed = agreements.termsOfService && agreements.privacyPolicy;
        setAgreements(prev => ({ ...prev, all: allRequiredAgreed }));
    }, [agreements.termsOfService, agreements.privacyPolicy]);

    const handleAllAgreement = (e) => {
        const { checked } = e.target;
        setAgreements({
            all: checked,
            termsOfService: checked,
            privacyPolicy: checked,
        });
    };

    const handleSingleAgreement = (e) => {
        const { name, checked } = e.target;
        setAgreements(prev => ({ ...prev, [name]: checked }));
    };

    const handleNext = () => {
        // 다음 페이지로 이동하면서 state를 함께 전달합니다.
        navigate('/signup', { state: { termsAgreed: true } });
    };

    const termsStyle = {
        height: '10rem',
        overflowY: 'scroll',
        border: '1px solid #dee2e6',
        padding: '1rem',
        fontSize: '0.875rem'
    };

    return (
        <Container className="mt-5">
            <Row className="justify-content-md-center">
                <Col md={8} lg={6}>
                    <h2 className="text-center mb-4">이용약관 동의</h2>
                    <Card className="p-3 my-4">
                        <Form.Check 
                            type="checkbox"
                            id="all-agree"
                            name="all"
                            label="아래 약관에 모두 동의합니다."
                            checked={agreements.all}
                            onChange={handleAllAgreement}
                            className="fw-bold mb-3 text-start" 
                        />
                        <hr />
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
                            <div style={termsStyle} className="mt-2 text-start"> 
                                <strong>제1조 (목적)</strong><br />
                                이 약관은... (약관 내용)
                            </div>
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Check 
                                type="checkbox"
                                id="privacy-agree"
                                name="privacyPolicy"
                                label="개인정보 수집 및 이용 동의 (필수)"
                                checked={agreements.privacyPolicy}
                                onChange={handleSingleAgreement}
                                required
                                className="text-start" // ⬅️ text-start 클래스 추가
                            />
                            <div style={termsStyle} className="mt-2 text-start"> 
                                <strong>1. 수집하는 개인정보 항목</strong><br />
                                회사는... (개인정보 수집 동의 내용)
                            </div>
                        </Form.Group>
                    </Card>
                    <div className="d-grid mt-4 mb-5">
                        <Button variant="primary" onClick={handleNext} disabled={!agreements.all}>
                            다음
                        </Button>
                    </div>
                </Col>
            </Row>
        </Container>
    );
}

export default TermsPage;