import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Form, Button, Container, Alert } from 'react-bootstrap';
import './SignupForm.css';

function SignupForm() {
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        password_confirm: '', 
        nickname: '',
        email: ''
    });

    const [validState, setValidState] = useState({
        username: null,
        password: null,
        password_confirm: null, 
        email: null
    });

    const [errors, setErrors] = useState({});
    const navigate = useNavigate();

    const validateField = (name, value) => {
        let isValid = null;
        switch (name) {
            case 'username':
                isValid = value.length >= 6;
                break;
            case 'password':
                isValid = value.length >= 8;
                if (formData.password_confirm) { 
                    setValidState(prev => ({ ...prev, password_confirm: formData.password_confirm === value }));
                }
                break;
            case 'password_confirm': 
                isValid = formData.password === value && value.length > 0;
                break;
            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                isValid = emailRegex.test(value);
                break;
            default:
                break;
        }
        setValidState(prev => ({ ...prev, [name]: isValid }));
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        validateField(name, value);
        if (name === 'password') {
            validateField('password_confirm', formData.password_confirm);
        }
    };

    const handleFocus = (name) => {
        if (!formData[name] && validState[name] === null) {
            setValidState(prev => ({ ...prev, [name]: false }));
        }
    };

    const getValidationClass = (fieldName) => {
        if (validState[fieldName] === null) return '';
        return validState[fieldName] ? 'is-valid-custom' : 'is-invalid-custom';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrors({});

        const isUsernameValid = formData.username.length >= 6;
        const isPasswordValid = formData.password.length >= 8;
        const isPasswordConfirmValid = formData.password === formData.password_confirm;
        const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
        
        setValidState({
            username: isUsernameValid,
            password: isPasswordValid,
            password_confirm: isPasswordConfirmValid,
            email: isEmailValid,
        });

        if (isUsernameValid && isPasswordValid && isPasswordConfirmValid && isEmailValid) {
            try {
                // ✅ 5. API로 보낼 데이터에서 passwordConfirm을 password_confirm으로 수정
                const dataToSend = {
                    username: formData.username,
                    password: formData.password,
                    password_confirm: formData.password_confirm,
                    nickname: formData.nickname,
                    email: formData.email
                };
                const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
                await axios.post(`${apiBaseUrl}/api/users/signup/`, dataToSend);
                alert('회원가입에 성공했습니다!');
                navigate('/login');
            } catch (error) {
                if (error.response && error.response.status === 400) {
                    setErrors(error.response.data);
                } else {
                    console.error('An unexpected error occurred:', error);
                    alert('회원가입 중 오류가 발생했습니다.');
                }
            }
        } else {
            alert('입력하신 정보를 다시 확인해주세요.');
        }
    };

    return (
        <Container className="mt-5 mb-5">
            <h2 className="text-center">회원가입</h2>
            
            <Form onSubmit={handleSubmit}>
                <br />
                <Form.Group className="mb-3 form-group-centered">
                    <Form.Label>ID</Form.Label>
                    <Form.Control type="text" name="username" value={formData.username} onChange={handleChange} onFocus={() => handleFocus('username')} className={getValidationClass('username')} />
                    <Form.Control.Feedback type="invalid" style={{ display: errors.username ? 'block' : 'none' }}>{errors.username}</Form.Control.Feedback>
                </Form.Group>
                <Form.Group className="mb-3 form-group-centered">
                    <Form.Label>비밀번호</Form.Label>
                    <Form.Control type="password" name="password" value={formData.password} onChange={handleChange} onFocus={() => handleFocus('password')} className={getValidationClass('password')} />
                    <Form.Control.Feedback type="invalid" style={{ display: errors.password ? 'block' : 'none' }}>{errors.password}</Form.Control.Feedback>
                </Form.Group>
                <Form.Group className="mb-3 form-group-centered">
                    <Form.Label>비밀번호 확인</Form.Label>
                    <Form.Control 
                        type="password" 
                        name="password_confirm"
                        value={formData.password_confirm}
                        onChange={handleChange} 
                        onFocus={() => handleFocus('password_confirm')}
                        className={getValidationClass('password_confirm')}
                    />
                    <Form.Control.Feedback type="invalid" style={{ display: validState.password_confirm === false ? 'block' : 'none' }}>비밀번호가 일치하지 않습니다.</Form.Control.Feedback>
                </Form.Group>
                <Form.Group className="mb-3 form-group-centered">
                    <Form.Label>닉네임</Form.Label>
                    <Form.Control type="text" name="nickname" value={formData.nickname} onChange={handleChange} />
                </Form.Group>
                <Form.Group className="mb-3 form-group-centered">
                    <Form.Label>이메일</Form.Label>
                    <Form.Control type="email" name="email" value={formData.email} onChange={handleChange} onFocus={() => handleFocus('email')} className={getValidationClass('email')} />
                    <Form.Control.Feedback type="invalid" style={{ display: errors.email ? 'block' : 'none' }}>{errors.email}</Form.Control.Feedback>
                </Form.Group>
                <br />
                <div className="d-grid form-group-centered">
                    <Button variant="primary" type="submit">
                        가입하기
                    </Button>
                </div>
            </Form>
        </Container>
    );
}

export default SignupForm;