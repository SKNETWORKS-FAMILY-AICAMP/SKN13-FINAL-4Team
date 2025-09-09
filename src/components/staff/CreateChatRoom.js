import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../layout/Sidebar';
import api from '../../api'; 
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

    useEffect(() => {
        const fetchStreamers = async () => {
            try {
                const response = await api.get('/api/influencers/');
                const influencerList = response.data.results || [];
                setInfluencers(influencerList);

                if (influencerList.length > 0) {
                    setFormData(prev => ({ ...prev, influencer: influencerList[0].id }));
                }
            } catch (err) {
                console.error("인플루언서 목록 로딩 실패:", err);
                setError("인플루언서 목록을 불러오는데 실패했습니다. 관리자 권한이 있는지 확인해주세요.");
            }
        };
        fetchInfluencers();
    }, []);

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

        if (!formData.influencer) {
            setError('인플루언서를 선택해주세요.');
            return;
        }

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
            const response = await api.post('/api/chat/rooms/', submissionData, {
                headers: { 
                    'Content-Type': 'multipart/form-data',
                }
            });
            alert("방송이 생성되었습니다.");
            navigate(`/stream/${response.data.id}`);
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
                        <label htmlFor="influencer" className="form-label text-start d-block">인플루언서</label>
                        <select id="influencer" name="influencer" value={formData.influencer} onChange={handleChange} required>
                            <option value="" disabled>인플루언서를 선택하세요</option>
                            {influencers.map(inf => (
                                <option key={inf.id} value={inf.id}>
                                    {inf.name}
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
