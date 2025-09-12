
// src/components/auth/FindPassword.js

import React, { useState } from 'react';
import api from '../../utils/unifiedApiClient';
import { Link, useNavigate } from 'react-router-dom';
import { Container, Form, Button, Alert, Row, Col, Card } from 'react-bootstrap';

function FindPassword() {
    const [step, setStep] = useState('request'); 
    
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        code: '',
        new_password: '',
        new_password_confirm: ''
    });
    
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleRequestCode = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');
        try {
            const response = await api.post('/api/users/password-reset/request/', {
                username: formData.username,
                email: formData.email
            });
            setMessage(response.data.message);
            setStep('confirm');
        } catch (err) {
            setError('요청 처리 중 오류가 발생했습니다.');
        }
    };

    const handleConfirmReset = async (e) => {
        e.preventDefault();
        if (formData.new_password !== formData.new_password_confirm) {
            setError('새 비밀번호가 일치하지 않습니다.');
            return;
        }

        setMessage('');
        setError('');

        try {
            const response = await api.post('/api/users/password-reset/confirm/', {
                username: formData.username,
                code: formData.code,
                new_password: formData.new_password,
                new_password_confirm: formData.new_password_confirm // API로 '새 비밀번호 확인' 값 전송
            });
            setMessage(response.data.message);
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (err) {
            setError(err.response?.data?.error || '비밀번호 재설정 중 오류가 발생했습니다.');
        }
    };

    return (
        <Container>
            <Row className="justify-content-md-center mt-5">
                <Col md={6} lg={4}>
                    <Card className="p-4">
                        <Card.Body>
                            <h2 className="text-center mb-4">비밀번호 찾기</h2>
                            {message && <Alert variant="info">{message}</Alert>}
                            {error && <Alert variant="danger">{error}</Alert>}
                            
                            {step === 'request' && (
                                <Form onSubmit={handleRequestCode}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>아이디</Form.Label>
                                        <Form.Control type="text" name="username" onChange={handleChange} required />
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Form.Label>이메일</Form.Label>
                                        <Form.Control type="email" name="email" onChange={handleChange} required />
                                    </Form.Group>
                                    <div className="d-grid mt-4">
                                        <Button variant="primary" type="submit">인증번호 요청</Button>
                                    </div>
                                </Form>
                            )}

                            {step === 'confirm' && (
                                <Form onSubmit={handleConfirmReset}>
                                    <p className="text-muted small"><strong>{formData.email}</strong>(으)로 전송된 인증번호를 입력해주세요.</p>
                                    <Form.Group className="mb-3">
                                        <Form.Label>인증번호</Form.Label>
                                        <Form.Control type="text" name="code" onChange={handleChange} required />
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Form.Label>새 비밀번호</Form.Label>
                                        <Form.Control type="password" name="new_password" onChange={handleChange} required />
                                        <Form.Text className="text-muted">
                                            (영문, 숫자, 특수문자 포함 9자 이상)
                                        </Form.Text>
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Form.Label>새 비밀번호 확인</Form.Label>
                                        <Form.Control type="password" name="new_password_confirm" onChange={handleChange} required />
                                    </Form.Group>
                                    <div className="d-grid mt-4">
                                        <Button variant="success" type="submit">비밀번호 재설정</Button>
                                    </div>
                                </Form>
                            )}
                        </Card.Body>
                    </Card>
                    <div className="text-center mt-3">
                        <Link to="/login" className="text-decoration-none small">로그인</Link>
                        <span className="mx-2 small">|</span>
                        <Link to="/find-id" className="text-decoration-none small">아이디 찾기</Link>
                    </div>
                </Col>
            </Row>
        </Container>
    );
}

export default FindPassword;