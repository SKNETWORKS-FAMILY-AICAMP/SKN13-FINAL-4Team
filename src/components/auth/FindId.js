// src/components/auth/FindId.js
import React, { useState } from 'react';
import api from '../../utils/unifiedApiClient';
import { Link } from 'react-router-dom';
import { Container, Form, Button, Alert, Row, Col, Card } from 'react-bootstrap';

function FindId() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [foundUsername, setFoundUsername] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setFoundUsername('');

        try {
            const response = await api.post('/api/users/find-username/', { email });
            setFoundUsername(response.data.username);
        } catch (err) {
            const errorMessage = err.response?.data?.error || '오류가 발생했습니다.';
            setError(errorMessage);
        }
    };

    return (
        <Container>
            <Row className="justify-content-md-center mt-5">
                <Col md={6} lg={4}>
                    <Card className="p-4">
                        <Card.Body>
                            <h2 className="text-center mb-4">아이디 찾기</h2>
                            {error && <Alert variant="danger">{error}</Alert>}
                            {foundUsername && <Alert variant="success">회원님의 아이디는 <strong>{foundUsername}</strong> 입니다.</Alert>}
                            
                            <Form onSubmit={handleSubmit}>
                                <Form.Group className="mb-3" controlId="formBasicEmail">
                                    <Form.Label className="form-label text-start d-block">이메일</Form.Label>
                                    <Form.Control 
                                        type="email" 
                                        name="email" 
                                        placeholder="가입 시 사용한 이메일을 입력하세요" 
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required 
                                    />
                                </Form.Group>
                                <br/>
                                <div className="d-grid">
                                    <Button variant="primary" type="submit">
                                        아이디 찾기
                                    </Button>
                                </div>
                            </Form>
                        </Card.Body>
                    </Card>
                    <div className="text-center mt-3">
                        <Link to="/login" className="text-decoration-none small">로그인</Link>
                        <span className="mx-2 small">|</span>
                        <Link to="/find-password" className="text-decoration-none small">비밀번호 찾기</Link>
                    </div>
                </Col>
            </Row>
        </Container>
    );
}

export default FindId;
