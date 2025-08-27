import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../layout/Sidebar';
import '../auth/SignupForm.css'; // 회원가입 폼과 동일한 스타일 재사용

function CreateChatRoom() {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        influencer: '',
        status: 'pending',
    });
    const [thumbnailFile, setThumbnailFile] = useState(null);
    const [thumbnailPreview, setThumbnailPreview] = useState('');
    
    const [influencers, setInfluencers] = useState([]);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

    useEffect(() => {
        const fetchInfluencers = async () => {
            try {
                const accessToken = localStorage.getItem('accessToken');
                const response = await axios.get(`${apiBaseUrl}/api/users/management/`, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });

                const userList = response.data.results || [];
                setInfluencers(userList);

                // 인플루언서 목록을 불러온 후 첫 번째 사용자를 기본값으로 설정
                if (userList.length > 0) {
                    setFormData(prev => ({ ...prev, influencer: userList[0].id }));
                }
            } catch (err) {
                console.error("인플루언서 목록 로딩 실패:", err);
            }
        };
        fetchInfluencers();
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
        submissionData.append('influencer', formData.influencer);
        submissionData.append('status', formData.status);
        
        if (thumbnailFile) {
            submissionData.append('thumbnail', thumbnailFile);
        }

        try {
            const accessToken = localStorage.getItem('accessToken');
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
            <div className="signup-container">
                <div className="signup-header">
                    <h1>방송 생성</h1>
                    <p>새로운 방송의 정보를 입력해주세요.</p>
                </div>
                <form className="signup-form" onSubmit={handleSubmit}>
                    {error && <p className="error-message" style={{color: 'red', textAlign: 'center'}}>{error}</p>}
                    
                    {/* 썸네일 이미지 설정 UI */}
                    <div className="form-group thumbnail-group">
                        <label className="form-label text-start d-block">썸네일 이미지</label>
                        <div className="thumbnail-preview">
                            {thumbnailPreview ? (
                                <img src={thumbnailPreview} alt="썸네일 미리보기" />
                            ) : (
                                <div className="thumbnail-placeholder">이미지 없음</div>
                            )}
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleThumbnailChange}
                            accept="image/*"
                            style={{ display: 'none' }} 
                        />
                        <button type="button" className="thumbnail-upload-btn" onClick={handleThumbnailButtonClick}>
                            이미지 선택
                        </button>
                    </div>

                    {/* 방송 제목 */}
                    <div className="form-group">
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
                    <div className="form-group">
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

                    {/* 인플루언서 선택 */}
                    <div className="form-group">
                        <label htmlFor="influencer" className="form-label text-start d-block">인플루언서</label>
                        <select id="influencer" name="influencer" value={formData.influencer} onChange={handleChange} required>
                            <option value="" disabled>인플루언서를 선택하세요</option>
                            {influencers.map(inf => (
                                <option key={inf.id} value={inf.id}>
                                    {inf.nickname || inf.username}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 방송상태 */}
                    <div className="form-group">
                        <label htmlFor="status" className="form-label text-start d-block">방송상태</label>
                        <select id="status" name="status" value={formData.status} onChange={handleChange}>
                            <option value="pending">준비중</option>
                            <option value="live">방송중</option>
                            <option value="finished">방송종료</option>
                        </select>
                    </div>

                    <button type="submit" className="signup-btn">
                        생성하기
                    </button>
                </form>
            </div>
        </div>
    );
}

export default CreateChatRoom;