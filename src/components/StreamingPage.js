import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Row, Col, Image, Button, Badge } from 'react-bootstrap';
import StreamingChatWithTTS from './StreamingChatWithTTS';
import { AITextSyncService } from '../services/aiTextSyncService';
import { DEFAULT_SETTINGS } from '../config/aiChatSettings';
import { TTSServiceManager } from '../services/ttsServiceManager';
import AITTSEngineSelector from './AITTSEngineSelector';
import './StreamingPage.css';

function StreamingPage({ isLoggedIn, username }) {
    const { streamerId } = useParams();
    const audioRef = useRef(null);
    const videoContainerRef = useRef(null);
    
    // 자막 상태 추가
    const [currentSubtitle, setCurrentSubtitle] = useState('');
    const [revealedSubtitle, setRevealedSubtitle] = useState('');
    const [showSubtitle, setShowSubtitle] = useState(false);
    const subtitleTimeoutRef = useRef(null);
    const textSyncServiceRef = useRef(null);
    
    // 디버그 정보 상태
    const [debugInfo, setDebugInfo] = useState({
        isPlaying: false,
        audioDuration: 0,
        currentTime: 0,
        textProgress: 0,
        totalChars: 0,
        revealedChars: 0,
        syncMode: 'none',
        ttsEngine: 'none',
        voiceSettings: {},
        audioFileSize: 0,
        generationTime: 0,
        error: null,
        requestedEngine: 'none',
        fallbackUsed: false
    });
    const [showDebug, setShowDebug] = useState(false); // 기본값을 false로 변경
    
    // TTS 설정 상태 추가
    const [ttsSettings, setTtsSettings] = useState({
        ...DEFAULT_SETTINGS,
        autoPlay: true,
        ttsEngine: 'elevenlabs',
        elevenLabsVoice: 'aneunjin'
    });
    const [showTtsSettings, setShowTtsSettings] = useState(false);
    const ttsManagerRef = useRef(null);

    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(0.8);

    // TTS 설정 업데이트 함수
    const handleTtsSettingChange = (key, value) => {
        const newSettings = { ...ttsSettings, [key]: value };
        setTtsSettings(newSettings);
        
        if (ttsManagerRef.current) {
            ttsManagerRef.current.updateSettings(newSettings);
        }
    };

    // TTS Manager 초기화
    useEffect(() => {
        if (!ttsManagerRef.current) {
            ttsManagerRef.current = new TTSServiceManager(ttsSettings);
        } else {
            ttsManagerRef.current.updateSettings(ttsSettings);
        }
    }, [ttsSettings.ttsEngine]);

    const handleAction = (action) => {
        if (!isLoggedIn) {
            alert('로그인이 필요한 기능입니다.');
            return;
        }
        action();
    };

    const handleDonation = () => handleAction(() => alert('준비중입니다.'));
    const handleEmoji = () => handleAction(() => alert('준비중입니다.'));

    const handleMuteToggle = () => {
        if (!audioRef.current) return;
        const nextMuted = !audioRef.current.muted;
        audioRef.current.muted = nextMuted;
        setIsMuted(nextMuted);
    };

    const handleVolumeChange = (e) => {
        if (!audioRef.current) return;
        const newVolume = parseFloat(e.target.value);
        audioRef.current.volume = newVolume;
        setVolume(newVolume);
        if (newVolume > 0 && audioRef.current.muted) {
            audioRef.current.muted = false;
            setIsMuted(false);
        }
    };

    const handleFullscreen = () => {
        if (videoContainerRef.current && videoContainerRef.current.requestFullscreen) {
            videoContainerRef.current.requestFullscreen();
        }
    };

    // 텍스트 동기화 서비스 초기화
    useEffect(() => {
        if (!textSyncServiceRef.current) {
            textSyncServiceRef.current = new AITextSyncService({
                chunkSize: DEFAULT_SETTINGS.chunkSize || 3,
                streamingDelay: DEFAULT_SETTINGS.streamingDelay || 50
            });
            textSyncServiceRef.current.setCallbacks(
                (revealed) => {
                    setRevealedSubtitle(revealed);
                    // 디버그 정보 업데이트
                    setDebugInfo(prev => ({
                        ...prev,
                        revealedChars: revealed.length,
                        textProgress: prev.totalChars > 0 ? (revealed.length / prev.totalChars * 100) : 0
                    }));
                },
                () => {
                    // 완료 후 3초 뒤에 자막 숨기기
                    setDebugInfo(prev => ({ ...prev, isPlaying: false, syncMode: 'completed' }));
                    subtitleTimeoutRef.current = setTimeout(() => {
                        setShowSubtitle(false);
                        setRevealedSubtitle('');
                        setDebugInfo(prev => ({ ...prev, syncMode: 'none' }));
                    }, 3000);
                }
            );
        }
    }, []);

    // AI 메시지와 음성 재생 시간을 받아 동기화된 자막 표시
    const handleAIMessage = (message, audioDuration, audioElement, ttsInfo = {}) => {
        setCurrentSubtitle(message);
        setRevealedSubtitle('');
        setShowSubtitle(true);
        
        // 디버그 정보 초기화
        setDebugInfo({
            isPlaying: true,
            audioDuration: audioDuration || 0,
            currentTime: 0,
            textProgress: 0,
            totalChars: message.length,
            revealedChars: 0,
            syncMode: audioDuration > 0 ? 'audio-sync' : 'delay-sync',
            ttsEngine: ttsInfo.engine || 'unknown',
            voiceSettings: ttsInfo.voice || {},
            audioFileSize: ttsInfo.fileSize || 0,
            generationTime: ttsInfo.generationTime || 0,
            error: ttsInfo.error || null,
            requestedEngine: ttsInfo.requestedEngine || 'unknown',
            fallbackUsed: ttsInfo.fallbackUsed || false
        });
        
        // 기존 타이머와 동기화 정리
        if (subtitleTimeoutRef.current) {
            clearTimeout(subtitleTimeoutRef.current);
        }
        if (textSyncServiceRef.current) {
            textSyncServiceRef.current.stopReveal();
        }
        
        // 음성 재생 시간과 동기화된 텍스트 표시
        if (audioDuration && audioDuration > 0) {
            // 음성이 있을 때: 음성 시간에 맞춰 텍스트 스트리밍
            textSyncServiceRef.current.startSynchronizedReveal(message, audioDuration);
            
            // 오디오 시간 추적 (디버그용)
            if (audioElement) {
                const updateAudioTime = () => {
                    if (audioElement.currentTime <= audioDuration) {
                        setDebugInfo(prev => ({
                            ...prev,
                            currentTime: audioElement.currentTime
                        }));
                        requestAnimationFrame(updateAudioTime);
                    }
                };
                updateAudioTime();
            }
        } else {
            // 음성이 없을 때: 기본 지연 시간으로 텍스트 스트리밍
            textSyncServiceRef.current.startDelayedReveal(message, () => {
                setTimeout(() => {
                    setShowSubtitle(false);
                    setRevealedSubtitle('');
                    setDebugInfo(prev => ({ ...prev, syncMode: 'none' }));
                }, 3000);
            });
        }
    };

    const streamInfo = {
        title: 'AI 스트리머 잼민이의 첫 방송!',
        viewers: 1234,
        keywords: ['AI', '코딩', '라이브', '스트리밍'],
        streamer: { 
            name: '잼민이', 
            profilePic: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCA1MCA1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyNSIgY3k9IjI1IiByPSIyNSIgZmlsbD0iIzAwNzNlNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+QUk8L3RleHQ+PC9zdmc+', 
            bio: 'sLLM 기반 AI 스트리머입니다. 여러분과 소통하고 싶어요!' 
        }
    };

    return (
        <Container fluid className="streaming-container mt-4">
            {/* 통합 설정 패널 - 디버그와 TTS 설정 통합 */}
            {(showDebug || showTtsSettings) && (
                <div className="settings-panel-overlay">
                    <div className="settings-panel-floating">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <div className="d-flex gap-2">
                                <Button 
                                    variant={showDebug ? "info" : "outline-info"}
                                    size="sm" 
                                    onClick={() => {
                                        setShowDebug(!showDebug);
                                        if (!showDebug) setShowTtsSettings(false);
                                    }}
                                >
                                    🔧 디버그
                                </Button>
                                <Button 
                                    variant={showTtsSettings ? "primary" : "outline-primary"}
                                    size="sm" 
                                    onClick={() => {
                                        setShowTtsSettings(!showTtsSettings);
                                        if (!showTtsSettings) setShowDebug(false);
                                    }}
                                >
                                    🎵 TTS 설정
                                </Button>
                            </div>
                            <Button 
                                variant="outline-secondary" 
                                size="sm" 
                                onClick={() => {
                                    setShowDebug(false);
                                    setShowTtsSettings(false);
                                }}
                            >
                                ✕
                            </Button>
                        </div>
                        
                        <div>
                            {/* TTS 설정 패널 내용 */}
                            {showTtsSettings && (
                                <div className="settings-content">
                                    <div className="mb-3">
                                        <AITTSEngineSelector
                                            currentEngine={ttsSettings.ttsEngine}
                                            settings={ttsSettings}
                                            onEngineChange={(engine) => handleTtsSettingChange('ttsEngine', engine)}
                                            onSettingChange={handleTtsSettingChange}
                                            ttsManager={ttsManagerRef.current}
                                        />
                                    </div>
                                    
                                    <div className="mb-2">
                                        <div className="form-check">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                id="autoPlayCheckFloat"
                                                checked={ttsSettings.autoPlay}
                                                onChange={(e) => handleTtsSettingChange('autoPlay', e.target.checked)}
                                            />
                                            <label className="form-check-label text-light" htmlFor="autoPlayCheckFloat">
                                                🎵 AI 메시지 자동 음성 재생
                                            </label>
                                        </div>
                                        <small className="text-muted">AI가 응답할 때 자동으로 음성을 재생합니다</small>
                                    </div>
                                </div>
                            )}
                            
                            {/* 디버그 패널 내용 */}
                            {showDebug && (
                                <div className="debug-content">
                                <div className="row g-2">
                                    <div className="col-12 mb-2">
                                        <strong>🎵 TTS 엔진:</strong>
                                        <span className={`badge ms-2 ${
                                            debugInfo.ttsEngine === 'openai' ? 'bg-success' :
                                            debugInfo.ttsEngine === 'elevenlabs' ? 'bg-primary' :
                                            debugInfo.ttsEngine === 'melotts' ? 'bg-warning' :
                                            debugInfo.ttsEngine === 'coqui' ? 'bg-info' : 'bg-secondary'
                                        }`}>
                                        {debugInfo.ttsEngine === 'elevenlabs' ? 'ElevenLabs TTS' :
                                         debugInfo.ttsEngine === 'elevenlabs' ? 'ElevenLabs' :
                                         debugInfo.ttsEngine === 'melotts' ? 'MeloTTS' :
                                         debugInfo.ttsEngine === 'coqui' ? 'Coqui TTS' :
                                         debugInfo.ttsEngine.toUpperCase()}
                                    </span>
                                    {debugInfo.fallbackUsed && (
                                        <span className="badge bg-warning ms-2" title={`요청: ${debugInfo.requestedEngine}, 실제사용: ${debugInfo.ttsEngine}`}>
                                            ⚠️ 폴백됨 ({debugInfo.requestedEngine} → {debugInfo.ttsEngine})
                                        </span>
                                    )}
                                    {debugInfo.requestedEngine !== debugInfo.ttsEngine && !debugInfo.fallbackUsed && (
                                        <span className="badge bg-info ms-2" title="설정과 실제 사용 엔진이 다름">
                                            ℹ️ 엔진불일치 (설정:{debugInfo.requestedEngine} / 사용:{debugInfo.ttsEngine})
                                        </span>
                                    )}
                                    {debugInfo.voiceSettings && typeof debugInfo.voiceSettings === 'string' && (
                                        <small className="ms-2 text-muted">({debugInfo.voiceSettings})</small>
                                    )}
                                </div>
                                <div className="col-6">
                                    <strong>동기화:</strong>
                                    <span className={`badge ms-2 ${
                                        debugInfo.syncMode === 'audio-sync' ? 'bg-success' : 
                                        debugInfo.syncMode === 'delay-sync' ? 'bg-warning' :
                                        debugInfo.syncMode === 'completed' ? 'bg-info' : 'bg-secondary'
                                    }`}>
                                        {debugInfo.syncMode}
                                    </span>
                                </div>
                                <div className="col-6">
                                    <strong>상태:</strong>
                                    <span className={`badge ms-2 ${debugInfo.isPlaying ? 'bg-success' : 'bg-secondary'}`}>
                                        {debugInfo.isPlaying ? '재생 중' : '정지'}
                                    </span>
                                </div>
                                <div className="col-6">
                                    <strong>시간:</strong>
                                    <span className="ms-2 small">{debugInfo.currentTime.toFixed(1)}s / {debugInfo.audioDuration.toFixed(1)}s</span>
                                </div>
                                <div className="col-6">
                                    <strong>텍스트:</strong>
                                    <span className="ms-2 small">{debugInfo.revealedChars} / {debugInfo.totalChars}자</span>
                                </div>
                                {debugInfo.audioFileSize > 0 && (
                                    <div className="col-6">
                                        <strong>파일:</strong>
                                        <span className="ms-2 small">{(debugInfo.audioFileSize / 1024).toFixed(1)}KB</span>
                                    </div>
                                )}
                                {debugInfo.generationTime > 0 && (
                                    <div className="col-6">
                                        <strong>생성:</strong>
                                        <span className="ms-2 small">{debugInfo.generationTime.toFixed(2)}초</span>
                                    </div>
                                )}
                                {debugInfo.error && (
                                    <div className="col-12 mt-2">
                                        <span className="badge bg-danger me-2">⚠️ 오류</span>
                                        <small className="text-danger">{debugInfo.error}</small>
                                    </div>
                                )}
                            </div>
                            <div className="progress mt-2" style={{ height: '3px' }}>
                                <div 
                                    className="progress-bar bg-success" 
                                    style={{ width: `${debugInfo.textProgress}%` }}
                                ></div>
                            </div>
                            <small className="text-muted d-block mt-1" style={{ fontSize: '0.7rem' }}>
                                "{revealedSubtitle.length > 50 ? revealedSubtitle.substring(0, 50) + '...' : revealedSubtitle}"
                            </small>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <Row>
                <Col md={8}>
                    <div className="video-player-wrapper" ref={videoContainerRef}>
                        {/* 비디오 플레이스홀더 */}
                        <div className="video-placeholder d-flex align-items-center justify-content-center h-100">
                            <div className="text-center text-white">
                                <h3>🎥 AI 스트리머 방송</h3>
                                <p className="mb-0">실시간 스트리밍 중...</p>
                            </div>
                        </div>
                        
                        {/* AI 자막 표시 - 스트리밍 텍스트 */}
                        {showSubtitle && revealedSubtitle && (
                            <div className="ai-subtitle">
                                <div className="subtitle-background">
                                    <span className="subtitle-text">{revealedSubtitle}</span>
                                </div>
                            </div>
                        )}
                        <div className="video-controls">
                            <Button variant="secondary" size="sm" onClick={handleMuteToggle}>
                                {isMuted ? 'Unmute' : 'Mute'}
                            </Button>
                            <input 
                                type="range" 
                                min="0" 
                                max="1" 
                                step="0.01" 
                                value={volume} 
                                onChange={handleVolumeChange} 
                                className="volume-slider" 
                            />
                            <Button variant="secondary" size="sm" onClick={handleFullscreen}>Fullscreen</Button>
                            <Button 
                                variant="outline-info" 
                                size="sm" 
                                onClick={() => setShowDebug(!showDebug)}
                                title="디버그 패널 토글"
                            >
                                🔧
                            </Button>
                            <Button 
                                variant="outline-primary" 
                                size="sm" 
                                onClick={() => setShowTtsSettings(!showTtsSettings)}
                                title="TTS 설정 패널 토글"
                            >
                                🎵
                            </Button>
                        </div>
                    </div>
                    <div className="stream-info mt-3">
                        <h3>{streamInfo.title}</h3>
                        <div className="d-flex justify-content-between align-items-center text-muted">
                            <span>시청자 수: {streamInfo.viewers}명</span>
                            <span>방송 시간: 00:12:34</span>
                        </div>
                        <hr />
                        <div className="d-flex align-items-center my-3">
                            <Image src={streamInfo.streamer.profilePic} roundedCircle />
                            <div className="ms-3">
                                <h5 className="mb-0">{streamInfo.streamer.name}</h5>
                                <p className="mb-0">{streamInfo.streamer.bio}</p>
                            </div>
                        </div>
                        <div className="keywords">
                            {streamInfo.keywords.map(k => <Badge pill bg="info" className="me-2" key={k}>#{k}</Badge>)}
                        </div>
                    </div>
                </Col>
                <Col md={4}>
                    <div className="chat-section-wrapper d-flex flex-column h-100">
                        {/* 채팅 컨테이너 - 대부분의 공간 사용, 입력창 포함 */}
                        <div className="chat-container-with-input flex-grow-1 d-flex flex-column">
                            {streamerId ? (
                                <StreamingChatWithTTS 
                                    streamerId={streamerId}
                                    isLoggedIn={isLoggedIn}
                                    username={username}
                                    onAIMessage={handleAIMessage}
                                    externalSettings={ttsSettings}
                                    onSettingsChange={handleTtsSettingChange}
                                    externalShowSettings={showTtsSettings}
                                    onShowSettingsChange={setShowTtsSettings}
                                />
                            ) : (
                                <div className="text-center text-muted p-4">
                                    <p>채팅을 불러오는 중...</p>
                                    <small>streamerId: {streamerId || 'loading...'}</small><br/>
                                    <small>isLoggedIn: {String(isLoggedIn)}</small><br/>
                                    <small>username: {username || 'loading...'}</small>
                                </div>
                            )}
                        </div>
                        
                        {/* 후원 버튼 영역 - 다시 활성화 */}
                        <div className="external-actions-wrapper flex-shrink-0">
                            <div className="external-actions">
                                <Button variant="warning" size="sm" onClick={handleDonation}>
                                    💰 후원
                                </Button>
                                <Button variant="light" size="sm" onClick={handleEmoji}>
                                    😊 이모티콘
                                </Button>
                            </div>
                        </div>
                    </div>
                </Col>
            </Row>
        </Container>
    );
}

export default StreamingPage;