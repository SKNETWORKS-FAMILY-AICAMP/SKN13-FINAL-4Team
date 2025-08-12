import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './ProfilePage.css';

function ProfilePage() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    const [nickname, setNickname] = useState('');
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
    
    const [profileImage, setProfileImage] = useState(''); // 현재 프로필 이미지 URL
    const [selectedImage, setSelectedImage] = useState(null); // 선택된 이미지 파일
    const [imagePreviewUrl, setImagePreviewUrl] = useState(''); // 이미지 미리보기 URL
    const fileInputRef = useRef(null); // 숨겨진 파일 input 참조

    const navigate = useNavigate();

    // 사용자 정보 불러오기
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
                setProfileImage(response.data.profile_image || '');
                console.log('사용자 정보====================================:', response.data);
            } catch (err) {
                setError('사용자 정보를 불러오는 데 실패했습니다.');
                console.error("사용자 정보 로딩 실패:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchUserData();
    }, [navigate]);

    // 닉네임 중복 검사 API 호출 함수
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
            console.error('닉네임 검사 실패:', error);
            setNicknameStatus({ isChecking: false, isValid: false, message: '검사 중 오류가 발생했습니다.' });
        }
    }, [nickname]);

    // 닉네임 변경 시 디바운싱을 통해 중복 검사 호출
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

    // 입력 필드 변경 핸들러
    const handleNicknameChange = (e) => setNickname(e.target.value);
    const handlePasswordChange = (e) => {
        const { name, value } = e.target;
        setPasswordData(prev => ({ ...prev, [name]: value }));
    };
    // 이미지 선택 input 트리거
    const handleImageButtonClick = () => {
        fileInputRef.current.click();
    };

    // 이미지 파일 선택 시 호출
    const handleImageChangeClick = () => {
        fileInputRef.current.click();
    };

     // 파일이 선택되면 미리보기 생성 및 즉시 업로드 실행
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // 즉시 미리보기 보여주기
            setImagePreviewUrl(URL.createObjectURL(file));
            // 즉시 업로드 함수 호출
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
            setUser(response.data); // 응답으로 받은 최신 정보로 user 상태 업데이트
            setImagePreviewUrl(''); // 미리보기 초기화
            alert('프로필 이미지가 성공적으로 변경되었습니다.');
        } catch (err) {
            alert('이미지 업로드에 실패했습니다.');
            setImagePreviewUrl(''); // 실패 시에도 미리보기 초기화
            console.error(err);
        }
    };

    // 폼 제출 핸들러
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!nicknameStatus.isValid) {
            alert('닉네임을 확인해주세요.');
            return;
        }

        const accessToken = localStorage.getItem('accessToken');
        let isChanged = false;

        // 닉네임 변경 API 호출
        if (nickname !== user.nickname) {
            try {
                await axios.patch('http://localhost:8000/api/users/me/', { nickname }, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                isChanged = true;
            } catch (err) {
                alert('닉네임 변경에 실패했습니다.');
                console.error(err);
                return;
            }
        }

        // 비밀번호 변경 API 호출
        const { current_password, new_password, new_password_confirm } = passwordData;
        if (new_password) {
            if (new_password !== new_password_confirm) {
                alert('새 비밀번호가 일치하지 않습니다.');
                return;
            }
            if (new_password.length < 8) {
                alert('비밀번호는 8자리 이상으로 설정해주세요.');
                return;
            }
            try {
                await axios.post('http://localhost:8000/api/users/change-password/', passwordData, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                isChanged = true;
            } catch (err) {
                alert('비밀번호 변경에 실패했습니다. 현재 비밀번호를 확인해주세요.');
                console.error(err);
                return;
            }
        }
        
        if (isChanged) {
            alert('프로필 변경 사항이 성공적으로 저장되었습니다.');
            navigate(0); // 페이지 새로고침
        } else if (selectedImage) {
            // 이미지 선택 후 다른 변경사항 없으면 이미지 업로드만 수행
            await handleImageUpload();
        } else {
            alert('변경사항이 없습니다.');
        }
    };

    if (loading) return <div className="loading-message">로딩 중...</div>;
    if (error) return <div className="loading-message">{error}</div>;
    if (!user) return <div className="loading-message">사용자 정보가 없습니다.</div>;

    return (
        <div className="profile-container">
            <h1>프로필 수정</h1>
            <div className="profile-image-container">
                <img 
                    src={user.profile_image ? `http://localhost:8000${user.profile_image}` : `http://localhost:8000/media/profile_pics/default_profile.png`} 
                    alt="Profile" 
                    className="profile-image" 
                />
                <button className="change-image-btn" onClick={handleImageButtonClick}>이미지 변경</button>
                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleImageChange}
                    accept="image/*" // 이미지 파일만 선택 가능하도록 설정
                />
                {selectedImage && (
                    <button className="change-image-btn" onClick={handleImageUpload}>이미지 업로드</button>
                )}
            </div>

            <form className="profile-form" onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="nickname">사용자명</label>
                    <input
                        type="text"
                        id="nickname"
                        name="nickname"
                        value={nickname}
                        onChange={handleNicknameChange}
                    />
                    <small className={nicknameStatus.isValid ? 'text-success' : 'text-danger'}>
                        {nicknameStatus.isChecking ? '확인 중...' : nicknameStatus.message}
                    </small>
                </div>
                <div className="form-group">
                    <label htmlFor="email">이메일</label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        value={user.email}
                        disabled
                    />
                </div>
                <hr style={{ margin: '2rem 0' }} />
                <div className="form-group">
                    <label htmlFor="currentPassword">현재 비밀번호</label>
                    <input
                        type="password"
                        id="currentPassword"
                        name="current_password"
                        placeholder="변경 시에만 입력"
                        value={passwordData.current_password}
                        onChange={handlePasswordChange}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="newPassword">새 비밀번호</label>
                    <input
                        type="password"
                        id="newPassword"
                        name="new_password"
                        placeholder="새 비밀번호 입력"
                        value={passwordData.new_password}
                        onChange={handlePasswordChange}
                    />
                    <small>비밀번호는 영문 + 숫자 + 특수문자를 포함하여 9자리 이상으로 설정해주세요.</small>
                </div>
                <div className="form-group">
                    <label htmlFor="confirmPassword">새 비밀번호 확인</label>
                    <input
                        type="password"
                        id="confirmPassword"
                        name="new_password_confirm"
                        placeholder="새 비밀번호 다시 입력"
                        value={passwordData.new_password_confirm}
                        onChange={handlePasswordChange}
                    />
                </div>
                <div className="form-actions">
                    <button type="button" className="cancel-btn" onClick={() => navigate(-1)}>취소</button>
                    <button type="submit" className="save-btn" disabled={!nicknameStatus.isValid}>변경사항 저장</button>
                </div>
            </form>
        </div>
    );
}

export default ProfilePage;
