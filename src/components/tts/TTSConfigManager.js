import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Row, Col, Badge, Alert, Spinner } from 'react-bootstrap';
import voiceValidationService from '../../services/voiceValidationService';

const TTSSettingsManager = ({ streamerId, isLoggedIn, username }) => {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [voiceOptions, setVoiceOptions] = useState({});
    const [validationWarnings, setValidationWarnings] = useState([]);
    const [voicesLoading, setVoicesLoading] = useState(false);

    // 기본 음성 옵션 (폴백용)
    const defaultVoiceOptions = {
        'aneunjin': '안은진 (밝고 명료한 여성 음성)',
        'kimtaeri': '김태리 (다양한 감정 표현 여성 음성)',
        'kimminjeong': '김민정 (차분하고 안정적인 여성 음성)',
        'jiyoung': 'JiYoung (활기찬 젊은 여성 음성)',
        'jinseonkyu': '진선규 (따뜻하고 친근한 남성 음성)',
        'parkchangwook': '박창욱 (깊이 있고 권위적인 남성 음성)'
    };

    const modelOptions = {
        'eleven_v3': 'V3 (최신, 고품질)',
        'eleven_turbo_v2_5': 'Turbo V2.5 (개선된 고속)'
    };

    // Backend에서 검증된 음성 목록 로드
    const loadValidatedVoices = async () => {
        try {
            setVoicesLoading(true);
            
            // Voice ID 검증 실행
            const validationResult = await voiceValidationService.validateVoiceIds();
            const warnings = voiceValidationService.generateValidationWarnings(validationResult);
            setValidationWarnings(warnings);

            if (validationResult.success) {
                const { summary } = validationResult;
                
                if (summary.fallback_mode) {
                    // 폴백 모드: 모든 기본 음성을 사용하되 경고 표시
                    console.warn('⚠️ 폴백 모드: 기본 음성 사용, API 연결 확인 필요');
                    setVoiceOptions(defaultVoiceOptions);
                } else {
                    // 정상 모드: 유효한 음성만 필터링
                    const validVoices = {};
                    Object.entries(defaultVoiceOptions).forEach(([key, value]) => {
                        if (validationResult.validation_results[key]) {
                            validVoices[key] = value;
                        }
                    });

                    if (Object.keys(validVoices).length > 0) {
                        setVoiceOptions(validVoices);
                        console.log('✅ 검증된 음성 목록 로드:', validVoices);
                    } else {
                        console.warn('⚠️ 유효한 음성이 없어 기본 옵션 사용');
                        setVoiceOptions(defaultVoiceOptions);
                    }
                }
            } else {
                // 검증 완전 실패 시 기본 옵션 사용
                console.warn('⚠️ Voice 검증 실패, 기본 옵션 사용');
                setVoiceOptions(defaultVoiceOptions);
            }
        } catch (error) {
            console.error('❌ Voice 검증 로드 실패:', error);
            setVoiceOptions(defaultVoiceOptions);
            setValidationWarnings([{
                type: 'error',
                message: 'Voice 검증을 불러오는데 실패했습니다. 기본 설정을 사용합니다.'
            }]);
        } finally {
            setVoicesLoading(false);
        }
    };

    // 서버에서 TTS 설정 가져오기
    const fetchSettings = async () => {
        if (!streamerId || !isLoggedIn) return;
        
        try {
            setLoading(true);
            setError(null);
            
            const token = localStorage.getItem('accessToken');
            const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
            
            const response = await fetch(`${apiBaseUrl}/api/chat/streamer/${streamerId}/tts/settings/`, {
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
            
            const response = await fetch(`${apiBaseUrl}/api/chat/streamer/${streamerId}/tts/settings/update/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    ttsEngine: 'elevenlabs', // ElevenLabs 고정
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

    // 컴포넌트 마운트 시 Voice 검증 및 설정 로드
    useEffect(() => {
        const initializeComponent = async () => {
            // 1. 먼저 Voice 검증 실행
            await loadValidatedVoices();
            
            // 2. TTS 설정 로드
            if (streamerId && isLoggedIn) {
                await fetchSettings();
            }
        };

        initializeComponent();
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
                {/* Voice 검증 경고 메시지 */}
                {validationWarnings.length > 0 && (
                    <div className="mb-3">
                        {validationWarnings.map((warning, index) => (
                            <Alert 
                                key={index} 
                                variant={warning.type === 'error' ? 'danger' : warning.type === 'warning' ? 'warning' : 'info'}
                                className="mb-2"
                            >
                                <small>{warning.message}</small>
                            </Alert>
                        ))}
                    </div>
                )}

                {/* 음성 로딩 상태 */}
                {voicesLoading && (
                    <Alert variant="info" className="mb-3">
                        <Spinner animation="border" size="sm" className="me-2" />
                        ElevenLabs 음성 목록을 검증하는 중...
                    </Alert>
                )}

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
                    {/* ElevenLabs 고정 안내 */}
                    <Alert variant="info" className="mb-4">
                        <h6 className="mb-2">🎯 ElevenLabs TTS 전용</h6>
                        <p className="mb-0">
                            이 스트리밍 시스템은 최고 품질의 ElevenLabs TTS만 사용합니다. 
                            한국 배우들의 프리미엄 음성으로 최상의 스트리밍 경험을 제공합니다.
                        </p>
                    </Alert>

                    <Row>
                        <Col md={6}>
                            {/* 음성 선택 */}
                            <Form.Group className="mb-3">
                                <Form.Label><strong>🎤 음성 선택</strong></Form.Label>
                                <Form.Select
                                    value={settings.elevenLabsVoice}
                                    onChange={(e) => handleSettingChange('elevenLabsVoice', e.target.value)}
                                >
                                    {Object.entries(voiceOptions).map(([key, value]) => (
                                        <option key={key} value={key}>{value}</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>

                            {/* 모델 선택 */}
                            <Form.Group className="mb-3">
                                <Form.Label><strong>🤖 모델 선택</strong></Form.Label>
                                <Form.Select
                                    value={settings.elevenLabsModel}
                                    onChange={(e) => handleSettingChange('elevenLabsModel', e.target.value)}
                                >
                                    {Object.entries(modelOptions).map(([key, value]) => (
                                        <option key={key} value={key}>{value}</option>
                                    ))}
                                </Form.Select>
                                <Form.Text className="text-muted">
                                    V3 모델은 최신 기술로 더 자연스럽고 고품질의 음성을 제공합니다.
                                </Form.Text>
                            </Form.Group>

                            {/* ElevenLabs 고급 설정 */}
                            <hr className="mb-3" />
                            <h6 className="mb-3">⚙️ 고급 음성 설정</h6>
                            
                            <Form.Group className="mb-3">
                                <Form.Label><strong>안정성: {settings.elevenLabsStability}</strong></Form.Label>
                                <Form.Range
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={settings.elevenLabsStability}
                                    onChange={(e) => handleSettingChange('elevenLabsStability', parseFloat(e.target.value))}
                                />
                                <Form.Text className="text-muted">
                                    높을수록 일관성 있지만 단조로울 수 있음
                                </Form.Text>
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
                                <Form.Text className="text-muted">
                                    원본 음성과의 유사도 (높을수록 원본에 가까움)
                                </Form.Text>
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
                                <Form.Text className="text-muted">
                                    표현력과 감정의 강도 (높을수록 역동적)
                                </Form.Text>
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Check
                                    type="checkbox"
                                    label="🔊 스피커 부스트 활성화"
                                    checked={settings.elevenLabsSpeakerBoost}
                                    onChange={(e) => handleSettingChange('elevenLabsSpeakerBoost', e.target.checked)}
                                />
                                <Form.Text className="text-muted">
                                    음성의 선명도와 음량을 향상시킵니다
                                </Form.Text>
                            </Form.Group>
                        </Col>
                        
                        <Col md={6}>
                            {/* 스트리밍 설정 */}
                            <h6 className="mb-3">📡 스트리밍 설정</h6>
                            
                            <Form.Group className="mb-3">
                                <Form.Check
                                    type="checkbox"
                                    label="🎵 자동 음성 재생"
                                    checked={settings.autoPlay}
                                    onChange={(e) => handleSettingChange('autoPlay', e.target.checked)}
                                />
                                <Form.Text className="text-muted">
                                    AI 응답 시 자동으로 TTS 음성을 재생합니다
                                </Form.Text>
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label><strong>🔄 동기화 모드</strong></Form.Label>
                                <Form.Select
                                    value={settings.syncMode}
                                    onChange={(e) => handleSettingChange('syncMode', e.target.value)}
                                >
                                    <option value="real_time">실시간 (텍스트와 오디오 동시)</option>
                                    <option value="after_complete">완료 후 (생성 완료 후 재생)</option>
                                    <option value="chunked">청크 단위 (단락별 표시)</option>
                                </Form.Select>
                                <Form.Text className="text-muted">
                                    텍스트 표시와 오디오 재생의 동기화 방식
                                </Form.Text>
                            </Form.Group>

                            <hr className="mb-3" />
                            <h6 className="mb-3">⚡ 성능 조정</h6>

                            <Form.Group className="mb-3">
                                <Form.Label><strong>스트리밍 지연: {settings.streamingDelay}ms</strong></Form.Label>
                                <Form.Range
                                    min="10"
                                    max="200"
                                    step="10"
                                    value={settings.streamingDelay}
                                    onChange={(e) => handleSettingChange('streamingDelay', parseInt(e.target.value))}
                                />
                                <Form.Text className="text-muted">
                                    텍스트가 글자별로 나타나는 속도
                                </Form.Text>
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label><strong>TTS 지연: {settings.ttsDelay}ms</strong></Form.Label>
                                <Form.Range
                                    min="100"
                                    max="2000"
                                    step="100"
                                    value={settings.ttsDelay}
                                    onChange={(e) => handleSettingChange('ttsDelay', parseInt(e.target.value))}
                                />
                                <Form.Text className="text-muted">
                                    TTS 음성 생성 전 대기 시간
                                </Form.Text>
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label><strong>청크 크기: {settings.chunkSize}자</strong></Form.Label>
                                <Form.Range
                                    min="1"
                                    max="10"
                                    step="1"
                                    value={settings.chunkSize}
                                    onChange={(e) => handleSettingChange('chunkSize', parseInt(e.target.value))}
                                />
                                <Form.Text className="text-muted">
                                    한 번에 표시할 글자 수 (작을수록 부드러움)
                                </Form.Text>
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
                        <div>
                            <Button 
                                variant="outline-secondary" 
                                onClick={fetchSettings} 
                                disabled={saving || voicesLoading}
                                className="me-2"
                            >
                                🔄 설정 새로고침
                            </Button>
                            <Button 
                                variant="outline-info" 
                                onClick={loadValidatedVoices} 
                                disabled={saving || voicesLoading}
                            >
                                {voicesLoading ? (
                                    <>
                                        <Spinner animation="border" size="sm" className="me-2" />
                                        음성 검증중...
                                    </>
                                ) : (
                                    <>🎤 음성 재검증</>
                                )}
                            </Button>
                        </div>
                        <Button 
                            variant="primary" 
                            onClick={saveSettings} 
                            disabled={saving || voicesLoading}
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