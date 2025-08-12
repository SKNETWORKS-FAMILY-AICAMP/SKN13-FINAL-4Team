import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './SignupForm.css'; // 스타일링을 위한 CSS 파일

function SignupForm() {
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        password_confirm: '',
        nickname: '',
        email: ''
    });
    // 백엔드에서 오는 에러 메시지를 저장합니다.
    const [errors, setErrors] = useState({});
    // 아이디, 닉네임 중복 확인 결과를 저장합니다.
    const [usernameStatus, setUsernameStatus] = useState(''); 
    const [nicknameStatus, setNicknameStatus] = useState(''); 

    const navigate = useNavigate();

    // 입력 필드 변경 핸들러
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value
        });
        // 입력이 변경되면 중복 확인 상태와 에러 메시지를 초기화합니다.
        if (name === 'username') setUsernameStatus('');
        if (name === 'nickname') setNicknameStatus('');
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    // 아이디 중복 확인 핸들러
    const handleCheckUsername = async () => {
        if (!formData.username) {
            alert('아이디를 입력해주세요.');
            return;
        }
        try {
            // 아이디 중복 확인 API (백엔드 구현 필요)
            const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
            const response = await axios.get(`${apiBaseUrl}/api/users/check-username/?username=${formData.username}`);
            if (response.data.is_taken) {
                setUsernameStatus('이미 사용 중인 아이디입니다.');
            } else {
                setUsernameStatus('사용 가능한 아이디입니다.');
            }
        } catch (err) {
            console.error('아이디 중복 확인 실패:', err);
            setUsernameStatus('중복 확인 중 오류가 발생했습니다.');
        }
    };

    // 닉네임 중복 확인 핸들러
    const handleCheckNickname = async () => {
        if (!formData.nickname) {
            alert('사용자명을 입력해주세요.');
            return;
        }
        try {
            const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
            const response = await axios.get(`${apiBaseUrl}/api/users/check-nickname/?nickname=${formData.nickname}`);
            if (response.data.is_taken) {
                setNicknameStatus('이미 사용 중인 사용자명입니다.');
            } else {
                setNicknameStatus('사용 가능한 사용자명입니다.');
            }
        } catch (err) {
            console.error('닉네임 중복 확인 실패:', err);
            setNicknameStatus('중복 확인 중 오류가 발생했습니다.');
        }
    };

    // 폼 제출 핸들러
    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrors({});

        // 프론트엔드 유효성 검사
        if (formData.password !== formData.password_confirm) {
            setErrors({ password_confirm: '비밀번호가 일치하지 않습니다.' });
            return;
        }
        if (usernameStatus !== '사용 가능한 아이디입니다.') {
            alert('아이디 중복 확인을 해주세요.');
            return;
        }
        if (nicknameStatus !== '사용 가능한 사용자명입니다.') {
            alert('사용자명 중복 확인을 해주세요.');
            return;
        }

        try {
            // 회원가입 데이터 전송
            const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
            await axios.post(`${apiBaseUrl}/api/users/signup/`, formData); 
            alert('회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.');
            navigate('/login');
        } catch (err) {
            if (err.response && err.response.data) {
                console.error('회원가입 실패:', err.response.data);
                setErrors(err.response.data); // 백엔드에서 오는 에러 메시지 표시
            } else {
                alert('회원가입 중 알 수 없는 오류가 발생했습니다.');
                console.error(err);
            }
        }
    };

    return (
        <div className="signup-container">
            <div className="signup-header">
                <h1>회원가입</h1>
                <p>필수 정보를 입력해주세요</p>
            </div>
            <form className="signup-form" onSubmit={handleSubmit}>
                {/* 아이디 */}
                <div className="form-group">
                    <label htmlFor="username">아이디</label>
                    <div className="input-with-button">
                        <input type="text" id="username" name="username" placeholder="아이디를 입력하세요" value={formData.username} onChange={handleChange} required />
                        <button type="button" onClick={handleCheckUsername}>중복 확인</button>
                    </div>
                    {usernameStatus && <small className={usernameStatus.includes('사용 가능') ? 'success' : 'error'}>{usernameStatus}</small>}
                    {errors.username && <small className="error">{errors.username.join(' ')}</small>}
                </div>

                {/* 비밀번호 */}
                <div className="form-group">
                    <label htmlFor="password">비밀번호</label>
                    <input type="password" id="password" name="password" placeholder="비밀번호를 입력하세요" value={formData.password} onChange={handleChange} required />
                    <small>비밀번호는 영문 + 숫자 + 특수문자를 포함하여 9자리 이상으로 설정해주세요.</small>
                    {errors.password && <small className="error">{errors.password.join(' ')}</small>}
                </div>

                {/* 비밀번호 확인 */}
                <div className="form-group">
                    <label htmlFor="password_confirm">비밀번호 확인</label>
                    <input type="password" id="password_confirm" name="password_confirm" placeholder="비밀번호를 다시 입력하세요" value={formData.password_confirm} onChange={handleChange} required />
                    {errors.password_confirm && <small className="error">{errors.password_confirm.join(' ')}</small>}
                </div>

                {/* 사용자명 (닉네임) */}
                <div className="form-group">
                    <label htmlFor="nickname">사용자명</label>
                    <div className="input-with-button">
                        <input type="text" id="nickname" name="nickname" placeholder="사용자명을 입력하세요" value={formData.nickname} onChange={handleChange} required />
                        <button type="button" onClick={handleCheckNickname}>중복 확인</button>
                    </div>
                    {nicknameStatus && <small className={nicknameStatus.includes('사용 가능') ? 'success' : 'error'}>{nicknameStatus}</small>}
                    {errors.nickname && <small className="error">{errors.nickname.join(' ')}</small>}
                </div>

                {/* 이메일 */}
                <div className="form-group">
                    <label htmlFor="email">이메일</label>
                    <input type="email" id="email" name="email" placeholder="이메일을 입력하세요" value={formData.email} onChange={handleChange} required />
                    {errors.email && <small className="error">{errors.email.join(' ')}</small>}
                </div>

                <button type="submit" className="signup-btn">회원가입 완료</button>
            </form>
        </div>
    );
}

export default SignupForm;
