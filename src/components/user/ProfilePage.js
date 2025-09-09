import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import styles from './ProfilePage.module.css';
import signupStyles from '../auth/SignupForm.module.css';
import Sidebar from '../layout/Sidebar';

function ProfilePage({ refreshUserData }) { // props로 refreshUserData 함수를 받음
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
    
    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const response = await api.get('/api/users/me/');
                
                setUser(response.data);
                setNickname(response.data.nickname || '');
                setBirthDate(response.data.birth_date || '');
                setGender(response.data.gender || '');
            } catch (err) {
                setError('사용자 정보를 불러오는 데 실패했습니다.');
                console.error("사용자 정보 로딩 실패:", err);
                if (err.response && err.response.status === 401) {
                    navigate('/login');
                }
            } finally {
                setLoading(false);
            }
        };
        fetchUserData();
    }, []);

    const checkNickname = useCallback(async () => {
        if (nickname.length > 0 && nickname.length < 2) {
            setNicknameStatus({ isChecking: false, isValid: false, message: '닉네임은 2글자 이상이어야 합니다.' });
            return;
        }
        setNicknameStatus({ isChecking: true, isValid: true, message: '' });
        try {
            const response = await api.get(`/api/users/check-nickname/?nickname=${nickname}`);
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
            const response = await api.patch('/api/users/me/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setUser(response.data);
            setImagePreviewUrl('');
            alert('프로필 이미지가 성공적으로 변경되었습니다.');
            
            // [추가] App.js의 사용자 정보를 업데이트하여 Navbar를 리프레시
            if (refreshUserData) {
                refreshUserData();
            }

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
        
        let isChanged = false;

        const dataToUpdate = {};
        if (nickname !== user.nickname) { dataToUpdate.nickname = nickname; }
        if (birthDate !== user.birth_date) { dataToUpdate.birth_date = birthDate; }
        if (gender !== user.gender) { dataToUpdate.gender = gender; }
        
        if (Object.keys(dataToUpdate).length > 0) {
            isChanged = true;
            try {
                await api.patch('/api/users/me/', dataToUpdate);
            } catch (err) {
                alert('프로필 정보 변경에 실패했습니다.');
                return;
            }
        }

        const { new_password, new_password_confirm } = passwordData;
        if (new_password) {
            if (new_password !== new_password_confirm) {
                alert('새 비밀번호가 일치하지 않습니다.');
                return;
            }
            isChanged = true;
            try {
                await api.post('/api/users/change-password/', passwordData);
            } catch (err) {
                alert('비밀번호 변경에 실패했습니다. 현재 비밀번호를 확인해주세요.');
                return;
            }
        }
        
        if (isChanged) {
            alert('프로필 변경 사항이 성공적으로 저장되었습니다.');
            
            // App.js의 사용자 정보를 업데이트
            if (refreshUserData) {
                await refreshUserData(); // await를 사용하여 순차적 실행 보장
            }
            navigate(0); // 페이지 새로고침
            
        } else {
            alert('변경사항이 없습니다.');
        }
    };

    if (loading) return <div className="loading-message">로딩 중...</div>;
    if (error) return <div className="loading-message">{error}</div>;
    if (!user) return <div className="loading-message">사용자 정보가 없습니다.</div>;

    // const profileImageUrl = imagePreviewUrl || 
    //                         (user.profile_image ? `${apiBaseUrl}${user.profile_image}` 
    //                                         : `${apiBaseUrl}/media/profile_pics/default_profile.png`);

    return (
        <div className={styles.wrapper}> 
            {user.is_staff && <Sidebar />}
            <div className={styles.signupContainer}>
                <div className={signupStyles.signupHeader}>
                    <h1>프로필 수정</h1>
                </div>

                <div className={styles.imageContainer}>
                    {/* 현재 프로필 이미지: 백엔드 정적 경로를 절대 URL로 보정 */}
                    {(() => {
                        const resolvedSrc = imagePreviewUrl || (
                            user.profile_image
                                ? (user.profile_image.startsWith('http') ? user.profile_image : `${apiBaseUrl}${user.profile_image}`)
                                : `${apiBaseUrl}/media/profile_pics/default_profile.png`
                        );
                        return (
                            <img 
                                src={resolvedSrc}
                                alt="Profile" 
                                className={styles.profileImage} 
                            />
                        );
                    })()}
                    <button type="button" className={signupStyles.thumbnailUploadBtn} onClick={handleImageButtonClick}>이미지 변경</button>
                    <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageChange} accept="image/*" />
                </div>

                <form className={signupStyles.signupForm} onSubmit={handleSubmit}>
                    {/* 사용자명 */}
                    <div className={signupStyles.formGroup}>
                        <label htmlFor="nickname" className="form-label text-start d-block">사용자명</label>
                        <input type="text" id="nickname" name="nickname" value={nickname} onChange={handleNicknameChange} />
                        <small className={nicknameStatus.isValid ? signupStyles.success : signupStyles.error}>
                            {nicknameStatus.isChecking ? '확인 중...' : nicknameStatus.message}
                        </small>
                    </div>

                    {/* 이메일 */}
                    <div className={signupStyles.formGroup}>
                        <label htmlFor="email" className="form-label text-start d-block">이메일</label>
                        <input type="email" id="email" name="email" value={user.email} disabled />
                    </div>

                    {/* 생년월일 */}
                    <div className={signupStyles.formGroup}>
                        <label htmlFor="birthDate" className="form-label text-start d-block">생년월일</label>
                        <input type="date" id="birthDate" name="birth_date" value={birthDate} onChange={handleBirthDateChange} />
                    </div>

                    {/* 성별 */}
                    <div className={signupStyles.formGroup}>
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
                    <div className={signupStyles.formGroup}>
                        <label htmlFor="currentPassword" className="form-label text-start d-block">현재 비밀번호</label>
                        <input type="password" id="currentPassword" name="current_password" placeholder="변경 시에만 입력" value={passwordData.current_password} onChange={handlePasswordChange} />
                    </div>

                    {/* 새 비밀번호 */}
                    <div className={signupStyles.formGroup}>
                        <label htmlFor="newPassword" className="form-label text-start d-block">새 비밀번호</label>
                        <input type="password" id="newPassword" name="new_password" placeholder="새 비밀번호 입력" value={passwordData.new_password} onChange={handlePasswordChange} />
                        <small>비밀번호는 영문, 숫자, 특수문자를 포함하여 9자리 이상으로 설정해주세요.</small>
                    </div>

                    {/* 새 비밀번호 확인 */}
                    <div className={signupStyles.formGroup}>
                        <label htmlFor="confirmPassword" className="form-label text-start d-block">새 비밀번호 확인</label>
                        <input type="password" id="confirmPassword" name="new_password_confirm" placeholder="새 비밀번호 다시 입력" value={passwordData.new_password_confirm} onChange={handlePasswordChange} />
                    </div>
                    
                    <div className={styles.actions}>
                        <button type="button" className={styles.cancelBtn} onClick={() => navigate(-1)}>취소</button>
                        <button type="submit" className={styles.saveBtn} disabled={!nicknameStatus.isValid}>변경사항 저장</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ProfilePage;