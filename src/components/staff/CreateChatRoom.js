import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../layout/Sidebar';
import api from '../../api'; 
import '../auth/SignupForm.css';

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

    useEffect(() => {
        const fetchInfluencers = async () => {
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
        submissionData.append('influencer', formData.influencer);
        submissionData.append('status', formData.status);
        
        if (thumbnailFile) {
            submissionData.append('thumbnail', thumbnailFile);
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
            <div className="signup-container">
                <div className="signup-header">
                    <h1>방송 생성</h1>
                    <p>새로운 방송의 정보를 입력해주세요.</p>
                </div>
                <form className="signup-form" onSubmit={handleSubmit}>
                    {error && <p className="error-message" style={{color: 'red', textAlign: 'center'}}>{error}</p>}
                    
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

                    <div className="form-group">
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
