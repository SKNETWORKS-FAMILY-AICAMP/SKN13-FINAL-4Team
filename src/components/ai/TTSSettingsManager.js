import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Row, Col, Badge, Alert, Spinner } from 'react-bootstrap';

const TTSSettingsManager = ({ streamerId, isLoggedIn, username }) => {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // 음성 옵션 매핑
    const voiceOptions = {
        'aneunjin': '안은진 (밝고 명료한 여성 음성)',
        'kimtaeri': '김태리 (다양한 감정 표현 여성 음성)',
        'kimminjeong': '김민정 (차분하고 안정적인 여성 음성)',
        'jinseonkyu': '진선규 (따뜻하고 친근한 남성 음성)',
        'parkchangwook': '박창욱 (깊이 있고 권위적인 남성 음성)'
    };

    const modelOptions = {
        'eleven_multilingual_v2': 'Multilingual V2 (기본, 다국어)',
        'eleven_turbo_v2': 'Turbo V2 (고속)',
        'eleven_monolingual_v1': 'Monolingual V1 (영어 전용)'
    };

    // 서버에서 TTS 설정 가져오기
    const fetchSettings = async () => {
        if (!streamerId || !isLoggedIn) return;
        
        try {
            setLoading(true);
            setError(null);
            
            const token = localStorage.getItem('accessToken');
            const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
            
            const response = await fetch(`${apiBaseUrl}/api/streamer/${streamerId}/tts/settings/`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                setSettings(result.settings);
            } else {
                setError('TTS 설정을 불러오는데 실패했습니다: ' + result.error);
            }
        } catch (error) {
            setError('TTS 설정 로드 중 오류가 발생했습니다: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // 설정 변경 처리
    const handleSettingChange = (key, value) => {
        setSettings(prev => ({
            ...prev,
            [key]: value
        }));
    };

    // 서버에 설정 저장
    const saveSettings = async () => {
        if (!settings || !streamerId || !isLoggedIn) return;
        
        try {
            setSaving(true);
            setError(null);
            setSuccess(null);
            
            const token = localStorage.getItem('accessToken');
            const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
            
            const response = await fetch(`${apiBaseUrl}/api/streamer/${streamerId}/tts/settings/update/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    ttsEngine: settings.ttsEngine,
                    elevenLabsVoice: settings.elevenLabsVoice,
                    elevenLabsModel: settings.elevenLabsModel,
                    elevenLabsStability: parseFloat(settings.elevenLabsStability),
                    elevenLabsSimilarity: parseFloat(settings.elevenLabsSimilarity),
                    elevenLabsStyle: parseFloat(settings.elevenLabsStyle),
                    elevenLabsSpeakerBoost: settings.elevenLabsSpeakerBoost,
                    autoPlay: settings.autoPlay,
                    streamingDelay: parseInt(settings.streamingDelay),
                    ttsDelay: parseInt(settings.ttsDelay),
                    chunkSize: parseInt(settings.chunkSize),
                    syncMode: settings.syncMode
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                setSuccess(`✅ ${result.message} (변경자: ${result.changed_by})`);
                // 성공 메시지를 3초 후 자동 숨김
                setTimeout(() => setSuccess(null), 3000);
            } else {
                setError('TTS 설정 저장에 실패했습니다: ' + result.error);
            }
        } catch (error) {
            setError('TTS 설정 저장 중 오류가 발생했습니다: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    // 컴포넌트 마운트 시 설정 로드
    useEffect(() => {
        if (streamerId && isLoggedIn) {
            fetchSettings();
        }
    }, [streamerId, isLoggedIn]);

    if (!isLoggedIn) {
        return (
            <Alert variant="warning">
                <h5>🔐 로그인 필요</h5>
                <p>TTS 설정을 변경하려면 로그인이 필요합니다.</p>
            </Alert>
        );
    }

    if (loading) {
        return (
            <Card>
                <Card.Body className="text-center">
                    <Spinner animation="border" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </Spinner>
                    <p className="mt-2">TTS 설정을 불러오는 중...</p>
                </Card.Body>
            </Card>
        );
    }

    if (error) {
        return (
            <Alert variant="danger">
                <h5>⚠️ 오류 발생</h5>
                <p>{error}</p>
                <Button variant="outline-danger" onClick={fetchSettings}>
                    다시 시도
                </Button>
            </Alert>
        );
    }

    if (!settings) {
        return (
            <Alert variant="info">
                <h5>📝 설정 없음</h5>
                <p>TTS 설정을 찾을 수 없습니다.</p>
            </Alert>
        );
    }

    return (
        <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">🎤 TTS 설정 관리</h5>
                <Badge bg="primary">{streamerId}</Badge>
            </Card.Header>
            <Card.Body>
                {success && (
                    <Alert variant="success" className="mb-3">
                        {success}
                    </Alert>
                )}
                
                {error && (
                    <Alert variant="danger" className="mb-3">
                        {error}
                    </Alert>
                )}

                <Form>
                    <Row>
                        <Col md={6}>
                            {/* TTS 엔진 선택 */}
                            <Form.Group className="mb-3">
                                <Form.Label><strong>TTS 엔진</strong></Form.Label>
                                <Form.Select
                                    value={settings.ttsEngine}
                                    onChange={(e) => handleSettingChange('ttsEngine', e.target.value)}
                                >
                                    <option value="elevenlabs">ElevenLabs (프리미엄)</option>
                                    <option value="melotts">MeloTTS (실시간)</option>
                                    <option value="coqui">Coqui TTS (오픈소스)</option>
                                </Form.Select>
                            </Form.Group>

                            {/* ElevenLabs 음성 선택 */}
                            {settings.ttsEngine === 'elevenlabs' && (
                                <>
                                    <Form.Group className="mb-3">
                                        <Form.Label><strong>음성 선택</strong></Form.Label>
                                        <Form.Select
                                            value={settings.elevenLabsVoice}
                                            onChange={(e) => handleSettingChange('elevenLabsVoice', e.target.value)}
                                        >
                                            {Object.entries(voiceOptions).map(([key, value]) => (
                                                <option key={key} value={key}>{value}</option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>

                                    <Form.Group className="mb-3">
                                        <Form.Label><strong>모델 선택</strong></Form.Label>
                                        <Form.Select
                                            value={settings.elevenLabsModel}
                                            onChange={(e) => handleSettingChange('elevenLabsModel', e.target.value)}
                                        >
                                            {Object.entries(modelOptions).map(([key, value]) => (
                                                <option key={key} value={key}>{value}</option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>

                                    {/* ElevenLabs 고급 설정 */}
                                    <Form.Group className="mb-3">
                                        <Form.Label><strong>안정성: {settings.elevenLabsStability}</strong></Form.Label>
                                        <Form.Range
                                            min="0"
                                            max="1"
                                            step="0.1"
                                            value={settings.elevenLabsStability}
                                            onChange={(e) => handleSettingChange('elevenLabsStability', parseFloat(e.target.value))}
                                        />
                                    </Form.Group>

                                    <Form.Group className="mb-3">
                                        <Form.Label><strong>유사성: {settings.elevenLabsSimilarity}</strong></Form.Label>
                                        <Form.Range
                                            min="0"
                                            max="1"
                                            step="0.1"
                                            value={settings.elevenLabsSimilarity}
                                            onChange={(e) => handleSettingChange('elevenLabsSimilarity', parseFloat(e.target.value))}
                                        />
                                    </Form.Group>

                                    <Form.Group className="mb-3">
                                        <Form.Label><strong>스타일: {settings.elevenLabsStyle}</strong></Form.Label>
                                        <Form.Range
                                            min="0"
                                            max="1"
                                            step="0.1"
                                            value={settings.elevenLabsStyle}
                                            onChange={(e) => handleSettingChange('elevenLabsStyle', parseFloat(e.target.value))}
                                        />
                                    </Form.Group>

                                    <Form.Group className="mb-3">
                                        <Form.Check
                                            type="checkbox"
                                            label="스피커 부스트"
                                            checked={settings.elevenLabsSpeakerBoost}
                                            onChange={(e) => handleSettingChange('elevenLabsSpeakerBoost', e.target.checked)}
                                        />
                                    </Form.Group>
                                </>
                            )}
                        </Col>
                        
                        <Col md={6}>
                            {/* 기타 설정 */}
                            <Form.Group className="mb-3">
                                <Form.Check
                                    type="checkbox"
                                    label="자동 음성 재생"
                                    checked={settings.autoPlay}
                                    onChange={(e) => handleSettingChange('autoPlay', e.target.checked)}
                                />
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label><strong>동기화 모드</strong></Form.Label>
                                <Form.Select
                                    value={settings.syncMode}
                                    onChange={(e) => handleSettingChange('syncMode', e.target.value)}
                                >
                                    <option value="real_time">실시간</option>
                                    <option value="after_complete">완료 후</option>
                                    <option value="chunked">청크 단위</option>
                                </Form.Select>
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label><strong>스트리밍 지연 (ms): {settings.streamingDelay}</strong></Form.Label>
                                <Form.Range
                                    min="10"
                                    max="200"
                                    step="10"
                                    value={settings.streamingDelay}
                                    onChange={(e) => handleSettingChange('streamingDelay', parseInt(e.target.value))}
                                />
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label><strong>TTS 지연 (ms): {settings.ttsDelay}</strong></Form.Label>
                                <Form.Range
                                    min="100"
                                    max="2000"
                                    step="100"
                                    value={settings.ttsDelay}
                                    onChange={(e) => handleSettingChange('ttsDelay', parseInt(e.target.value))}
                                />
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label><strong>청크 크기: {settings.chunkSize}</strong></Form.Label>
                                <Form.Range
                                    min="1"
                                    max="10"
                                    step="1"
                                    value={settings.chunkSize}
                                    onChange={(e) => handleSettingChange('chunkSize', parseInt(e.target.value))}
                                />
                            </Form.Group>

                            {/* 설정 정보 */}
                            <div className="mt-4 p-3 bg-light rounded">
                                <h6 className="text-muted">설정 정보</h6>
                                {settings.lastUpdatedBy && (
                                    <p className="mb-1">
                                        <strong>마지막 변경:</strong> {settings.lastUpdatedBy}
                                    </p>
                                )}
                                {settings.updatedAt && (
                                    <p className="mb-0">
                                        <strong>변경 시간:</strong> {new Date(settings.updatedAt).toLocaleString('ko-KR')}
                                    </p>
                                )}
                            </div>
                        </Col>
                    </Row>

                    <hr />
                    
                    <div className="d-flex justify-content-between align-items-center">
                        <Button variant="outline-secondary" onClick={fetchSettings} disabled={saving}>
                            🔄 새로고침
                        </Button>
                        <Button 
                            variant="primary" 
                            onClick={saveSettings} 
                            disabled={saving}
                        >
                            {saving ? (
                                <>
                                    <Spinner animation="border" size="sm" className="me-2" />
                                    저장 중...
                                </>
                            ) : (
                                <>💾 모든 사용자에게 적용</>
                            )}
                        </Button>
                    </div>
                </Form>
            </Card.Body>
        </Card>
    );
};

export default TTSSettingsManager;