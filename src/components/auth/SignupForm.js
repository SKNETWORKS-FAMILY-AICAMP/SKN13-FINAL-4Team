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
        email: '',
        gender: 'M',
        birth_date: '2000-01-01'
    });
    const [errors, setErrors] = useState({});
    const [usernameStatus, setUsernameStatus] = useState('');
    const [nicknameStatus, setNicknameStatus] = useState('');
    const [isPasswordValid, setIsPasswordValid] = useState(null);

    const navigate = useNavigate();

    const validatePassword = (password) => {
        if (!password) return null; // 비어있을 땐 null
        const length = password.length >= 9;
        const letter = /[a-zA-Z]/.test(password);
        const number = /[0-9]/.test(password);
        const special = /[^a-zA-Z0-9]/.test(password);
        return length && letter && number && special;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }

        if (name === 'username') setUsernameStatus('');
        if (name === 'nickname') setNicknameStatus('');

        if (name === 'password') {
            setIsPasswordValid(validatePassword(value));
        }
    };

    const handleCheckUsername = async () => {
        if (!formData.username) {
            alert('아이디를 입력해주세요.');
            return;
        }
        try {
            const response = await axios.get(`http://localhost:8000/api/users/check-username/?username=${formData.username}`);
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

    const handleCheckNickname = async () => {
        if (!formData.nickname) {
            alert('사용자명을 입력해주세요.');
            return;
        }
        try {
            const response = await axios.get(`http://localhost:8000/api/users/check-nickname/?nickname=${formData.nickname}`);
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        let newErrors = {};
        let isValid = true;

        // 비밀번호 유효성 검사
        if (!validatePassword(formData.password)) {
            newErrors.password = ['비밀번호는 영문, 숫자, 특수문자를 포함하여 9자리 이상이어야 합니다.'];
            isValid = false;
        }

        // 비밀번호 확인 검사
        if (formData.password !== formData.password_confirm) {
            newErrors.password_confirm = ['비밀번호가 일치하지 않습니다.'];
            isValid = false;
        }
        
        // 생년월일 유효성 검사
        if (!formData.birth_date) {
            newErrors.birth_date = ['생년월일을 입력해주세요.'];
            isValid = false;
        }
        
        // 중복 확인 여부 검사
        if (usernameStatus !== '사용 가능한 아이디입니다.') {
            alert('아이디 중복 확인을 해주세요.');
            isValid = false;
        }
        if (nicknameStatus !== '사용 가능한 사용자명입니다.') {
            alert('사용자명 중복 확인을 해주세요.');
            isValid = false;
        }

        // 유효성 검사에서 에러가 있으면 상태 업데이트 후 종료
        if (!isValid) {
            setErrors(newErrors);
            return;
        }
        
        // 모든 검증 통과 후 서버에 데이터 전송
        try {
            const { password_confirm, ...signupData } = formData;
            if (!signupData.gender) signupData.gender = null;

            await axios.post('http://localhost:8000/api/users/signup/', signupData);
            alert('회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.');
            navigate('/login');
        } catch (err) {
            if (err.response && err.response.data) {
                console.error('회원가입 실패:', err.response.data);
                setErrors(err.response.data);
            } else {
                alert('회원가입 중 알 수 없는 오류가 발생했습니다.');
                console.error(err);
            }
        }
    };

    const getPasswordInputClass = () => {
        if (formData.password === '') return ''; // 비어있을 땐 기본
        return isPasswordValid ? 'valid-input' : 'invalid-input';
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
                    <label htmlFor="username" className="form-label text-start d-block">아이디</label>
                    <div className="input-with-button">
                        <input type="text" id="username" name="username" placeholder="아이디를 입력하세요" value={formData.username} onChange={handleChange} required />
                        <button type="button" onClick={handleCheckUsername}>중복 확인</button>
                    </div>
                    {usernameStatus && <small className={usernameStatus.includes('사용 가능') ? 'success' : 'error'}>{usernameStatus}</small>}
                    {errors.username && <small className="error">{errors.username.join(' ')}</small>}
                </div>

                {/* 비밀번호 */}
                <div className="form-group">
                    <label htmlFor="password" className="form-label text-start d-block">비밀번호</label>
                    <input
                        type="password"
                        id="password"
                        name="password"
                        placeholder="영문, 숫자, 특수문자 포함 9자리 이상"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        className={getPasswordInputClass()}
                    />
                    {errors.password && <small className="error">{errors.password.join(' ')}</small>}
                </div>

                {/* 비밀번호 확인 */}
                <div className="form-group">
                    <label htmlFor="password_confirm" className="form-label text-start d-block">비밀번호 확인</label>
                    <input 
                      type="password" 
                      id="password_confirm" 
                      name="password_confirm" 
                      placeholder="비밀번호를 다시 입력하세요" 
                      value={formData.password_confirm} 
                      onChange={handleChange} 
                      required 
                    />
                    {errors.password_confirm && <small className="error">{errors.password_confirm.join(' ')}</small>}
                </div>

                {/* 사용자명 (닉네임) */}
                <div className="form-group">
                    <label htmlFor="nickname" className="form-label text-start d-block">사용자명</label>
                    <div className="input-with-button">
                        <input type="text" id="nickname" name="nickname" placeholder="사용자명을 입력하세요" value={formData.nickname} onChange={handleChange} required />
                        <button type="button" onClick={handleCheckNickname}>중복 확인</button>
                    </div>
                    {nicknameStatus && <small className={nicknameStatus.includes('사용 가능') ? 'success' : 'error'}>{nicknameStatus}</small>}
                    {errors.nickname && <small className="error">{errors.nickname.join(' ')}</small>}
                </div>

                {/* 이메일 */}
                <div className="form-group">
                    <label htmlFor="email" className="form-label text-start d-block">이메일</label>
                    <input type="email" id="email" name="email" placeholder="이메일을 입력하세요" value={formData.email} onChange={handleChange} required />
                    {errors.email && <small className="error">{errors.email.join(' ')}</small>}
                </div>

                {/* 생년월일 */}
                <div className="form-group">
                    <label htmlFor="birth_date" className="form-label text-start d-block">생년월일 </label>
                    <input 
                        type="date" 
                        id="birth_date" 
                        name="birth_date" 
                        value={formData.birth_date} 
                        onChange={handleChange} 
                        required
                    />
                    {errors.birth_date && <small className="error">{errors.birth_date.join(' ')}</small>}
                </div>

                {/* 성별 */}
                <div className="form-group">
                    <label htmlFor="gender" className="form-label text-start d-block">성별</label>
                    <select id="gender" name="gender" value={formData.gender} onChange={handleChange}>
                        <option value="M">남성</option>
                        <option value="F">여성</option>
                    </select>
                    {errors.gender && <small className="error">{errors.gender.join(' ')}</small>}
                </div>

                <button type="submit" className="signup-btn">회원가입 완료</button>
            </form>
        </div>
    );
}

export default SignupForm;