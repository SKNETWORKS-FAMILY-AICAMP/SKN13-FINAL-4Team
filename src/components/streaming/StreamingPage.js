import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Row, Col, Image, Button, Badge } from 'react-bootstrap';
import StreamingChatWithTTS from './StreamingChatWithTTS';
import VideoControlPanel from './VideoControlPanel';
import VideoTransitionManager from './VideoTransitionManager';
import { AITextSyncService } from '../../services/aiTextSyncService';
import { DEFAULT_SETTINGS } from '../../config/aiChatSettings';
import { TTSServiceManager } from '../../services/ttsServiceManager';
import AITTSEngineSelector from '../ai/AITTSEngineSelector';
import TTSSettingsManager from '../ai/TTSSettingsManager';
import { StreamingOrchestrator } from '../../services/StreamingOrchestrator';
import './StreamingPage.css';

function StreamingPage({ isLoggedIn, username }) {
    const { streamerId } = useParams();
    const audioRef = useRef(null);
    const videoContainerRef = useRef(null);
    const videoTransitionRef = useRef(null);
    
    // 비디오 상태 추가
    const [currentVideo, setCurrentVideo] = useState('a_idle_0.mp4');
    
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
    const [showSettingsManager, setShowSettingsManager] = useState(false);
    const ttsManagerRef = useRef(null);
    
    // 서버 TTS 설정 상태 추가
    const [serverTtsSettings, setServerTtsSettings] = useState(null);
    const [isServerSettingsLoaded, setIsServerSettingsLoaded] = useState(false);

    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(0.8);

    // 스트리밍 오케스트레이터 관련 상태 추가
    const streamingOrchestratorRef = useRef(null);
    const [isOrchestratorEnabled, setIsOrchestratorEnabled] = useState(false);
    const [orchestratorDebugInfo, setOrchestratorDebugInfo] = useState({
        currentSession: null,
        activePipelineSize: 0,
        sessionStats: {},
        performanceInfo: null
    });

    // 서버에서 TTS 설정 가져오기
    const fetchServerTtsSettings = async () => {
        if (!streamerId || !isLoggedIn) return;
        
        try {
            const token = localStorage.getItem('accessToken');
            const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
            
            const response = await fetch(`${apiBaseUrl}/api/streamer/${streamerId}/tts/settings/`, {
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

    // TTS Manager 초기화
    useEffect(() => {
        if (!ttsManagerRef.current) {
            ttsManagerRef.current = new TTSServiceManager(ttsSettings);
        } else {
            ttsManagerRef.current.updateSettings(ttsSettings);
        }
    }, [ttsSettings.ttsEngine]);

    // 스트리밍 오케스트레이터 초기화
    useEffect(() => {
        if (!streamingOrchestratorRef.current && ttsManagerRef.current && videoTransitionRef.current) {
            console.log('🎬 스트리밍 오케스트레이터 초기화');
            
            streamingOrchestratorRef.current = new StreamingOrchestrator(
                ttsManagerRef.current,
                videoTransitionRef.current,
                {
                    syncMode: 'realtime',
                    enableTextStreaming: true,
                    enableTTSQueue: true,
                    enableVideoSync: true,
                    enableProfiling: true,
                    textManager: {
                        chunkSize: 40,
                        enableSmartChunking: true,
                        pauseBetweenSentences: 300
                    },
                    ttsQueue: {
                        maxConcurrentJobs: 2,
                        preloadNext: true,
                        enableCaching: true
                    },
                    videoSync: {
                        enableLipSync: true,
                        videoLoopStrategy: 'smart',
                        emotionKeywords: {
                            happy: ['웃음', '기쁘', '행복', '좋아', '재미', 'ㅋㅋ', '😊'],
                            angry: ['화나', '짜증', '싫어', '아니'],
                            nod: ['맞아', '그래', '좋아', '네', '응']
                        }
                    }
                }
            );

            // 오케스트레이터 콜백 설정
            streamingOrchestratorRef.current.setCallbacks({
                onSessionStart: (session) => {
                    console.log('🎬 오케스트레이터 세션 시작:', session.id);
                    setOrchestratorDebugInfo(prev => ({
                        ...prev,
                        currentSession: session
                    }));
                },
                onSessionComplete: (session) => {
                    console.log('✅ 오케스트레이터 세션 완료:', session.id);
                    setOrchestratorDebugInfo(prev => ({
                        ...prev,
                        currentSession: null
                    }));
                },
                onChunkProgress: (progressInfo) => {
                    // 청크 진행 상황 업데이트
                    setOrchestratorDebugInfo(prev => ({
                        ...prev,
                        lastChunkProgress: progressInfo
                    }));
                },
                onDebugInfo: (debugInfo) => {
                    setOrchestratorDebugInfo(prev => ({
                        ...prev,
                        ...debugInfo
                    }));
                },
                onError: (errorInfo) => {
                    console.error('❌ 오케스트레이터 오류:', errorInfo);
                }
            });

            setIsOrchestratorEnabled(true);
        }
    }, [ttsManagerRef.current, videoTransitionRef.current]);

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

    // 비디오 변경 핸들러
    const handleVideoChange = (video, index) => {
        console.log('🎥 StreamingPage: 비디오 변경 핸들러 호출', {
            videoName: video.name,
            index,
            currentVideo
        });
        setCurrentVideo(video.name);
        console.log('✅ currentVideo state 업데이트됨:', video.name);
    };

    // 비디오 로딩 완료 핸들러
    const handleVideoLoaded = (videoSrc) => {
        console.log('✅ 비디오 전환 완료:', videoSrc);
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

    // WebSocket 메시지 처리 (TTS 설정 변경 포함)
    const handleWebSocketMessage = (data) => {
        if (data.type === 'tts_settings_changed' && data.settings) {
            setServerTtsSettings(data.settings);
            
            // 로컬 설정도 동기화
            setTtsSettings(prev => ({
                ...prev,
                ...data.settings
            }));
        }
    };

    // AI 메시지 처리 - 새로운 오케스트레이터 통합
    const handleAIMessage = async (message, audioDuration, audioElement, ttsInfo = {}) => {
        // 기존 동기화 시스템과 새로운 오케스트레이터 시스템 선택
        if (isOrchestratorEnabled && streamingOrchestratorRef.current) {
            await handleAIMessageWithOrchestrator(message, ttsInfo);
        } else {
            handleAIMessageLegacy(message, audioDuration, audioElement, ttsInfo);
        }
    };

    // 새로운 오케스트레이터를 사용한 AI 메시지 처리
    const handleAIMessageWithOrchestrator = async (message, ttsInfo = {}) => {
        try {
            console.log('🎬 오케스트레이터로 AI 메시지 처리:', message.substring(0, 50) + '...');
            
            // 고유 세션 ID 생성
            const sessionId = `ai_message_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // 오케스트레이터로 스트리밍 세션 시작
            await streamingOrchestratorRef.current.startStreamingSession(
                message,
                sessionId,
                {
                    ttsOptions: {
                        engine: ttsSettings.ttsEngine,
                        voice: ttsSettings.elevenLabsVoice,
                        ...ttsInfo
                    },
                    videoOptions: {
                        enableEmotionDetection: true,
                        lipSyncAccuracy: 'high'
                    }
                }
            );

            // 자막 표시 시작
            setCurrentSubtitle(message);
            setRevealedSubtitle('');
            setShowSubtitle(true);

            // 디버그 정보 업데이트
            setDebugInfo(prev => ({
                ...prev,
                syncMode: 'orchestrator',
                isPlaying: true,
                totalChars: message.length,
                sessionId
            }));

        } catch (error) {
            console.error('❌ 오케스트레이터 AI 메시지 처리 실패:', error);
            // 폴백으로 기존 시스템 사용
            handleAIMessageLegacy(message, 0, null, { ...ttsInfo, error: error.message });
        }
    };

    // 기존 레거시 AI 메시지 처리 (폴백용)
    const handleAIMessageLegacy = (message, audioDuration, audioElement, ttsInfo = {}) => {
        setCurrentSubtitle(message);
        setRevealedSubtitle('');
        setShowSubtitle(true);
        
        // TTS 정보에서 서버 설정 업데이트
        if (ttsInfo.serverSettings) {
            setServerTtsSettings(ttsInfo.serverSettings);
        }
        
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
                                        debugInfo.syncMode === 'orchestrator' ? 'bg-primary' :
                                        debugInfo.syncMode === 'audio-sync' ? 'bg-success' : 
                                        debugInfo.syncMode === 'delay-sync' ? 'bg-warning' :
                                        debugInfo.syncMode === 'completed' ? 'bg-info' : 'bg-secondary'
                                    }`}>
                                        {debugInfo.syncMode === 'orchestrator' ? '🎬 오케스트레이터' : debugInfo.syncMode}
                                    </span>
                                    {isOrchestratorEnabled && (
                                        <span className="badge bg-success ms-1" title="스트리밍 오케스트레이터 활성화됨">
                                            🎬
                                        </span>
                                    )}
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

                            {/* 오케스트레이터 디버그 정보 */}
                            {isOrchestratorEnabled && orchestratorDebugInfo.currentSession && (
                                <div className="mt-3 p-2 bg-dark bg-opacity-75 rounded">
                                    <h6 className="text-primary mb-2">🎬 오케스트레이터 상태</h6>
                                    <div className="row g-1 small">
                                        <div className="col-6">
                                            <strong>세션:</strong> {orchestratorDebugInfo.currentSession.id.split('_').pop()}
                                        </div>
                                        <div className="col-6">
                                            <strong>파이프라인:</strong> {orchestratorDebugInfo.activePipelineSize}개
                                        </div>
                                        {orchestratorDebugInfo.sessionStats.totalSessions > 0 && (
                                            <>
                                                <div className="col-6">
                                                    <strong>성공률:</strong> 
                                                    {Math.round((orchestratorDebugInfo.sessionStats.successfulSessions / orchestratorDebugInfo.sessionStats.totalSessions) * 100)}%
                                                </div>
                                                <div className="col-6">
                                                    <strong>평균 처리:</strong> 
                                                    {Math.round(orchestratorDebugInfo.sessionStats.averageProcessingTime)}ms
                                                </div>
                                            </>
                                        )}
                                        {orchestratorDebugInfo.lastChunkProgress && (
                                            <div className="col-12 mt-1">
                                                <div className="progress" style={{ height: '2px' }}>
                                                    <div 
                                                        className="progress-bar bg-primary" 
                                                        style={{ width: `${orchestratorDebugInfo.lastChunkProgress.progress}%` }}
                                                    />
                                                </div>
                                                <small className="text-muted">
                                                    청크 {orchestratorDebugInfo.lastChunkProgress.stage}: {Math.round(orchestratorDebugInfo.lastChunkProgress.progress)}%
                                                </small>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <Row>
                <Col md={8}>
                    <div className="video-player-wrapper" ref={videoContainerRef}>
                        {/* 비디오 트랜지션 매니저 */}
                        <VideoTransitionManager
                            ref={videoTransitionRef}
                            currentVideo={currentVideo}
                            onVideoLoaded={handleVideoLoaded}
                            className="streaming-video-container"
                        />
                        
                        {/* 비디오 로딩 실패 시 플레이스홀더 */}
                        <div className="video-placeholder d-flex align-items-center justify-content-center h-100" style={{display: 'none'}}>
                            <div className="text-center text-white">
                                <h3>🎥 AI 스트리머 방송</h3>
                                <p className="mb-0">실시간 스트리밍 중...</p>
                                
                                {/* 현재 TTS 설정 표시 */}
                                {isServerSettingsLoaded && serverTtsSettings && (
                                    <div className="mt-4 p-3 bg-dark bg-opacity-75 rounded">
                                        <h5 className="text-warning mb-3">🎤 현재 TTS 설정</h5>
                                        <div className="row text-start">
                                            <div className="col-md-6">
                                                <p><strong>엔진:</strong> 
                                                    <span className="badge bg-primary ms-2">
                                                        {serverTtsSettings.ttsEngine === 'elevenlabs' ? 'ElevenLabs' : 
                                                         serverTtsSettings.ttsEngine.toUpperCase()}
                                                    </span>
                                                </p>
                                                <p><strong>음성:</strong> 
                                                    <span className="badge bg-success ms-2">
                                                        {serverTtsSettings.elevenLabsVoice === 'aneunjin' ? '안은진' :
                                                         serverTtsSettings.elevenLabsVoice === 'kimtaeri' ? '김태리' :
                                                         serverTtsSettings.elevenLabsVoice === 'kimminjeong' ? '김민정' :
                                                         serverTtsSettings.elevenLabsVoice === 'jinseonkyu' ? '진선규' :
                                                         serverTtsSettings.elevenLabsVoice === 'parkchangwook' ? '박창욱' :
                                                         serverTtsSettings.elevenLabsVoice}
                                                    </span>
                                                </p>
                                                <p><strong>자동재생:</strong> 
                                                    <span className={`badge ms-2 ${serverTtsSettings.autoPlay ? 'bg-success' : 'bg-secondary'}`}>
                                                        {serverTtsSettings.autoPlay ? 'ON' : 'OFF'}
                                                    </span>
                                                </p>
                                            </div>
                                            <div className="col-md-6">
                                                <p><strong>모델:</strong> <code>{serverTtsSettings.elevenLabsModel}</code></p>
                                                <p><strong>안정성:</strong> {serverTtsSettings.elevenLabsStability}</p>
                                                <p><strong>유사성:</strong> {serverTtsSettings.elevenLabsSimilarity}</p>
                                            </div>
                                        </div>
                                        {serverTtsSettings.lastUpdatedBy && (
                                            <small className="text-muted">
                                                마지막 변경: {serverTtsSettings.lastUpdatedBy} 
                                                ({new Date(serverTtsSettings.updatedAt).toLocaleString('ko-KR')})
                                            </small>
                                        )}
                                    </div>
                                )}
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
                            <Button 
                                variant="outline-warning" 
                                size="sm" 
                                onClick={() => setShowSettingsManager(!showSettingsManager)}
                                title="TTS 관리 패널 토글"
                            >
                                ⚙️
                            </Button>
                            {isOrchestratorEnabled && (
                                <Button 
                                    variant={isOrchestratorEnabled ? "success" : "outline-secondary"} 
                                    size="sm" 
                                    onClick={() => {
                                        if (streamingOrchestratorRef.current) {
                                            streamingOrchestratorRef.current.stopStreaming();
                                        }
                                    }}
                                    title="오케스트레이터 중단"
                                >
                                    🎬
                                </Button>
                            )}
                        </div>
                        
                        {/* 비디오 제어 패널 */}
                        <VideoControlPanel onVideoChange={handleVideoChange} />
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
                                    onWebSocketMessage={handleWebSocketMessage}
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