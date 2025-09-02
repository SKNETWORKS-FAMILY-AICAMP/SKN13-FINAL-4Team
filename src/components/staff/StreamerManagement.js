import React, { useState, useEffect } from 'react';
import api from '../../utils/unifiedApiClient';
import Sidebar from '../layout/Sidebar';
import signupStyles from '../auth/SignupForm.module.css';
import { Modal, Button, Form, Alert, Spinner } from 'react-bootstrap';
import voiceValidationService from '../../services/voiceValidationService';

function StreamerManagement() {
    const [streamers, setStreamers] = useState([]);
    const [ttsSettings, setTtsSettings] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [selectedStreamer, setSelectedStreamer] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [modalSettings, setModalSettings] = useState({});
    const [availableVoices, setAvailableVoices] = useState([]);
    const [availableModels, setAvailableModels] = useState([]);
    const [voicesLoading, setVoicesLoading] = useState(false);


    useEffect(() => {
        // 초기 로딩 시 약간의 지연을 두어 토큰 갱신 완료를 기다림
        const initializeData = async () => {
            await fetchStreamers();
            await fetchAllTtsSettings();
            // 음성 목록은 토큰이 필요하므로 별도로 시도
            setTimeout(() => {
                loadAvailableVoices();
            }, 1000);
        };
        
        initializeData();
    }, []);

    const loadAvailableVoices = async () => {
        try {
            setVoicesLoading(true);
            
            // 토큰이 유효한지 먼저 확인
            const token = localStorage.getItem('accessToken');
            if (!token) {
                console.log('토큰이 없어 음성 목록 로딩을 연기합니다.');
                return;
            }
            
            // 음성과 모델 목록을 동시에 가져오기
            const [voiceResult, modelResult] = await Promise.all([
                voiceValidationService.getAvailableVoices().catch(() => null),
                voiceValidationService.getAvailableModels().catch(() => null)
            ]);
            
            // 음성 목록 설정 (한국인 음성만 필터링)
            if (voiceResult && voiceResult.success) {
                // 한국인 음성만 필터링
                const koreanVoices = (voiceResult.voices || []).filter(voice => {
                    const name = voice.name?.toLowerCase() || '';
                    const description = voice.description?.toLowerCase() || '';
                    const voiceId = voice.voice_id?.toLowerCase() || voice.id?.toLowerCase() || '';
                    
                    // 한국인 이름이나 Korean 키워드가 포함된 음성만 선택
                    return voiceId.includes('aneunjin') || voiceId.includes('kimtaeri') || 
                           voiceId.includes('kimminjeong') || voiceId.includes('jinseonkyu') || 
                           voiceId.includes('parkchangwook') || voiceId.includes('jiyoung') ||
                           name.includes('안은진') || name.includes('김태리') || 
                           name.includes('김민정') || name.includes('진선규') || 
                           name.includes('박창욱') || name.includes('jiyoung') ||
                           description.includes('korean') || description.includes('한국');
                });
                
                setAvailableVoices(koreanVoices);
            } else {
                // API 호출 실패 시 기본 한국인 음성 목록 사용
                const defaultKoreanVoices = [
                    { voice_id: 'aneunjin', name: '안은진' },
                    { voice_id: 'kimtaeri', name: '김태리' },
                    { voice_id: 'kimminjeong', name: '김민정' },
                    { voice_id: 'jinseonkyu', name: '진선규' },
                    { voice_id: 'parkchangwook', name: '박창욱' },
                    { voice_id: 'jiyoung', name: 'JiYoung' }
                ];
                setAvailableVoices(defaultKoreanVoices);
            }
            
            // 모델 목록 설정
            if (modelResult && modelResult.success) {
                setAvailableModels(modelResult.models || []);
            } else {
                // API 호출 실패 시 기본 모델 목록 사용 (2025년 최신 모델)
                const defaultModels = [
                    { id: 'eleven_v3', name: 'Eleven v3 (Alpha)', description: '최고 품질, 최신 표현력 (70+ 언어)' },
                    { id: 'eleven_turbo_v2_5', name: 'Turbo v2.5', description: '저지연 다국어 (32개 언어, 실시간 대화용)' },
                    { id: 'eleven_flash_v2_5', name: 'Flash v2.5', description: '초저지연 다국어 (<75ms, 32개 언어)' },
                    { id: 'eleven_multilingual_v2', name: 'Multilingual v2', description: '고품질 다국어 (보이스오버, 오디오북용)' }
                ];
                setAvailableModels(defaultModels);
            }
            
        } catch (error) {
            console.error('음성/모델 목록 로딩 실패:', error);
        } finally {
            setVoicesLoading(false);
        }
    };

    const fetchStreamers = async () => {
        try {
            const response = await api.get('/api/chat/streamers/');
            if (response.data.success) {
                setStreamers(response.data.streamers);
            }
        } catch (error) {
            console.error('스트리머 목록 조회 실패:', error);
            setError('스트리머 목록을 불러올 수 없습니다.');
        }
    };

    const fetchAllTtsSettings = async () => {
        try {
            const accessToken = localStorage.getItem('accessToken');
            const response = await api.get('/api/chat/admin/tts/settings/');
            
            if (response.data.success) {
                const settingsMap = {};
                response.data.settings.forEach(setting => {
                    settingsMap[setting.streamer_id] = setting;
                });
                setTtsSettings(settingsMap);
            }
        } catch (error) {
            console.error('TTS 설정 조회 실패:', error);
        }
    };

    const handleEditTtsSettings = (streamer) => {
        setSelectedStreamer(streamer);
        const currentSettings = ttsSettings[streamer.character_id] || {
            ttsEngine: 'elevenlabs',
            elevenLabsVoice: 'aneunjin',
            elevenLabsModel: 'eleven_multilingual_v2',
            elevenLabsStability: 0.5,
            elevenLabsSimilarity: 0.8,
            elevenLabsStyle: 0.0,
            elevenLabsSpeakerBoost: true,
            autoPlay: true,
            streamingDelay: 50,
            ttsDelay: 500,
            chunkSize: 3,
            syncMode: 'after_complete'
        };
        setModalSettings(currentSettings);
        setShowModal(true);
        
        // 모달이 열릴 때 음성 목록을 다시 로딩 (토큰이 갱신되었을 가능성)
        if (availableVoices.length === 0) {
            loadAvailableVoices();
        }
    };

    const handleSaveTtsSettings = async () => {
        if (!selectedStreamer) return;
        
        setLoading(true);
        try {

            const response = await api.post(
                `/api/chat/streamer/${selectedStreamer.character_id}/tts/settings/update/`,
                modalSettings
            );
            
            if (response.data.success) {
                // 전체 TTS 설정을 다시 불러와서 최신 상태 반영
                await fetchAllTtsSettings();
                setSuccess(`${selectedStreamer.display_name} TTS 설정이 업데이트되었습니다.`);
                setShowModal(false);
                setTimeout(() => setSuccess(''), 3000);
            }
        } catch (error) {
            console.error('TTS 설정 업데이트 실패:', error);
            if (error.response?.status === 401) {
                setError('로그인이 만료되었습니다. 페이지를 새로고침하고 다시 시도해주세요.');
            } else {
                setError(`TTS 설정 업데이트에 실패했습니다: ${error.response?.data?.error || error.message}`);
            }
            setTimeout(() => setError(''), 5000);
        } finally {
            setLoading(false);
        }
    };

    const handleModalSettingChange = (key, value) => {
        setModalSettings(prev => ({
            ...prev,
            [key]: value
        }));
    };

    return (
        <div className="admin-page-wrapper">
            <Sidebar />
            <div className={signupStyles.signupContainer}>
                <div className={signupStyles.signupHeader} style={{ marginBottom: '30px' }}>
                    <h1 style={{ 
                        fontSize: '2.5rem', 
                        fontWeight: 'bold', 
                        color: '#2c3e50',
                        marginBottom: '10px'
                    }}>
                        👥 인플루언서 관리
                    </h1>
                    <p style={{ 
                        fontSize: '1.1rem', 
                        color: '#6c757d',
                        marginBottom: '0'
                    }}>
                        등록된 AI 인플루언서와 TTS 설정을 관리합니다
                    </p>
                </div>

                {error && <Alert variant="danger">{error}</Alert>}
                {success && <Alert variant="success">{success}</Alert>}

                <div className="streamers-grid" style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    {loading && streamers.length === 0 ? (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            minHeight: '200px',
                            flexDirection: 'column',
                            gridColumn: '1 / -1'
                        }}>
                            <Spinner animation="border" variant="primary" />
                            <p style={{ marginTop: '15px', color: '#6c757d' }}>
                                인플루언서 정보를 불러오는 중...
                            </p>
                        </div>
                    ) : streamers.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '60px 20px',
                            color: '#6c757d',
                            gridColumn: '1 / -1'
                        }}>
                            <h4>등록된 인플루언서가 없습니다</h4>
                            <p>시스템에 등록된 AI 인플루언서가 없습니다.</p>
                        </div>
                    ) : (
                        streamers.map(streamer => {
                            const settings = ttsSettings[streamer.character_id];
                            return (
                                <div key={streamer.character_id} style={{ marginBottom: '20px' }}>
                                    <div style={{
                                        backgroundColor: 'white',
                                        border: '1px solid #e0e0e0',
                                        borderRadius: '12px',
                                        padding: '30px',
                                        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                                        minWidth: '800px',
                                        width: '100%'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
                                            {/* 이미지 */}
                                            <div style={{ flexShrink: 0 }}>
                                                <img 
                                                    src={`/images/${streamer.character_id}.jpg`}
                                                    alt={streamer.display_name}
                                                    style={{
                                                        width: '80px',
                                                        height: '80px',
                                                        borderRadius: '50%',
                                                        objectFit: 'cover',
                                                        objectPosition: 'center',
                                                        border: '2px solid #ddd',
                                                        display: 'block',
                                                        flexShrink: 0
                                                    }}
                                                />
                                            </div>
                                            
                                            {/* 정보 */}
                                            <div style={{ flex: 1 }}>
                                                <h3 style={{ margin: '0 0 15px 0', fontSize: '1.5rem', color: '#333' }}>
                                                    {streamer.display_name}
                                                </h3>
                                                
                                                <div style={{ display: 'flex', gap: '40px', marginBottom: '20px' }}>
                                                    <div>
                                                        <div style={{ marginBottom: '8px', fontSize: '0.95rem' }}>
                                                            <strong>ID:</strong> {streamer.character_id}
                                                        </div>
                                                        <div style={{ marginBottom: '8px', fontSize: '0.95rem' }}>
                                                            <strong>타입:</strong> {streamer.character_type || '미설정'}
                                                        </div>
                                                        <div style={{ fontSize: '0.95rem' }}>
                                                            <strong>비디오:</strong> {streamer.video_directory}
                                                        </div>
                                                    </div>
                                                    
                                                    {settings && (
                                                        <div style={{
                                                            backgroundColor: '#f8f9fa',
                                                            padding: '12px',
                                                            borderRadius: '8px',
                                                            border: '1px solid #e9ecef'
                                                        }}>
                                                            <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '0.9rem' }}>
                                                                🎵 TTS 설정
                                                            </div>
                                                            <div style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>
                                                                <div>음성: <strong>{settings.elevenLabsVoice}</strong></div>
                                                                <div>모델: <strong>{settings.elevenLabsModel}</strong></div>
                                                                <div>
                                                                    자동재생: <strong style={{ 
                                                                        color: settings.autoPlay ? '#28a745' : '#dc3545' 
                                                                    }}>
                                                                        {settings.autoPlay ? 'ON' : 'OFF'}
                                                                    </strong>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {streamer.description && (
                                                    <div style={{
                                                        fontSize: '0.9rem',
                                                        color: '#666',
                                                        fontStyle: 'italic',
                                                        padding: '10px',
                                                        backgroundColor: '#f8f9fa',
                                                        borderRadius: '5px',
                                                        borderLeft: '4px solid #007bff',
                                                        marginBottom: '15px'
                                                    }}>
                                                        {streamer.description}
                                                    </div>
                                                )}
                                                
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{
                                                            width: '10px',
                                                            height: '10px',
                                                            borderRadius: '50%',
                                                            backgroundColor: streamer.is_active ? '#28a745' : '#dc3545',
                                                            display: 'inline-block'
                                                        }}></span>
                                                        <span style={{ 
                                                            color: streamer.is_active ? '#28a745' : '#dc3545',
                                                            fontWeight: 'bold',
                                                            fontSize: '0.9rem'
                                                        }}>
                                                            {streamer.is_active ? '활성' : '비활성'}
                                                        </span>
                                                    </div>
                                                    
                                                    <Button 
                                                        variant="primary" 
                                                        onClick={() => handleEditTtsSettings(streamer)}
                                                        style={{
                                                            padding: '10px 20px',
                                                            fontSize: '1rem',
                                                            fontWeight: 'bold'
                                                        }}
                                                    >
                                                        ⚙️ TTS 설정 편집
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* TTS 설정 편집 모달 */}
            <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
                <Modal.Header closeButton style={{ borderBottom: '1px solid #dee2e6' }}>
                    <Modal.Title style={{ display: 'flex', alignItems: 'center' }}>
                        {selectedStreamer && (
                            <img 
                                src={`/images/${selectedStreamer.character_id}.jpg`}
                                alt={selectedStreamer.display_name}
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    objectFit: 'cover',
                                    borderRadius: '50%',
                                    marginRight: '12px',
                                    border: '2px solid #dee2e6'
                                }}
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                }}
                            />
                        )}
                        <div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                                {selectedStreamer?.display_name} TTS 설정
                            </div>
                            <small style={{ color: '#6c757d', fontWeight: 'normal' }}>
                                {selectedStreamer?.character_id}
                            </small>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <div className="row">
                            <div className="col-md-6">
                                <Form.Group className="mb-3">
                                    <Form.Label>
                                        ElevenLabs 음성 ID 
                                        {voicesLoading && <Spinner animation="border" size="sm" className="ms-2" />}
                                    </Form.Label>
                                    {availableVoices.length > 0 ? (
                                        <Form.Select
                                            value={modalSettings.elevenLabsVoice || ''}
                                            onChange={(e) => handleModalSettingChange('elevenLabsVoice', e.target.value)}
                                        >
                                            <option value="">음성을 선택하세요</option>
                                            {availableVoices.map(voice => (
                                                <option key={voice.voice_id || voice.id} value={voice.voice_id || voice.id}>
                                                    {voice.name}
                                                </option>
                                            ))}
                                        </Form.Select>
                                    ) : (
                                        <Form.Control
                                            type="text"
                                            value={modalSettings.elevenLabsVoice || ''}
                                            onChange={(e) => handleModalSettingChange('elevenLabsVoice', e.target.value)}
                                            placeholder="음성 ID를 입력하세요 (예: aneunjin, kimtaeri)"
                                        />
                                    )}
                                    <Form.Text className="text-muted">
                                        {availableVoices.length > 0 
                                            ? `${availableVoices.length}개의 한국인 음성 사용 가능` 
                                            : '한국인 음성 목록을 불러올 수 없어 직접 입력이 필요합니다'
                                        }
                                    </Form.Text>
                                </Form.Group>
                            </div>
                            <div className="col-md-6">
                                <Form.Group className="mb-3">
                                    <Form.Label>ElevenLabs 모델</Form.Label>
                                    <Form.Select
                                        value={modalSettings.elevenLabsModel || ''}
                                        onChange={(e) => handleModalSettingChange('elevenLabsModel', e.target.value)}
                                    >
                                        <option value="">모델을 선택하세요</option>
                                        {availableModels.map(model => (
                                            <option key={model.id} value={model.id}>
                                                {model.name} - {model.description}
                                            </option>
                                        ))}
                                    </Form.Select>
                                    <Form.Text className="text-muted">
                                        {availableModels.length > 0 
                                            ? `${availableModels.length}개의 사용 가능한 모델` 
                                            : '모델 목록을 불러올 수 없습니다'
                                        }
                                    </Form.Text>
                                </Form.Group>
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-4">
                                <Form.Group className="mb-3">
                                    <Form.Label>안정성 (0.0-1.0)</Form.Label>
                                    <Form.Control
                                        type="number"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={modalSettings.elevenLabsStability || 0.5}
                                        onChange={(e) => handleModalSettingChange('elevenLabsStability', parseFloat(e.target.value))}
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-4">
                                <Form.Group className="mb-3">
                                    <Form.Label>유사성 (0.0-1.0)</Form.Label>
                                    <Form.Control
                                        type="number"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={modalSettings.elevenLabsSimilarity || 0.8}
                                        onChange={(e) => handleModalSettingChange('elevenLabsSimilarity', parseFloat(e.target.value))}
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-4">
                                <Form.Group className="mb-3">
                                    <Form.Label>스타일 (0.0-1.0)</Form.Label>
                                    <Form.Control
                                        type="number"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={modalSettings.elevenLabsStyle || 0.0}
                                        onChange={(e) => handleModalSettingChange('elevenLabsStyle', parseFloat(e.target.value))}
                                    />
                                </Form.Group>
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-6">
                                <Form.Group className="mb-3">
                                    <Form.Check
                                        type="checkbox"
                                        label="스피커 부스트"
                                        checked={modalSettings.elevenLabsSpeakerBoost || false}
                                        onChange={(e) => handleModalSettingChange('elevenLabsSpeakerBoost', e.target.checked)}
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-6">
                                <Form.Group className="mb-3">
                                    <Form.Check
                                        type="checkbox"
                                        label="자동 재생"
                                        checked={modalSettings.autoPlay || false}
                                        onChange={(e) => handleModalSettingChange('autoPlay', e.target.checked)}
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
                                        min="0"
                                        value={modalSettings.streamingDelay || 50}
                                        onChange={(e) => handleModalSettingChange('streamingDelay', parseInt(e.target.value))}
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-4">
                                <Form.Group className="mb-3">
                                    <Form.Label>TTS 지연 (ms)</Form.Label>
                                    <Form.Control
                                        type="number"
                                        min="0"
                                        value={modalSettings.ttsDelay || 500}
                                        onChange={(e) => handleModalSettingChange('ttsDelay', parseInt(e.target.value))}
                                    />
                                </Form.Group>
                            </div>
                            <div className="col-md-4">
                                <Form.Group className="mb-3">
                                    <Form.Label>청크 크기</Form.Label>
                                    <Form.Control
                                        type="number"
                                        min="1"
                                        value={modalSettings.chunkSize || 3}
                                        onChange={(e) => handleModalSettingChange('chunkSize', parseInt(e.target.value))}
                                    />
                                </Form.Group>
                            </div>
                        </div>

                        <Form.Group className="mb-3">
                            <Form.Label>동기화 모드</Form.Label>
                            <Form.Select
                                value={modalSettings.syncMode || 'after_complete'}
                                onChange={(e) => handleModalSettingChange('syncMode', e.target.value)}
                            >
                                <option value="real_time">실시간</option>
                                <option value="after_complete">완료 후</option>
                                <option value="chunked">청크별</option>
                            </Form.Select>
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowModal(false)}>
                        취소
                    </Button>
                    <Button 
                        variant="primary" 
                        onClick={handleSaveTtsSettings}
                        disabled={loading}
                    >
                        {loading ? '저장 중...' : '저장'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

export default StreamerManagement;