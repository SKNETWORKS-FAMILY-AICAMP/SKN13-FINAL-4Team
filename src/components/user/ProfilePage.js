import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './ProfilePage.css'; // 프로필 페이지 전용 CSS
import Sidebar from '../layout/Sidebar';

function ProfilePage() {
    // ... (모든 state와 함수 로직은 기존과 동일) ...
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    const [nickname, setNickname] = useState('');
    const [birthDate, setBirthDate] = useState(''); 
    const [gender, setGender] = useState('');
    const [passwordData, setPasswordData] = useState({
        current_password: '',
        new_password: '',
        new_password_confirm: ''
    });

    const [nicknameStatus, setNicknameStatus] = useState({
        isChecking: false,
        isValid: true,
        message: ''
    });
    
    const [imagePreviewUrl, setImagePreviewUrl] = useState('');
    const fileInputRef = useRef(null);

    const navigate = useNavigate();

    useEffect(() => {
        const fetchUserData = async () => {
            const accessToken = localStorage.getItem('accessToken');
            if (!accessToken) {
                alert('로그인이 필요합니다.');
                navigate('/login');
                return;
            }
            try {
                const response = await axios.get('http://localhost:8000/api/users/me/', {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                setUser(response.data);
                setNickname(response.data.nickname || '');
                setBirthDate(response.data.birth_date || '');
                setGender(response.data.gender || '');
            } catch (err) {
                setError('사용자 정보를 불러오는 데 실패했습니다.');
            } finally {
                setLoading(false);
            }
        };
        fetchUserData();
    }, [navigate]);

    const checkNickname = useCallback(async () => {
        if (nickname.length > 0 && nickname.length < 2) {
            setNicknameStatus({ isChecking: false, isValid: false, message: '닉네임은 2글자 이상이어야 합니다.' });
            return;
        }
        setNicknameStatus({ isChecking: true, isValid: true, message: '' });
        try {
            const response = await axios.get(`http://localhost:8000/api/users/check-nickname/?nickname=${nickname}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
            });
            if (response.data.is_taken) {
                setNicknameStatus({ isChecking: false, isValid: false, message: '이미 사용 중인 닉네임입니다.' });
            } else {
                setNicknameStatus({ isChecking: false, isValid: true, message: '사용 가능한 닉네임입니다.' });
            }
        } catch (error) {
            setNicknameStatus({ isChecking: false, isValid: false, message: '검사 중 오류가 발생했습니다.' });
        }
    }, [nickname]);

    useEffect(() => {
        if (user && nickname !== user.nickname && nickname.trim() !== '') {
            const debounceTimer = setTimeout(() => {
                checkNickname();
            }, 500);
            return () => clearTimeout(debounceTimer);
        } else {
            setNicknameStatus({ isChecking: false, isValid: true, message: '' });
        }
    }, [nickname, user, checkNickname]);

    const handleNicknameChange = (e) => setNickname(e.target.value);
    const handleBirthDateChange = (e) => setBirthDate(e.target.value);
    const handleGenderChange = (e) => setGender(e.target.value);
    const handlePasswordChange = (e) => {
        const { name, value } = e.target;
        setPasswordData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleImageButtonClick = () => {
        fileInputRef.current.click();
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImagePreviewUrl(URL.createObjectURL(file));
            handleImageUpload(file);
        }
    };

    const handleImageUpload = async (imageFile) => {
        const formData = new FormData();
        formData.append('profile_image', imageFile);
        try {
            const accessToken = localStorage.getItem('accessToken');
            const response = await axios.patch('http://localhost:8000/api/users/me/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            setUser(response.data);
            setImagePreviewUrl('');
            alert('프로필 이미지가 성공적으로 변경되었습니다.');
        } catch (err) {
            alert('이미지 업로드에 실패했습니다.');
            setImagePreviewUrl('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!nicknameStatus.isValid) {
            alert('닉네임을 확인해주세요.');
            return;
        }

        const accessToken = localStorage.getItem('accessToken');
        let isChanged = false;

        const dataToUpdate = {};
        if (nickname !== user.nickname) { dataToUpdate.nickname = nickname; isChanged = true; }
        if (birthDate !== user.birth_date) { dataToUpdate.birth_date = birthDate; isChanged = true; }
        if (gender !== user.gender) { dataToUpdate.gender = gender; isChanged = true; }
        
        if (isChanged) {
            try {
                await axios.patch('http://localhost:8000/api/users/me/', dataToUpdate, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
            } catch (err) {
                alert('프로필 정보 변경에 실패했습니다.');
                return;
            }
        }

        const { current_password, new_password } = passwordData;
        if (new_password) {
            // ... (기존 비밀번호 변경 로직) ...
            isChanged = true;
        }
        
        if (isChanged) {
            alert('프로필 변경 사항이 성공적으로 저장되었습니다.');
            navigate(0);
        } else {
            alert('변경사항이 없습니다.');
        }
    };

    if (loading) return <div className="loading-message">로딩 중...</div>;
    if (error) return <div className="loading-message">{error}</div>;
    if (!user) return <div className="loading-message">사용자 정보가 없습니다.</div>;

    return (
        <div className="profile-page-wrapper"> 
            {user.is_staff && <Sidebar />}
            {/* [수정] className을 signup-container로 변경 */}
            <div className="signup-container">
                <div className="signup-header">
                    <h1>프로필 수정</h1>
                </div>

                <div className="profile-image-container">
                    <img 
                        src={imagePreviewUrl || (user.profile_image ? `http://localhost:8000${user.profile_image}` : `http://localhost:8000/media/profile_pics/default_profile.png`)} 
                        alt="Profile" 
                        className="profile-image" 
                    />
                    <button type="button" className="thumbnail-upload-btn" onClick={handleImageButtonClick}>이미지 변경</button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleImageChange}
                        accept="image/*"
                    />
                </div>

                {/* [수정] className을 signup-form으로 변경 */}
                <form className="signup-form" onSubmit={handleSubmit}>
                    {/* 사용자명 */}
                    <div className="form-group">
                        <label htmlFor="nickname" className="form-label text-start d-block">사용자명</label>
                        <input type="text" id="nickname" name="nickname" value={nickname} onChange={handleNicknameChange} />
                        <small className={nicknameStatus.isValid ? 'success' : 'error'}>
                            {nicknameStatus.isChecking ? '확인 중...' : nicknameStatus.message}
                        </small>
                    </div>

                    {/* 이메일 */}
                    <div className="form-group">
                        <label htmlFor="email" className="form-label text-start d-block">이메일</label>
                        <input type="email" id="email" name="email" value={user.email} disabled />
                    </div>

                    {/* 생년월일 */}
                    <div className="form-group">
                        <label htmlFor="birthDate" className="form-label text-start d-block">생년월일</label>
                        <input type="date" id="birthDate" name="birth_date" value={birthDate} onChange={handleBirthDateChange} />
                    </div>

                    {/* 성별 */}
                    <div className="form-group">
                        <label htmlFor="gender" className="form-label text-start d-block">성별</label>
                        <select id="gender" name="gender" value={gender} onChange={handleGenderChange}>
                            <option value="">선택 안 함</option>
                            <option value="M">남성</option>
                            <option value="F">여성</option>
                            <option value="O">기타</option>
                        </select>
                    </div>

                    <hr style={{ margin: '2rem 0' }} />

                    {/* 현재 비밀번호 */}
                    <div className="form-group">
                        <label htmlFor="currentPassword" className="form-label text-start d-block">현재 비밀번호</label>
                        <input type="password" id="currentPassword" name="current_password" placeholder="변경 시에만 입력" value={passwordData.current_password} onChange={handlePasswordChange} />
                    </div>

                    {/* 새 비밀번호 */}
                    <div className="form-group">
                        <label htmlFor="newPassword" className="form-label text-start d-block">새 비밀번호</label>
                        <input type="password" id="newPassword" name="new_password" placeholder="새 비밀번호 입력" value={passwordData.new_password} onChange={handlePasswordChange} />
                        <small>비밀번호는 영문, 숫자, 특수문자를 포함하여 9자리 이상으로 설정해주세요.</small>
                    </div>

                    {/* 새 비밀번호 확인 */}
                    <div className="form-group">
                        <label htmlFor="confirmPassword" className="form-label text-start d-block">새 비밀번호 확인</label>
                        <input type="password" id="confirmPassword" name="new_password_confirm" placeholder="새 비밀번호 다시 입력" value={passwordData.new_password_confirm} onChange={handlePasswordChange} />
                    </div>
                    
                    <div className="form-actions">
                        <button type="button" className="cancel-btn" onClick={() => navigate(-1)}>취소</button>
                        <button type="submit" className="save-btn" disabled={!nicknameStatus.isValid}>변경사항 저장</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ProfilePage;