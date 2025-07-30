import React, { useState } from 'react';
import axios from 'axios';
import { Form, Button, Container, Alert } from 'react-bootstrap';

function SignupForm() {
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        nickname: '',
        email: ''
    });
    const [errors, setErrors] = useState({});
    const [success, setSuccess] = useState('');

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrors({});
        setSuccess('');

        try {
            // Django API 서버로 POST 요청을 보냅니다.
            const response = await axios.post('http://localhost:8000/users/signup/', formData);
            setSuccess('회원가입이 성공적으로 완료되었습니다!');
            console.log(response.data);
        } catch (error) {
            if (error.response && error.response.status === 400) {
                // Django에서 보낸 유효성 검사 에러를 상태에 저장합니다.
                setErrors(error.response.data);
            } else {
                console.error('An unexpected error occurred:', error);
            }
        }
    };

    return (
        <Container className="mt-5">
            <h2>회원가입</h2>
            {success && <Alert variant="success">{success}</Alert>}
            <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                    <Form.Label>ID</Form.Label>
                    <Form.Control type="text" name="username" value={formData.username} onChange={handleChange} isInvalid={!!errors.username} />
                    <Form.Control.Feedback type="invalid">{errors.username}</Form.Control.Feedback>
                </Form.Group>
                
                <Form.Group className="mb-3">
                    <Form.Label>비밀번호</Form.Label>
                    <Form.Control type="password" name="password" value={formData.password} onChange={handleChange} isInvalid={!!errors.password} />
                    <Form.Control.Feedback type="invalid">{errors.password}</Form.Control.Feedback>
                </Form.Group>

                <Form.Group className="mb-3">
                    <Form.Label>닉네임</Form.Label>
                    <Form.Control type="text" name="nickname" value={formData.nickname} onChange={handleChange} isInvalid={!!errors.nickname} />
                    <Form.Control.Feedback type="invalid">{errors.nickname}</Form.Control.Feedback>
                </Form.Group>

                <Form.Group className="mb-3">
                    <Form.Label>이메일</Form.Label>
                    <Form.Control type="email" name="email" value={formData.email} onChange={handleChange} isInvalid={!!errors.email} />
                    <Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback>
                </Form.Group>

                <Button variant="primary" type="submit">가입하기</Button>
            </Form>
        </Container>
    );
}

export default SignupForm;