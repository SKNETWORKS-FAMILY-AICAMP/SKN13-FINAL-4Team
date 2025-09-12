import React, { useState, useEffect, useCallback } from 'react';
import { Container, Table, Spinner, Alert, Button, Modal, Form } from 'react-bootstrap';
import Sidebar from '../layout/Sidebar';
import api from '../../api';

function InfluencerManagementPage() {
    const [influencers, setInfluencers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // 모달 및 폼 상태
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedInfluencer, setSelectedInfluencer] = useState(null);
    const [formData, setFormData] = useState({});
    
    // 이미지 파일 상태 관리
    const [profileImageFile, setProfileImageFile] = useState(null);
    const [bannerImageFile, setBannerImageFile] = useState(null);
    const [profileImagePreview, setProfileImagePreview] = useState('');
    const [bannerImagePreview, setBannerImagePreview] = useState('');
    
    // TTS 설정 관리
    const [ttsSettings, setTtsSettings] = useState({});
    const [availableVoices, setAvailableVoices] = useState([]);

    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || '';

    const fetchInfluencers = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/influencers/');
            setInfluencers(response.data.results || []);
        } catch (err) {
            setError('인플루언서 목록을 불러오는 데 실패했습니다.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    // ElevenLabs 사용 가능한 음성 목록 가져오기
    const fetchAvailableVoices = useCallback(async () => {
        try {
            const response = await api.get('/api/chat/available-voices/');
            setAvailableVoices(response.data.voices || []);
        } catch (err) {
            console.error('음성 목록 로드 실패:', err);
        }
    }, []);

    // 특정 인플루언서의 TTS 설정 가져오기
    const fetchTTSSettings = useCallback(async (influencerId) => {
        try {
            const response = await api.get(`/api/influencers/${influencerId}/tts-settings/`);
            return response.data.data;
        } catch (err) {
            console.error('TTS 설정 로드 실패:', err);
            return null;
        }
    }, []);

    useEffect(() => {
        fetchInfluencers();
        fetchAvailableVoices();
    }, [fetchInfluencers, fetchAvailableVoices]);

    // 상태 초기화 함수
    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedInfluencer(null);
        setFormData({});
        setIsEditing(false);
        setProfileImageFile(null);
        setBannerImageFile(null);
        setProfileImagePreview('');
        setBannerImagePreview('');
    };

    const handleShowCreateModal = () => {
        setIsEditing(false);
        setFormData({ gender: '남', is_active: true }); // 기본값 설정
        setShowModal(true);
    };

    const handleShowEditModal = async (influencer) => {
        setIsEditing(true);
        setSelectedInfluencer(influencer);
        setFormData({ ...influencer });
        setProfileImagePreview(influencer.profile_image ? `${apiBaseUrl}${influencer.profile_image}` : '');
        setBannerImagePreview(influencer.banner_image ? `${apiBaseUrl}${influencer.banner_image}` : '');
        
        // TTS 설정 로드
        const ttsData = await fetchTTSSettings(influencer.id);
        setTtsSettings(ttsData || {
            tts_engine: 'elevenlabs',
            elevenlabs_voice: 'aneunjin',
            elevenlabs_voice_name: '안은진',
            elevenlabs_model: 'eleven_multilingual_v2',
            elevenlabs_stability: 0.5,
            elevenlabs_similarity: 0.8,
            elevenlabs_style: 0.0,
            elevenlabs_speaker_boost: true,
            auto_play: true,
            streaming_delay: 50,
            tts_delay: 500,
            chunk_size: 3,
            sync_mode: 'after_complete'
        });
        
        setShowModal(true);
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        // 체크박스 타입 처리
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    // TTS 설정 변경 핸들러
    const handleTTSChange = (e) => {
        const { name, value, type, checked } = e.target;
        setTtsSettings(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : (type === 'number' ? parseFloat(value) : value)
        }));
    };

    // 이미지 변경 핸들러
    const handleImageChange = (e, setImageFile, setImagePreview) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const submissionData = new FormData();
        for (const key in formData) {
            if (formData[key] !== null && formData[key] !== undefined) {
                submissionData.append(key, formData[key]);
            }
        }
        if (profileImageFile) {
            submissionData.append('profile_image', profileImageFile);
        }
        if (bannerImageFile) {
            submissionData.append('banner_image', bannerImageFile);
        }

        const apiCall = isEditing 
            ? api.patch(`/api/influencers/${selectedInfluencer.id}/`, submissionData, { headers: { 'Content-Type': 'multipart/form-data' } })
            : api.post('/api/influencers/', submissionData, { headers: { 'Content-Type': 'multipart/form-data' } });

        try {
            const result = await apiCall;
            
            // 수정 모드인 경우 TTS 설정도 업데이트
            if (isEditing && selectedInfluencer) {
                try {
                    await api.patch(`/api/influencers/${selectedInfluencer.id}/tts-settings/`, ttsSettings);
                    console.log('TTS 설정 업데이트 성공');
                } catch (ttsErr) {
                    console.error('TTS 설정 업데이트 실패:', ttsErr);
                    alert('인플루언서 정보는 저장되었지만 TTS 설정 저장에 실패했습니다.');
                }
            }
            
            alert(`인플루언서 정보가 성공적으로 ${isEditing ? '수정' : '생성'}되었습니다.`);
            handleCloseModal();
            fetchInfluencers();
        } catch (err) {
            alert(`작업에 실패했습니다: ${JSON.stringify(err.response?.data) || err.message}`);
            console.error(err);
        }
    };

    if (loading) return <Container className="d-flex justify-content-center mt-5"><Spinner animation="border" /></Container>;
    if (error) return <Container className="mt-5"><Alert variant="danger">{error}</Alert></Container>;

    return (
        <div className="admin-page-wrapper">
            <Sidebar />
            <Container className="admin-content-container">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h2>인플루언서 관리</h2>
                    <Button variant="primary" onClick={handleShowCreateModal}>새 인플루언서 추가</Button>
                </div>
                <Table striped bordered hover responsive>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>프로필이미지</th>
                            <th>이름</th>
                            <th>나이/성별</th>
                            <th>직업</th>
                            <th>활성 상태</th>
                            <th>관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {influencers.map(inf => (
                            <tr key={inf.id}>
                                <td>{inf.id}</td>
                                <td><img src={inf.profile_image} alt="프로필 이미지"
                                style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', display: 'flex', alignItems: 'center'}}/></td>
                                <td>{inf.name}</td>
                                <td>{inf.age} / {inf.gender}</td>
                                <td>{inf.job}</td>
                                <td>{inf.is_active ? '활성' : '비활성'}</td>
                                <td>
                                    <Button variant="outline-primary" size="sm" onClick={() => handleShowEditModal(inf)}>
                                        수정
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </Container>

            <Modal show={showModal} onHide={handleCloseModal} centered size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>{isEditing ? '인플루언서 수정' : '새 인플루언서 추가'}</Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleSubmit}>
                    <Modal.Body>
                        <Form.Group className="mb-3">
                            <Form.Label>이름</Form.Label>
                            <Form.Control type="text" name="name" value={formData.name || ''} onChange={handleChange} required />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>나이</Form.Label>
                            <Form.Control type="number" name="age" value={formData.age || ''} onChange={handleChange} required />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>성별</Form.Label>
                            <Form.Select name="gender" value={formData.gender || '남'} onChange={handleChange}>
                                <option value="남">남성</option>
                                <option value="여">여성</option>
                            </Form.Select>
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>MBTI</Form.Label>
                            <Form.Control type="text" name="mbti" value={formData.mbti || ''} onChange={handleChange} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>직업</Form.Label>
                            <Form.Control as="textarea" rows={2} name="job" value={formData.job || ''} onChange={handleChange} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>시청자 호칭</Form.Label>
                            <Form.Control type="text" name="audience_term" value={formData.audience_term || ''} onChange={handleChange} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>스토리</Form.Label>
                            <Form.Control as="textarea" rows={4} name="origin_story" value={formData.origin_story || ''} onChange={handleChange} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>프로필 이미지</Form.Label>
                            {profileImagePreview && <img src={profileImagePreview} alt="프로필 미리보기" style={{ maxWidth: '100px', display: 'block', marginBottom: '10px' }} />}
                            <Form.Control type="file" name="profile_image" onChange={(e) => handleImageChange(e, setProfileImageFile, setProfileImagePreview)} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>배너 이미지</Form.Label>
                            {bannerImagePreview && <img src={bannerImagePreview} alt="배너 미리보기" style={{ maxWidth: '200px', display: 'block', marginBottom: '10px' }} />}
                            <Form.Control type="file" name="banner_image" onChange={(e) => handleImageChange(e, setBannerImageFile, setBannerImagePreview)} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Check 
                                type="switch"
                                id="is_active_switch"
                                label="활성 상태"
                                name="is_active"
                                checked={formData.is_active || false}
                                onChange={handleChange}
                            />
                        </Form.Group>

                        {/* TTS 설정 섹션 - 수정 모드에서만 표시 */}
                        {isEditing && (
                            <>
                                <hr className="my-4" />
                                <h5 className="mb-3">🎤 TTS 설정</h5>
                                
                                <Form.Group className="mb-3">
                                    <Form.Label>ElevenLabs 음성</Form.Label>
                                    <Form.Select 
                                        name="elevenlabs_voice" 
                                        value={ttsSettings.elevenlabs_voice || 'aneunjin'} 
                                        onChange={handleTTSChange}
                                    >
                                        <option value="aneunjin">안은진</option>
                                        <option value="kimtaeri">김태리</option>
                                        <option value="kimminjeong">김민정</option>
                                        <option value="jinseonkyu">진선규</option>
                                        <option value="parkchangwook">박창욱</option>
                                        <option value="jiyoung">지영</option>
                                    </Form.Select>
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>음성 이름 (표시용)</Form.Label>
                                    <Form.Control 
                                        type="text" 
                                        name="elevenlabs_voice_name" 
                                        value={ttsSettings.elevenlabs_voice_name || ''} 
                                        onChange={handleTTSChange} 
                                        placeholder="예: 안은진"
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3">
                                    <Form.Label>ElevenLabs 모델</Form.Label>
                                    <Form.Select 
                                        name="elevenlabs_model" 
                                        value={ttsSettings.elevenlabs_model || 'eleven_multilingual_v2'} 
                                        onChange={handleTTSChange}
                                    >
                                        <option value="eleven_multilingual_v2">Multilingual v2</option>
                                        <option value="eleven_turbo_v2_5">Turbo v2.5</option>
                                        <option value="eleven_flash_v2_5">Flash v2.5</option>
                                        <option value="eleven_v3">Eleven v3 (Alpha)</option>
                                    </Form.Select>
                                </Form.Group>

                                <div className="row">
                                    <div className="col-md-6">
                                        <Form.Group className="mb-3">
                                            <Form.Label>안정성 ({ttsSettings.elevenlabs_stability || 0.5})</Form.Label>
                                            <Form.Range 
                                                name="elevenlabs_stability"
                                                min="0" 
                                                max="1" 
                                                step="0.1" 
                                                value={ttsSettings.elevenlabs_stability || 0.5}
                                                onChange={handleTTSChange}
                                            />
                                        </Form.Group>
                                    </div>
                                    <div className="col-md-6">
                                        <Form.Group className="mb-3">
                                            <Form.Label>유사성 ({ttsSettings.elevenlabs_similarity || 0.8})</Form.Label>
                                            <Form.Range 
                                                name="elevenlabs_similarity"
                                                min="0" 
                                                max="1" 
                                                step="0.1" 
                                                value={ttsSettings.elevenlabs_similarity || 0.8}
                                                onChange={handleTTSChange}
                                            />
                                        </Form.Group>
                                    </div>
                                </div>

                                <div className="row">
                                    <div className="col-md-6">
                                        <Form.Group className="mb-3">
                                            <Form.Label>스타일 ({ttsSettings.elevenlabs_style || 0.0})</Form.Label>
                                            <Form.Range 
                                                name="elevenlabs_style"
                                                min="0" 
                                                max="1" 
                                                step="0.1" 
                                                value={ttsSettings.elevenlabs_style || 0.0}
                                                onChange={handleTTSChange}
                                            />
                                        </Form.Group>
                                    </div>
                                    <div className="col-md-6">
                                        <Form.Group className="mb-3">
                                            <Form.Check 
                                                type="switch"
                                                id="speaker_boost_switch"
                                                label="스피커 부스트"
                                                name="elevenlabs_speaker_boost"
                                                checked={ttsSettings.elevenlabs_speaker_boost || false}
                                                onChange={handleTTSChange}
                                            />
                                        </Form.Group>
                                    </div>
                                </div>

                                <div className="row">
                                    <div className="col-md-4">
                                        <Form.Group className="mb-3">
                                            <Form.Label>스트리밍 지연 (ms)</Form.Label>
                                            <Form.Control 
                                                type="number" 
                                                name="streaming_delay" 
                                                value={ttsSettings.streaming_delay || 50} 
                                                onChange={handleTTSChange}
                                                min="0"
                                                max="1000"
                                            />
                                        </Form.Group>
                                    </div>
                                    <div className="col-md-4">
                                        <Form.Group className="mb-3">
                                            <Form.Label>TTS 지연 (ms)</Form.Label>
                                            <Form.Control 
                                                type="number" 
                                                name="tts_delay" 
                                                value={ttsSettings.tts_delay || 500} 
                                                onChange={handleTTSChange}
                                                min="0"
                                                max="2000"
                                            />
                                        </Form.Group>
                                    </div>
                                    <div className="col-md-4">
                                        <Form.Group className="mb-3">
                                            <Form.Label>청크 크기</Form.Label>
                                            <Form.Control 
                                                type="number" 
                                                name="chunk_size" 
                                                value={ttsSettings.chunk_size || 3} 
                                                onChange={handleTTSChange}
                                                min="1"
                                                max="10"
                                            />
                                        </Form.Group>
                                    </div>
                                </div>

                                <div className="row">
                                    <div className="col-md-6">
                                        <Form.Group className="mb-3">
                                            <Form.Label>동기화 모드</Form.Label>
                                            <Form.Select 
                                                name="sync_mode" 
                                                value={ttsSettings.sync_mode || 'after_complete'} 
                                                onChange={handleTTSChange}
                                            >
                                                <option value="after_complete">완료 후</option>
                                                <option value="real_time">실시간</option>
                                                <option value="chunked">청크 단위</option>
                                            </Form.Select>
                                        </Form.Group>
                                    </div>
                                    <div className="col-md-6">
                                        <Form.Group className="mb-3">
                                            <Form.Check 
                                                type="switch"
                                                id="auto_play_switch"
                                                label="자동 재생"
                                                name="auto_play"
                                                checked={ttsSettings.auto_play || false}
                                                onChange={handleTTSChange}
                                            />
                                        </Form.Group>
                                    </div>
                                </div>
                            </>
                        )}
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={handleCloseModal}>취소</Button>
                        <Button variant="primary" type="submit">저장</Button>
                    </Modal.Footer>
                </Form>
            </Modal>
        </div>
    );
}

export default InfluencerManagementPage;