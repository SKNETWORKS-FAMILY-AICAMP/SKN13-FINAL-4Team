import React, { useState, useEffect } from 'react';
import api from '../../utils/unifiedApiClient';
import { Link, useNavigate } from 'react-router-dom'; // useNavigate import
import { Container, Form, Button, Alert, Row, Col, Card } from 'react-bootstrap';

console.log('📦 api 모듈 import:', api);
console.log('📦 api.post 함수:', typeof api.post);

// App.js로부터 onLogin 함수를 props로 받음
function LoginForm({ onLogin }) {
    useEffect(() => {
        console.log('🔧 LoginForm 컴포넌트 마운트됨');
        console.log('📞 onLogin 함수 존재:', typeof onLogin === 'function');
    }, []);
    const [formData, setFormData] = useState({
        username: '',
        password: ''
    });
    const [error, setError] = useState('');
    const navigate = useNavigate(); // useNavigate 훅 사용

    const handleChange = (e) => {
        console.log('⌨️ 입력 필드 변경:', e.target.name, e.target.value);
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        console.log('🎯 handleSubmit 함수 진입');
        e.preventDefault();
        e.stopPropagation();
        setError('');
        console.log('🔐 로그인 시도 시작:', formData);
        console.log('✅ preventDefault 완료');

        try {
            console.log('🌐 로그인 API 호출: /api/token/');
            console.log('🔧 API 기본 URL:', api.defaults.baseURL);
            console.log('📤 요청 데이터:', formData);
            console.log('📦 api 객체 확인:', api);
            console.log('📦 api.post 타입:', typeof api.post);
            console.log('🚀 API 요청 시작...');
            
            const response = await api.post('/api/token/', formData);
            console.log('🎯 API 요청 완료!');
            console.log('✅ 로그인 API 응답 성공:', { 
                access: !!response.data.access, 
                refresh: !!response.data.refresh 
            });
            
            // App.js의 onLogin 함수를 호출하여 상태 업데이트 및 토큰 저장
            console.log('📞 App.js onLogin 호출 중...');
            onLogin(response.data.access);
            
            // refreshToken은 여전히 localStorage에 저장해 둘 수 있음 (선택 사항)
            localStorage.setItem('refreshToken', response.data.refresh);
            console.log('💾 refreshToken localStorage에 저장됨');
            
            // axios 기본 헤더 설정
            api.defaults.headers.common['Authorization'] = `Bearer ${response.data.access}`;
            console.log('🔧 axios 기본 헤더 설정됨:', api.defaults.headers.common['Authorization'] ? '설정됨' : '설정안됨');
            
            // 페이지 이동을 navigate로 처리
            console.log('🏠 메인 페이지로 이동 중...');
            navigate('/'); 
        } catch (err) {
            console.error('❌ 로그인 실패:', err);
            console.error('❌ 오류 타입:', typeof err);
            console.error('❌ 오류 네임:', err.name);
            console.error('❌ 오류 상세:', err.response?.status, err.response?.data);
            console.error('❌ 오류 메시지:', err.message);
            console.error('❌ 전체 오류 객체:', err);
            console.error('❌ 스택 트레이스:', err.stack);
            
            if (err.response) {
                console.error('❌ 서버 응답 오류:', err.response.status, err.response.data);
                setError(`서버 오류: ${err.response.status} - ${err.response.data?.detail || '알 수 없는 오류'}`);
            } else if (err.request) {
                console.error('❌ 네트워크 오류 - 응답 없음:', err.request);
                setError('네트워크 연결 오류가 발생했습니다. 서버가 실행 중인지 확인해주세요.');
            } else {
                console.error('❌ 기타 오류:', err.message);
                setError(`오류 발생: ${err.message}`);
            }
        }
    };

    return (
        <Container>
            <Row className="justify-content-md-center mt-5">
                <Col md={6} lg={4}>
                    <Card className="p-4">
                        <Card.Body>
                            <h2 className="text-center mb-4 ">로그인</h2>
                            {error && <Alert variant="danger">{error}</Alert>}
                            <Form onSubmit={handleSubmit}>
                                <Form.Group className="mb-3" controlId="formBasicUsername">
                                    <Form.Label className="form-label text-start d-block">아이디</Form.Label>
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
                                    <Form.Label className="form-label text-start d-block">비밀번호</Form.Label>
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
                                    <Button 
                                        variant="primary" 
                                        type="submit"
                                        onClick={() => console.log('🎯 로그인 버튼 클릭됨')}
                                    >
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