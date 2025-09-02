import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../layout/Sidebar';
import signupStyles from '../auth/SignupForm.module.css';

function CreateChatRoom() {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        streamer: '', // DB 연동: influencer → streamer 변경
        status: 'pending',
    });
    const [thumbnailFile, setThumbnailFile] = useState(null);
    const [thumbnailPreview, setThumbnailPreview] = useState('');
    
    const [streamers, setStreamers] = useState([]); // DB 연동: influencers → streamers 변경
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

    useEffect(() => {
        const fetchStreamers = async () => {
            try {
                // DB 연동: Streamer API 엔드포인트 사용
                const response = await axios.get(`${apiBaseUrl}/api/chat/streamers/`);

                const streamerList = response.data.streamers || [];
                setStreamers(streamerList);

                // 스트리머 목록을 불러온 후 첫 번째 스트리머를 기본값으로 설정
                if (streamerList.length > 0) {
                    setFormData(prev => ({ ...prev, streamer: streamerList[0].character_id }));
                }
            } catch (err) {
                console.error("스트리머 목록 로딩 실패:", err);
            }
        };
        fetchStreamers();
    }, [apiBaseUrl]); // apiBaseUrl을 의존성 배열에 추가

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleThumbnailChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setThumbnailFile(file);
            setThumbnailPreview(URL.createObjectURL(file));
        }
    };

    const handleThumbnailButtonClick = () => {
        fileInputRef.current.click();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const submissionData = new FormData();
        submissionData.append('name', formData.name);
        submissionData.append('description', formData.description);
        submissionData.append('streamer', formData.streamer); // DB 연동: influencer → streamer 변경
        submissionData.append('status', formData.status);
        
        if (thumbnailFile) {
            // 파일명 정규화: 특수문자 제거 및 길이 제한
            const cleanFileName = thumbnailFile.name
                .replace(/[^a-zA-Z0-9\u3131-\u3163\uac00-\ud7a3.]/g, '_') // 특수문자를 언더스코어로 변경
                .substring(0, 50) // 길이 제한
                + (thumbnailFile.name.includes('.') ? '.' + thumbnailFile.name.split('.').pop() : ''); // 확장자 보존
            
            const cleanedFile = new File([thumbnailFile], cleanFileName, {
                type: thumbnailFile.type,
                lastModified: thumbnailFile.lastModified
            });
            
            console.log('🔧 파일명 정규화:', thumbnailFile.name, '->', cleanFileName);
            submissionData.append('thumbnail', cleanedFile);
        }

        try {
            const accessToken = localStorage.getItem('accessToken');
            
            // 디버그: FormData 내용 출력
            console.log('🔍 FormData 디버깅:');
            for (let [key, value] of submissionData.entries()) {
                console.log(`  ${key}:`, value);
            }
            console.log('🔍 API URL:', `${apiBaseUrl}/api/chat/rooms/`);
            
            const response = await axios.post(`${apiBaseUrl}/api/chat/rooms/`, submissionData, {
                headers: { 
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'multipart/form-data',
                }
            });
            alert("방송이 생성되었습니다.");
            navigate(`/chat/${response.data.id}`);
        } catch (error){
            setError('방송 생성 중 오류가 발생했습니다.');
            console.error('방송 생성 오류:', error);
        }
    };

    return (
        <div className="admin-page-wrapper">
            <Sidebar />
            <div className={signupStyles.signupContainer}>
                <div className={signupStyles.signupHeader}>
                    <h1>방송 생성</h1>
                    <p>새로운 방송의 정보를 입력해주세요.</p>
                </div>
                <form className={signupStyles.signupForm} onSubmit={handleSubmit}>
                    {error && <p className="error-message" style={{color: 'red', textAlign: 'center'}}>{error}</p>}
                    
                    {/* 썸네일 이미지 설정 UI */}
                    <div className={`${signupStyles.formGroup} ${signupStyles.thumbnailGroup}`}>
                        <label className="form-label text-start d-block">썸네일 이미지</label>
                        <div className={signupStyles.thumbnailPreview}>
                            {thumbnailPreview ? (
                                <img src={thumbnailPreview} alt="썸네일 미리보기" />
                            ) : (
                                <div className={signupStyles.thumbnailPlaceholder}>이미지 없음</div>
                            )}
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleThumbnailChange}
                            accept="image/*"
                            style={{ display: 'none' }} 
                        />
                        <button type="button" className={signupStyles.thumbnailUploadBtn} onClick={handleThumbnailButtonClick}>
                            이미지 선택
                        </button>
                    </div>

                    {/* 방송 제목 */}
                    <div className={signupStyles.formGroup}>
                        <label htmlFor="name" className="form-label text-start d-block">방송 제목</label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            placeholder="방송 이름을 입력하세요"
                            value={formData.name}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    {/* 방송 설명 */}
                    <div className={signupStyles.formGroup}>
                        <label htmlFor="description" className="form-label text-start d-block">방송 설명</label>
                        <textarea
                            id="description"
                            name="description"
                            rows="4"
                            placeholder="방송에 대한 간단한 설명을 입력하세요"
                            value={formData.description}
                            onChange={handleChange}
                        />
                    </div>

                    {/* 스트리머 선택 (DB 연동) */}
                    <div className={signupStyles.formGroup}>
                        <label htmlFor="streamer" className="form-label text-start d-block">스트리머</label>
                        <select id="streamer" name="streamer" value={formData.streamer} onChange={handleChange} required>
                            <option value="" disabled>스트리머를 선택하세요</option>
                            {streamers.map(streamer => (
                                <option key={streamer.character_id} value={streamer.character_id}>
                                    {streamer.display_name} ({streamer.character_type})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 방송상태 */}
                    <div className={signupStyles.formGroup}>
                        <label htmlFor="status" className="form-label text-start d-block">방송상태</label>
                        <select id="status" name="status" value={formData.status} onChange={handleChange}>
                            <option value="pending">준비중</option>
                            <option value="live">방송중</option>
                            <option value="finished">방송종료</option>
                        </select>
                    </div>

                    <button type="submit" className={signupStyles.signupBtn}>
                        생성하기
                    </button>
                </form>
            </div>
        </div>
    );
}

export default CreateChatRoom;