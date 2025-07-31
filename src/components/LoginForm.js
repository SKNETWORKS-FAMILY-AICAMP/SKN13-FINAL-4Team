import React, { useState } from 'react';
import axios from 'axios';
// Link 컴포넌트를 react-router-dom에서 가져옵니다.
import { Link } from 'react-router-dom'; 
import { Container, Form, Button, Alert, Row, Col, Card } from 'react-bootstrap';

function LoginForm() {
    const [formData, setFormData] = useState({
        username: '',
        password: ''
    });
    const [error, setError] = useState('');

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
            const response = await axios.post('http://localhost:8000/api/token/', formData);
            localStorage.setItem('accessToken', response.data.access);
            localStorage.setItem('refreshToken', response.data.refresh);
            axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.access}`;
            window.location.href = '/'; 
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