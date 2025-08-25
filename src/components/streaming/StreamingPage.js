import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Row, Col, Image, Button, Badge } from 'react-bootstrap';
import StreamingChatClient from './StreamingChatClient';
import VideoControlPanel from './VideoControlPanel';
import VideoPlayer from './VideoPlayer';
// AITextSyncService는 Broadcasting 시스템에서 Backend로 이동됨
import { DEFAULT_SETTINGS } from '../../config/aiChatSettings';
import TTSConfigManager from '../tts/TTSConfigManager';
import { MediaSyncController } from '../../services/MediaSyncController';
import './StreamingPage.css';

function StreamingPage({ isLoggedIn, username }) {
    const { streamerId } = useParams();
    const audioRef = useRef(null);
    const videoContainerRef = useRef(null);
    const videoTransitionRef = useRef(null);
    
    // 현재 비디오 상태
    const [currentVideo, setCurrentVideo] = useState('a_idle_0.mp4');
    
    // 자막 상태 추가
    const [currentSubtitle, setCurrentSubtitle] = useState('');
    const [revealedSubtitle, setRevealedSubtitle] = useState('');
    const [showSubtitle, setShowSubtitle] = useState(false);
    const subtitleTimeoutRef = useRef(null);
    // textSyncService는 Broadcasting 시스템에서 Backend로 이동됨
    
    // 디버그 정보 상태
    const [debugInfo, setDebugInfo] = useState({
        isPlaying: false,
        audioDuration: 0,
        currentTime: 0,
        textProgress: 0,
        totalChars: 0,
        revealedChars: 0,
        syncMode: 'backend',
        ttsEngine: 'elevenlabs',
        voiceSettings: {},
        audioFileSize: 0,
        generationTime: 0,
        error: null,
        requestedEngine: 'elevenlabs',
        fallbackUsed: false
    });
    const [showDebug, setShowDebug] = useState(true); // 개발용으로 기본값을 true로 변경
    
    // TTS 설정 상태 추가
    const [ttsSettings, setTtsSettings] = useState({
        ...DEFAULT_SETTINGS,
        autoPlay: true,
        ttsEngine: 'elevenlabs',
        elevenLabsVoice: 'aneunjin'
    });
    const [showTtsSettings, setShowTtsSettings] = useState(false);
    const [showSettingsManager, setShowSettingsManager] = useState(false);
    
    // 서버 TTS 설정 상태 추가
    const [serverTtsSettings, setServerTtsSettings] = useState(null);
    const [isServerSettingsLoaded, setIsServerSettingsLoaded] = useState(false);

    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(0.8);

    // 새로운 Broadcasting 시스템 관련 상태 추가
    const syncMediaPlayerRef = useRef(null);
    const [isBroadcastingEnabled, setIsBroadcastingEnabled] = useState(true); // 기본적으로 활성화
    const [syncDebugInfo, setSyncDebugInfo] = useState({
        isPlaying: false,
        sync_id: null,
        network_latency: 0,
        sync_status: 'idle',
        active_broadcasts: 0
    });

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
        // Broadcasting 시스템에서는 Backend에서 TTS 설정 관리
    };

    // 서버 TTS 설정 로드
    useEffect(() => {
        if (isLoggedIn && streamerId) {
            fetchServerTtsSettings();
        }
    }, [isLoggedIn, streamerId]);

    // Legacy TTS Manager와 Orchestrator는 Broadcasting 시스템으로 대체됨

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

    // Broadcasting 시스템에서 자막은 Backend에서 동기화 처리됨

    // MediaSyncController 초기화 (간단한 버전)
    useEffect(() => {
        if (!syncMediaPlayerRef.current && videoTransitionRef.current) {
            console.log('🎬 MediaSyncController 초기화 시작:', {
                videoTransitionRef: !!videoTransitionRef.current,
                audioRef: !!audioRef.current
            });
            
            syncMediaPlayerRef.current = new MediaSyncController(
                videoTransitionRef, // ref 객체 자체를 전달
                audioRef,
                {
                    networkLatencyBuffer: 100,
                    autoReturnToIdle: true,
                    debugLogging: true,
                    onIdleReturn: (idle_video, sync_id) => {
                        // Idle 복귀 시 상태 업데이트
                        const videoSrc = idle_video.replace(/^\/videos\//, '').replace('jammin-i/', '');
                        setCurrentVideo(videoSrc);
                        console.log(`😐 Idle 복귀 완료: ${videoSrc}`);
                    },
                    onTalkStart: (talk_video, sync_id) => {
                        // Talk 시작 시 상태 업데이트
                        const videoSrc = talk_video.replace(/^\/videos\//, '').replace('jammin-i/', '');
                        setCurrentVideo(videoSrc);
                        console.log(`🗣️ Talk 시작 완료: ${videoSrc}`);
                    },
                    onPlaybackError: (sync_id, error) => {
                        console.error('❌ 재생 오류:', error);
                    }
                }
            );
            
            console.log('✅ MediaSyncController 초기화 완료');
        }
    }, [videoTransitionRef.current]);

    // WebSocket 메시지 처리 (TTS 설정 변경 및 새로운 Broadcasting 포함)
    const handleWebSocketMessage = (data) => {
        if (data.type === 'tts_settings_changed' && data.settings) {
            setServerTtsSettings(data.settings);
            
            // 로컬 설정도 동기화
            setTtsSettings(prev => ({
                ...prev,
                ...data.settings
            }));
        } 
        // 새로운 동기화된 미디어 브로드캐스트 처리
        else if (data.type === 'synchronized_media' && isBroadcastingEnabled) {
            handleSynchronizedMediaBroadcast(data);
        }
    };

    // 동기화된 미디어 브로드캐스트 처리
    const handleSynchronizedMediaBroadcast = (data) => {
        try {
            console.log('📡 동기화된 미디어 브로드캐스트 수신:', {
                sync_id: data.sync_id?.substring(0, 8),
                text_length: data.content?.text?.length,
                emotion: data.content?.emotion
            });

            // 디버그 정보 업데이트
            setSyncDebugInfo(prev => ({
                ...prev,
                isPlaying: true,
                sync_id: data.sync_id,
                sync_status: 'broadcasting',
                active_broadcasts: prev.active_broadcasts + 1,
                network_latency: (Date.now() / 1000) - data.server_timestamp
            }));

            // MediaSyncController로 처리 위임
            if (syncMediaPlayerRef.current) {
                syncMediaPlayerRef.current.handleSynchronizedMedia(data);
            } else {
                console.warn('⚠️ MediaSyncController가 초기화되지 않음');
            }

            // 스트리밍 텍스트 표시 (자막)
            if (data.content?.text) {
                console.log('📝 스트리밍 텍스트 표시 시작:', data.content.text.substring(0, 50) + '...');
                
                // 자막 표시
                setCurrentSubtitle(data.content.text);
                setRevealedSubtitle('');
                setShowSubtitle(true);
                
                // 스트리밍 효과로 자막 표시
                const streamText = data.content.text;
                const chunkSize = Math.max(1, ttsSettings.chunkSize || 3);
                const streamingDelay = Math.max(10, ttsSettings.streamingDelay || 50);
                
                let currentIndex = 0;
                const streamInterval = setInterval(() => {
                    if (currentIndex < streamText.length) {
                        const nextChunk = streamText.slice(0, currentIndex + chunkSize);
                        setRevealedSubtitle(nextChunk);
                        currentIndex += chunkSize;
                    } else {
                        clearInterval(streamInterval);
                        console.log('✅ 스트리밍 텍스트 표시 완료');
                    }
                }, streamingDelay);

                // 채팅에 AI 메시지 표시 (디버그 정보)
                setDebugInfo(prev => ({
                    ...prev,
                    syncMode: 'broadcasting',
                    ttsEngine: data.content?.tts_info?.engine || 'elevenlabs',
                    audioDuration: data.content.audio_duration || 0,
                    totalChars: data.content.text.length,
                    isPlaying: true,
                    voiceSettings: data.metadata?.voice_settings || {},
                    requestedEngine: data.metadata?.voice_settings?.ttsEngine || 'elevenlabs'
                }));
            }

        } catch (error) {
            console.error('❌ 동기화된 미디어 처리 실패:', error);
        }
    };

    // AI 메시지 처리 - Broadcasting 시스템에서 자동 처리됨
    const handleAIMessage = async (message, audioDuration, audioElement, ttsInfo = {}) => {
        // 새로운 Broadcasting 시스템에서는 WebSocket을 통해 자동으로 처리되므로
        // 별도 처리 불필요. 로그만 기록
        console.log('📝 AI 메시지 (Broadcasting 시스템에서 처리됨):', message.substring(0, 50) + '...');
        
        // 기존 호환성을 위한 최소한의 처리
        if (!isBroadcastingEnabled) {
            console.warn('⚠️ Broadcasting 비활성화 - Legacy 처리로 폴백');
            handleAIMessageLegacy(message, audioDuration, audioElement, ttsInfo);
        }
    };

    // Legacy 폴백 처리 (Broadcasting 비활성화 시만 사용)
    const handleAIMessageLegacy = (message, audioDuration, audioElement, ttsInfo = {}) => {
        console.warn('🔄 Legacy AI 처리 시스템 사용 (Broadcasting 비활성화됨)');
        
        setCurrentSubtitle(message);
        setRevealedSubtitle('');
        setShowSubtitle(true);
        
        // 간단한 디버그 정보만 설정
        setDebugInfo(prev => ({
            ...prev,
            isPlaying: true,
            totalChars: message.length,
            syncMode: 'legacy_fallback',
            ttsEngine: 'legacy'
        }));
        
        // 기본 텍스트 표시 - Broadcasting 시스템에서 Backend로 이동됨
        // if (textSyncServiceRef.current) {
        //     textSyncServiceRef.current.startDelayedReveal(message, () => {
        //         setTimeout(() => {
        //             setShowSubtitle(false);
        //             setRevealedSubtitle('');
        //             setDebugInfo(prev => ({ ...prev, syncMode: 'none', isPlaying: false }));
        //         }, 3000);
        //     });
        // }
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
                                    <TTSConfigManager 
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
                                        {/* AITTSEngineSelector는 Broadcasting 시스템에서 Backend로 이동됨 */}
                                        {/* <AITTSEngineSelector
                                            currentEngine={ttsSettings.ttsEngine}
                                            settings={ttsSettings}
                                            onEngineChange={(engine) => handleTtsSettingChange('ttsEngine', engine)}
                                            onSettingChange={handleTtsSettingChange}
                                            ttsManager={ttsManagerRef.current}
                                        /> */}
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
                                        debugInfo.syncMode === 'broadcasting' ? 'bg-primary' :
                                        debugInfo.syncMode === 'audio-sync' ? 'bg-success' : 
                                        debugInfo.syncMode === 'delay-sync' ? 'bg-warning' :
                                        debugInfo.syncMode === 'completed' ? 'bg-info' :
                                        debugInfo.syncMode === 'legacy_fallback' ? 'bg-warning' : 'bg-secondary'
                                    }`}>
                                        {debugInfo.syncMode === 'broadcasting' ? '📡 Broadcasting' : 
                                         debugInfo.syncMode === 'legacy_fallback' ? '🔄 Legacy' : 
                                         debugInfo.syncMode}
                                    </span>
                                    {isBroadcastingEnabled && (
                                        <span className="badge bg-success ms-1" title="Broadcasting 시스템 활성화됨">
                                            📡
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

                            {/* 비디오 디버그 정보 */}
                            <div className="mt-3 p-2 bg-dark bg-opacity-75 rounded">
                                <h6 className="text-warning mb-2">🎥 비디오 상태</h6>
                                <div className="row g-1 small">
                                    <div className="col-12">
                                        <strong>현재 비디오:</strong> 
                                        <span className="badge bg-warning text-dark ms-2">{currentVideo}</span>
                                    </div>
                                    <div className="col-6">
                                        <strong>비디오 전환:</strong> 
                                        <span className={`badge ms-2 ${videoTransitionRef.current ? 'bg-success' : 'bg-secondary'}`}>
                                            {videoTransitionRef.current ? '활성' : '비활성'}
                                        </span>
                                    </div>
                                    <div className="col-6">
                                        <strong>자막 표시:</strong> 
                                        <span className={`badge ms-2 ${showSubtitle ? 'bg-success' : 'bg-secondary'}`}>
                                            {showSubtitle ? '표시 중' : '숨김'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Broadcasting 시스템 디버그 정보 */}
                            {isBroadcastingEnabled && (
                                <div className="mt-3 p-2 bg-primary bg-opacity-10 rounded">
                                    <h6 className="text-primary mb-2">📡 Broadcasting 상태</h6>
                                    <div className="row g-1 small">
                                        <div className="col-6">
                                            <strong>Sync ID:</strong>
                                            <span className="ms-2 font-monospace" style={{ fontSize: '0.7rem' }}>
                                                {syncDebugInfo.sync_id ? syncDebugInfo.sync_id.substring(0, 8) + '...' : 'N/A'}
                                            </span>
                                        </div>
                                        <div className="col-6">
                                            <strong>네트워크 지연:</strong>
                                            <span className={`badge ms-2 ${
                                                syncDebugInfo.network_latency < 0.1 ? 'bg-success' :
                                                syncDebugInfo.network_latency < 0.3 ? 'bg-warning' : 'bg-danger'
                                            }`}>
                                                {(syncDebugInfo.network_latency * 1000).toFixed(0)}ms
                                            </span>
                                        </div>
                                        <div className="col-6">
                                            <strong>Sync 상태:</strong>
                                            <span className={`badge ms-2 ${
                                                syncDebugInfo.sync_status === 'broadcasting' ? 'bg-primary' :
                                                syncDebugInfo.sync_status === 'idle' ? 'bg-secondary' :
                                                syncDebugInfo.sync_status === 'error' ? 'bg-danger' : 'bg-info'
                                            }`}>
                                                {syncDebugInfo.sync_status}
                                            </span>
                                        </div>
                                        <div className="col-6">
                                            <strong>활성 브로드캐스트:</strong>
                                            <span className="badge bg-info ms-2">{syncDebugInfo.active_broadcasts}</span>
                                        </div>
                                        <div className="col-12">
                                            <strong>캐릭터:</strong>
                                            <span className="badge bg-warning text-dark ms-2">{streamerId}</span>
                                            <small className="ms-2 text-muted">
                                                (JSON 기반 비디오 관리)
                                            </small>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Legacy 오케스트레이터 디버그 정보 */}
                            {/* 오케스트레이터 상태는 Broadcasting 시스템에서 제거됨 */}
                            {/* {!isBroadcastingEnabled && (
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
                            )} */}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <Row>
                <Col md={8}>
                    <div className="video-player-wrapper" ref={videoContainerRef}>
                        {/* 비디오 플레이어 (간단한 전환) */}
                        <VideoPlayer
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
                            {/* 오케스트레이터 관련 기능은 Broadcasting 시스템에서 제거됨 */}
                            {/* {isOrchestratorEnabled && (
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
                            )} */}
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
                                <StreamingChatClient 
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