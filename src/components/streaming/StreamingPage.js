import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios'; 
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Image, Button, Badge, Spinner, Alert } from 'react-bootstrap';
import StreamingChatWithTTS from './StreamingChatWithTTS';
import DonationIsland from './DonationIsland';
import { AITextSyncService } from '../../services/aiTextSyncService';
import { DEFAULT_SETTINGS } from '../../config/aiChatSettings';
import { TTSServiceManager } from '../../services/ttsServiceManager';
import AITTSEngineSelector from '../ai/AITTSEngineSelector';
import TTSSettingsManager from '../ai/TTSSettingsManager';
import './StreamingPage.css';
import apiClient from '../../utils/apiClient';

function StreamingPage({ isLoggedIn, username }) {
    const { roomId } = useParams();
    const [chatRoom, setChatRoom] = useState(null);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const audioRef = useRef(null);
    const videoContainerRef = useRef(null);
    
    const [currentSubtitle, setCurrentSubtitle] = useState('');
    const [revealedSubtitle, setRevealedSubtitle] = useState('');
    const [showSubtitle, setShowSubtitle] = useState(false);
    const subtitleTimeoutRef = useRef(null);
    const textSyncServiceRef = useRef(null);
    
    const [debugInfo, setDebugInfo] = useState({});
    const [showDebug, setShowDebug] = useState(false);
    
    const [ttsSettings, setTtsSettings] = useState({
        ...DEFAULT_SETTINGS,
        autoPlay: true,
        ttsEngine: 'elevenlabs',
        elevenLabsVoice: 'aneunjin'
    });
    const [showTtsSettings, setShowTtsSettings] = useState(false);
    const [showSettingsManager, setShowSettingsManager] = useState(false);
    const ttsManagerRef = useRef(null);
    
    const [serverTtsSettings, setServerTtsSettings] = useState(null);
    const [isServerSettingsLoaded, setIsServerSettingsLoaded] = useState(false);

    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(0.8);

    // 후원 아일랜드 상태
    const [isDonationIslandOpen, setIsDonationIslandOpen] = useState(false);

    // 채팅방 정보 가져오기
    useEffect(() => {
        const fetchChatRoom = async () => {
            try {
                const response = await apiClient.get(`/api/chat/rooms/${streamerId}/`);
                setChatRoom(response.data);
            } catch (error) {
                console.error('Error fetching chat room:', error);
            }
        };

        if (streamerId) {
            fetchChatRoom();
        }
    }, [streamerId]);

    // 서버에서 TTS 설정 가져오기
    const fetchServerTtsSettings = async () => {
        if (!streamerId || !isLoggedIn) return;
        
        try {
            const token = localStorage.getItem('accessToken');
            const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
            
            const response = await fetch(`${apiBaseUrl}/api/chat/streamer/${streamerId}/tts/settings/`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                setServerTtsSettings(result.settings);
                setIsServerSettingsLoaded(true);
                
                // 로컬 설정도 서버 설정으로 동기화
                setTtsSettings(prev => ({
                    ...prev,
                    ...result.settings
                }));
            } else {
                console.error('❌ 서버 TTS 설정 로드 실패:', result.error);
            }
        } catch (error) {
            console.error('❌ 서버 TTS 설정 로드 오류:', error);
        }
    };

    // TTS 설정 업데이트 함수
    const handleTtsSettingChange = (key, value) => {
        const newSettings = { ...ttsSettings, [key]: value };
        setTtsSettings(newSettings);
        
        if (ttsManagerRef.current) {
            ttsManagerRef.current.updateSettings(newSettings);
        }
    };

    // 서버 TTS 설정 로드
    useEffect(() => {
        if (isLoggedIn && streamerId) {
            fetchServerTtsSettings();
        }
    }, [isLoggedIn, streamerId]);

    useEffect(() => {
        if (!ttsManagerRef.current) {
            ttsManagerRef.current = new TTSServiceManager(ttsSettings);
        } else {
            ttsManagerRef.current.updateSettings(ttsSettings);
        }
    }, [ttsSettings]);

    const handleAction = (action) => {
        if (!isLoggedIn) {
            alert('로그인이 필요한 기능입니다.');
            return;
        }
        action();
    };

    const handleDonation = () => handleAction(() => setIsDonationIslandOpen(true));
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
        if (videoContainerRef.current?.requestFullscreen) {
            videoContainerRef.current.requestFullscreen();
        }
    };

    const handleWebSocketMessage = (data) => {
        if (data.type === 'tts_settings_changed' && data.settings) {
            setServerTtsSettings(data.settings);
            setTtsSettings(prev => ({ ...prev, ...data.settings }));
        }
    };

    const handleAIMessage = (message, audioDuration, audioElement, ttsInfo = {}) => {
        setCurrentSubtitle(message);
        setRevealedSubtitle('');
        setShowSubtitle(true);
        if (ttsInfo.serverSettings) setServerTtsSettings(ttsInfo.serverSettings);
        
        if (subtitleTimeoutRef.current) clearTimeout(subtitleTimeoutRef.current);
        if (textSyncServiceRef.current) textSyncServiceRef.current.stopReveal();
        
        if (audioDuration > 0) {
            textSyncServiceRef.current.startSynchronizedReveal(message, audioDuration);
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
            profilePic: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCA1MCA1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyNSIgY3k9IjI1IiByPSIyNSIgZmlsbD0iIzAwNzNlNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZvbnQtd2VpZ-weight="bold" fill="#fff" text-anchor="middle" dy=".3em">AI</text></svg>', 
            bio: 'sLLM 기반 AI 스트리머입니다. 여러분과 소통하고 싶어요!' 
        }
    };

    return (
        <Container fluid className="streaming-container mt-4">
            {/* 후원 아일랜드 */}
            {isDonationIslandOpen && chatRoom && (
                <DonationIsland 
                    roomId={chatRoom.id} 
                    streamerId={streamerId} 
                    onClose={() => setIsDonationIslandOpen(false)} 
                />
            )}

            {/* 통합 설정 패널 - 디버그, TTS 설정, 설정 관리 통합 */}
            {(showDebug || showTtsSettings || showSettingsManager) && (
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
                                        if (!showTtsSettings) {
                                            setShowDebug(false);
                                            setShowSettingsManager(false);
                                        }
                                    }}
                                >
                                    🎵 TTS 설정
                                </Button>
                                <Button 
                                    variant={showSettingsManager ? "warning" : "outline-warning"}
                                    size="sm" 
                                    onClick={() => {
                                        setShowSettingsManager(!showSettingsManager);
                                        if (!showSettingsManager) {
                                            setShowDebug(false);
                                            setShowTtsSettings(false);
                                        }
                                    }}
                                >
                                    ⚙️ 설정 관리
                                </Button>
                            </div>
                            <Button 
                                variant="outline-secondary" 
                                size="sm" 
                                onClick={() => {
                                    setShowDebug(false);
                                    setShowTtsSettings(false);
                                    setShowSettingsManager(false);
                                }}
                            >
                                ✕
                            </Button>
                        </div>
                        
                        <div>
                            {/* 설정 관리 패널 내용 */}
                            {showSettingsManager && (
                                <div className="settings-content">
                                    <TTSSettingsManager 
                                        streamerId={streamerId}
                                        isLoggedIn={isLoggedIn}
                                        username={username}
                                    />
                                </div>
                            )}
                            
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
                        <video className="streaming-video" autoPlay loop muted playsInline>
                            <source src="/videos/a_idle.mp4" type="video/mp4" />
                            Your browser does not support the video tag.
                        </video>
                        {showSubtitle && revealedSubtitle && (
                            <div className="ai-subtitle">
                                <div className="subtitle-background">
                                    <span className="subtitle-text">{revealedSubtitle}</span>
                                </div>
                            </div>
                        )}
                        <div className="video-controls">
                            <Button variant="secondary" size="sm" onClick={handleMuteToggle}>{isMuted ? 'Unmute' : 'Mute'}</Button>
                            <input type="range" min="0" max="1" step="0.01" value={volume} onChange={handleVolumeChange} className="volume-slider" />
                            <Button variant="secondary" size="sm" onClick={handleFullscreen}>Fullscreen</Button>
                        </div>
                    </div>
                    <div className="stream-info mt-3">
                        <h3>{chatRoom.name}</h3>
                        <div className="d-flex justify-content-between align-items-center text-muted">
                            <span>시청자 수: 0명</span>
                            <span>방송 시작: {new Date(chatRoom.created_at).toLocaleString('ko-KR')}</span>
                        </div>
                        <hr />
                        <div className="d-flex align-items-center my-3">
                            <Image src={chatRoom.influencer?.profile_image ? `${apiBaseUrl}${chatRoom.influencer.profile_image}` : 'https://via.placeholder.com/50'} roundedCircle />
                            <div className="ms-3">
                                <h5 className="mb-0">{chatRoom.influencer?.nickname || chatRoom.host.username}</h5>
                                <p className="mb-0">{chatRoom.description}</p>
                            </div>
                        </div>
                    </div>
                </Col>
                <Col md={4}>
                    <div className="chat-section-wrapper d-flex flex-column h-100">
                        <div className="chat-container-with-input flex-grow-1 d-flex flex-column">
                            <StreamingChatWithTTS 
                                streamerId={streamerId}
                                roomId={roomId}
                                isLoggedIn={isLoggedIn}
                                username={username}
                                onAIMessage={handleAIMessage}
                                onWebSocketMessage={handleWebSocketMessage}
                            />
                        </div>
                    </div>
                </Col>
            </Row>
        </Container>
    );
}

export default StreamingPage;