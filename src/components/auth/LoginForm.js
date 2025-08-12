import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom'; // useNavigate import
import { Container, Form, Button, Alert, Row, Col, Card } from 'react-bootstrap';

// App.js로부터 onLogin 함수를 props로 받음
function LoginForm({ onLogin }) {
    const [formData, setFormData] = useState({
        username: '',
        password: ''
    });
    const [error, setError] = useState('');
    const navigate = useNavigate(); // useNavigate 훅 사용

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
            const response = await axios.post(`${apiBaseUrl}/api/token/`, formData);
            // App.js의 onLogin 함수를 호출하여 상태 업데이트 및 토큰 저장
            onLogin(response.data.access);
            
            // refreshToken은 여전히 localStorage에 저장해 둘 수 있음 (선택 사항)
            localStorage.setItem('refreshToken', response.data.refresh);
            
            // axios 기본 헤더 설정
            axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.access}`;
            
            // 페이지 이동을 navigate로 처리
            navigate('/'); 
        } catch (err) {
            setError('아이디 또는 비밀번호가 올바르지 않습니다.');
            console.error(err);
        }
    };

    return (
        <Container>
            <Row className="justify-content-md-center mt-5">
                <Col md={6} lg={4}>
                    <Card className="p-4">
                        <Card.Body>
                            <h2 className="text-center mb-4">로그인</h2>
                            {error && <Alert variant="danger">{error}</Alert>}
                            <Form onSubmit={handleSubmit}>
                                <Form.Group className="mb-3" controlId="formBasicUsername">
                                    <Form.Label>아이디</Form.Label>
                                    <Form.Control 
                                        type="text" 
                                        name="username" 
                                        placeholder="ID를 입력하세요" 
                                        value={formData.username}
                                        onChange={handleChange}
                                        required 
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3" controlId="formBasicPassword">
                                    <Form.Label>비밀번호</Form.Label>
                                    <Form.Control 
                                        type="password" 
                                        name="password" 
                                        placeholder="비밀번호를 입력하세요" 
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                    />
                                </Form.Group>
                                <br/>
                                <div className="d-grid">
                                    <Button variant="primary" type="submit">
                                        로그인
                                    </Button>
                                </div>
                            </Form>
                        </Card.Body>
                    </Card>
                    <div className="text-center mt-3">
                        <Link to="/find-id" className="text-decoration-none small">아이디 찾기</Link>
                        <span className="mx-2 small">|</span>
                        <Link to="/find-password" className="text-decoration-none small">비밀번호 찾기</Link>
                        <span className="mx-2 small">|</span>
                        <Link to="/signup/terms" className="text-decoration-none small">회원가입</Link>
                    </div>
                </Col>
            </Row>
        </Container>
    );
}

export default LoginForm;