import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Row, Col, Image, Button, Badge } from 'react-bootstrap';
import StreamingChatClient from './StreamingChatClient';
import VideoControlPanel from './VideoControlPanel';
import VideoPlayer from './VideoPlayer';
import SettingsPanel from './SettingsPanel';
import { MediaSyncController } from '../../services/MediaSyncController';
import { processTextForDisplay, debugVoiceTags } from '../../utils/textUtils';
// Hot Reload 테스트 주석 - 2025.08.26 - 최종 수정!
import './StreamingPage.css';

// Backend에서 TTS 설정 관리, fallback 기본값만 정의
const DEFAULT_SETTINGS = {
    streamingDelay: 50,
    ttsDelay: 500,
    chunkSize: 3,
    syncMode: 'after_complete',
    autoPlay: true,
    ttsEngine: 'elevenlabs'
};

function StreamingPage({ isLoggedIn, username }) {
    const { streamerId } = useParams();
    const audioRef = useRef(null);
    const videoContainerRef = useRef(null);
    const videoTransitionRef = useRef(null);
    
    // 현재 비디오 상태
    const [currentVideo, setCurrentVideo] = useState('a_idle_0.mp4');
    
    // 자막 상태 추가
    // const [currentSubtitle, setCurrentSubtitle] = useState(''); // Broadcasting 시스템에서 관리
    const [revealedSubtitle, setRevealedSubtitle] = useState('');
    const [showSubtitle, setShowSubtitle] = useState(false);
    const subtitleTimeoutRef = useRef(null);
    // 텍스트 동기화는 Broadcasting 시스템에서 Backend로 이동됨
    
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
    const [showSettingsManager, setShowSettingsManager] = useState(false);
    
    // 서버 TTS 설정 상태 추가
    const [serverTtsSettings, setServerTtsSettings] = useState(null);
    const [isServerSettingsLoaded, setIsServerSettingsLoaded] = useState(false);

    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(0.8);

    // 새로운 Broadcasting 시스템 관련 상태 추가
    const syncMediaPlayerRef = useRef(null);
    const [isBroadcastingEnabled] = useState(true); // 기본적으로 활성화 (변경하지 않음)
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

    // Broadcasting 시스템에서 TTS 설정 관리됨
    // const handleTtsSettingChange = (key, value) => { ... }

    // 서버 TTS 설정 로드
    useEffect(() => {
        if (isLoggedIn && streamerId) {
            fetchServerTtsSettings();
        }
    }, [isLoggedIn, streamerId]);

    // 컴포넌트 언마운트 시 타이머 정리
    useEffect(() => {
        return () => {
            if (subtitleTimeoutRef.current) {
                clearTimeout(subtitleTimeoutRef.current);
                console.log('🧹 자막 타이머 cleanup 완료');
            }
        };
    }, []);

    // TTS 관리는 Broadcasting 시스템으로 대체됨

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

    // 동기화 모드별 자막 처리 함수
    const handleSubtitleSync = (streamText, syncMode, data) => {
        const chunkSize = Math.max(1, ttsSettings.chunkSize || 3);
        const streamingDelay = Math.max(10, ttsSettings.streamingDelay || 50);
        const audioDuration = data.content?.audio_duration || 0;

        switch (syncMode) {
            case 'real_time':
                handleRealTimeSync(streamText, chunkSize, streamingDelay, audioDuration);
                break;
            case 'chunked':
                handleChunkedSync(streamText, chunkSize, streamingDelay, audioDuration);
                break;
            case 'after_complete':
            default:
                handleAfterCompleteSync(streamText, chunkSize, streamingDelay, audioDuration);
                break;
        }
    };

    // After Complete 모드: 텍스트 스트리밍 완료 후 오디오 재생
    const handleAfterCompleteSync = (streamText, chunkSize, streamingDelay, audioDuration) => {
        console.log('📋 After Complete 모드 실행');
        
        let currentIndex = 0;
        const streamInterval = setInterval(() => {
            if (currentIndex < streamText.length) {
                const nextChunk = streamText.slice(0, currentIndex + chunkSize);
                setRevealedSubtitle(nextChunk);
                
                // 텍스트 진행률 업데이트
                const textProgress = (nextChunk.length / streamText.length) * 100;
                setDebugInfo(prev => ({
                    ...prev,
                    revealedChars: nextChunk.length,
                    textProgress: textProgress
                }));
                
                currentIndex += chunkSize;
            } else {
                clearInterval(streamInterval);
                console.log('✅ 텍스트 스트리밍 완료 (After Complete 모드)');
                
                // 텍스트 완료 상태 업데이트
                setDebugInfo(prev => ({
                    ...prev,
                    revealedChars: streamText.length,
                    textProgress: 100
                }));
                
                // 수정된 타이밍 계산: 더 안전한 지연시간 사용
                const textStreamingTime = (streamText.length / chunkSize) * streamingDelay;
                
                // 오디오 재생 시간을 더 여유있게 계산 (최소 3초 보장)
                const totalAudioTime = Math.max(audioDuration * 1000, 3000); // 최소 3초
                const safeHideDelay = Math.max(totalAudioTime - textStreamingTime, 2000) + 2000; // 최소 2초 대기 + 2초 여유
                
                console.log('📊 After Complete 개선된 타이밍:', {
                    audioDuration: audioDuration + 's',
                    textStreamingTime: textStreamingTime + 'ms',
                    totalAudioTime: totalAudioTime + 'ms',
                    safeHideDelay: safeHideDelay + 'ms'
                });
                
                // 자막을 오디오 재생 완료 후 충분히 유지
                subtitleTimeoutRef.current = setTimeout(() => {
                    setShowSubtitle(false);
                    setRevealedSubtitle('');
                    // setCurrentSubtitle(''); // Broadcasting 시스템에서 관리
                    
                    // 디버그 정보 초기화
                    setDebugInfo(prev => ({
                        ...prev,
                        isPlaying: false,
                        currentTime: 0,
                        textProgress: 0,
                        revealedChars: 0
                    }));
                    
                    console.log('🙈 자막 숨김 (After Complete 안전 완료)');
                }, safeHideDelay);
            }
        }, streamingDelay);
    };

    // Real Time 모드: 텍스트와 오디오 동시 시작
    const handleRealTimeSync = (streamText, chunkSize, streamingDelay, audioDuration) => {
        console.log('⚡ Real Time 모드 실행');
        
        // 텍스트 스트리밍과 오디오가 거의 동시에 완료되도록 조정
        const totalTextTime = (streamText.length / chunkSize) * streamingDelay;
        const audioTimeMs = audioDuration * 1000;
        
        // 오디오 길이에 맞춰 텍스트 스트리밍 속도 조정
        const adjustedDelay = audioTimeMs > totalTextTime 
            ? Math.floor(audioTimeMs / (streamText.length / chunkSize)) 
            : streamingDelay;
            
        console.log('📊 Real Time 속도 조정:', {
            originalDelay: streamingDelay + 'ms',
            adjustedDelay: adjustedDelay + 'ms',
            audioTime: audioTimeMs + 'ms',
            estimatedTextTime: (streamText.length / chunkSize) * adjustedDelay + 'ms'
        });
        
        let currentIndex = 0;
        const streamInterval = setInterval(() => {
            if (currentIndex < streamText.length) {
                const nextChunk = streamText.slice(0, currentIndex + chunkSize);
                setRevealedSubtitle(nextChunk);
                
                // 텍스트 진행률 업데이트
                const textProgress = (nextChunk.length / streamText.length) * 100;
                setDebugInfo(prev => ({
                    ...prev,
                    revealedChars: nextChunk.length,
                    textProgress: textProgress
                }));
                
                currentIndex += chunkSize;
            } else {
                clearInterval(streamInterval);
                console.log('✅ 텍스트 스트리밍 완료 (Real Time 모드)');
                
                // 텍스트 완료 상태 업데이트
                setDebugInfo(prev => ({
                    ...prev,
                    revealedChars: streamText.length,
                    textProgress: 100
                }));
                
                // 오디오 완료 1초 후 자막 숨김
                subtitleTimeoutRef.current = setTimeout(() => {
                    setShowSubtitle(false);
                    setRevealedSubtitle('');
                    // setCurrentSubtitle(''); // Broadcasting 시스템에서 관리
                    
                    // 디버그 정보 초기화
                    setDebugInfo(prev => ({
                        ...prev,
                        isPlaying: false,
                        currentTime: 0,
                        textProgress: 0,
                        revealedChars: 0
                    }));
                    
                    console.log('🙈 자막 숨김 (Real Time 완료)');
                }, 1000);
            }
        }, adjustedDelay);
    };

    // Chunked 모드: 텍스트를 문장별로 나누어 순차 처리
    const handleChunkedSync = (streamText, chunkSize, streamingDelay, audioDuration) => {
        console.log('📦 Chunked 모드 실행');
        
        // 문장 단위로 텍스트 분할 (.!? 기준)
        const sentences = streamText.split(/(?<=[.!?])\s+/).filter(s => s.trim());
        const audioPerChunk = audioDuration / sentences.length; // 각 문장당 할당 시간
        
        console.log('📊 Chunked 분할:', {
            totalSentences: sentences.length,
            audioPerChunk: audioPerChunk + 's/문장',
            sentences: sentences.map(s => s.substring(0, 30) + '...')
        });
        
        let sentenceIndex = 0;
        
        const processSentence = () => {
            if (sentenceIndex >= sentences.length) {
                console.log('✅ 모든 청크 처리 완료 (Chunked 모드)');
                
                // 텍스트 완료 상태 업데이트
                setDebugInfo(prev => ({
                    ...prev,
                    revealedChars: streamText.length,
                    textProgress: 100
                }));
                
                // 마지막 문장 후 1초 뒤 자막 숨김
                subtitleTimeoutRef.current = setTimeout(() => {
                    setShowSubtitle(false);
                    setRevealedSubtitle('');
                    // setCurrentSubtitle(''); // Broadcasting 시스템에서 관리
                    
                    // 디버그 정보 초기화
                    setDebugInfo(prev => ({
                        ...prev,
                        isPlaying: false,
                        currentTime: 0,
                        textProgress: 0,
                        revealedChars: 0
                    }));
                    
                    console.log('🙈 자막 숨김 (Chunked 완료)');
                }, 1000);
                return;
            }
            
            const sentence = sentences[sentenceIndex];
            console.log(`📦 청크 ${sentenceIndex + 1}/${sentences.length}: ${sentence.substring(0, 30)}...`);
            
            // 현재 문장까지의 누적 텍스트 표시
            const accumulatedText = sentences.slice(0, sentenceIndex + 1).join(' ');
            setRevealedSubtitle(accumulatedText);
            
            // 텍스트 진행률 업데이트
            const textProgress = (accumulatedText.length / streamText.length) * 100;
            setDebugInfo(prev => ({
                ...prev,
                revealedChars: accumulatedText.length,
                textProgress: textProgress
            }));
            
            sentenceIndex++;
            
            // 다음 문장 처리를 위해 대기 (문장당 할당된 시간)
            setTimeout(processSentence, audioPerChunk * 1000);
        };
        
        // 첫 번째 문장부터 시작
        processSentence();
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

            // 스트리밍 텍스트 표시 (자막) - 동기화 모드별 처리
            if (data.content?.text) {
                const originalText = data.content.text;
                const currentTtsModel = data.metadata?.voice_settings?.elevenLabsModel || serverTtsSettings?.elevenLabsModel || '';
                const syncMode = data.metadata?.sync_mode || serverTtsSettings?.syncMode || 'after_complete';
                
                // 음성 태그 처리: 표시용 텍스트는 태그 제거
                const streamText = processTextForDisplay(originalText, currentTtsModel, false);
                
                // 디버그 로깅
                if (originalText !== streamText) {
                    debugVoiceTags(originalText);
                }
                
                console.log('📝 스트리밍 텍스트 표시 시작:', {
                    originalText: originalText.substring(0, 50) + '...',
                    displayText: streamText.substring(0, 50) + '...',
                    ttsModel: currentTtsModel,
                    syncMode: syncMode,
                    audioDuration: data.content.audio_duration + 's'
                });
                
                // 자막 표시 기본 설정 (음성 태그가 제거된 텍스트 사용)
                // setCurrentSubtitle(streamText); // Broadcasting 시스템에서 관리
                setRevealedSubtitle('');
                setShowSubtitle(true);
                
                // 기존 자막 타이머가 있으면 정리
                if (subtitleTimeoutRef.current) {
                    clearTimeout(subtitleTimeoutRef.current);
                }

                // 동기화 모드별 처리
                handleSubtitleSync(streamText, syncMode, data);

                // 채팅에 AI 메시지 표시 (디버그 정보)
                setDebugInfo(prev => ({
                    ...prev,
                    syncMode: syncMode,
                    ttsEngine: data.content?.tts_info?.engine || 'elevenlabs',
                    audioDuration: data.content.audio_duration || 0,
                    totalChars: streamText.length,
                    isPlaying: true,
                    voiceSettings: data.metadata?.voice_settings || {},
                    requestedEngine: data.metadata?.voice_settings?.ttsEngine || 'elevenlabs'
                }));
            }

        } catch (error) {
            console.error('❌ 동기화된 미디어 처리 실패:', error);
        }
    };

    // 오디오 재생 진행률 업데이트 핸들러
    const handleAudioProgressUpdate = (currentTime, duration, textProgress) => {
        setDebugInfo(prev => ({
            ...prev,
            currentTime: currentTime,
            audioDuration: duration,
            textProgress: textProgress,
            revealedChars: Math.floor((textProgress / 100) * prev.totalChars)
        }));
    };

    // AI 메시지 처리 - Broadcasting 시스템에서 자동 처리됨
    const handleAIMessage = async (message, audioDuration, audioElement, ttsInfo = {}) => {
        // Broadcasting 시스템에서 WebSocket을 통해 자동으로 처리됨
        console.log('📝 AI 메시지 (Broadcasting 시스템에서 처리됨):', message.substring(0, 50) + '...');
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
            {/* 통합 설정 패널 - 리팩토링된 SettingsPanel 컴포넌트 */}
            <SettingsPanel 
                showDebug={showDebug}
                showSettingsManager={showSettingsManager}
                setShowDebug={setShowDebug}
                setShowSettingsManager={setShowSettingsManager}
                debugInfo={debugInfo}
                syncDebugInfo={syncDebugInfo}
                revealedSubtitle={revealedSubtitle}
                currentVideo={currentVideo}
                videoTransitionRef={videoTransitionRef}
                showSubtitle={showSubtitle}
                streamerId={streamerId}
                isBroadcastingEnabled={isBroadcastingEnabled}
                isLoggedIn={isLoggedIn}
                username={username}
            />

            <Row>
                <Col md={8}>
                    <div className="video-player-wrapper" ref={videoContainerRef} style={{ position: 'relative' }}>
                        {/* 패널 토글 버튼 - 좌측 상단 고정 */}
                        <div 
                            className="panel-toggle-buttons"
                            style={{
                                position: 'absolute',
                                top: '10px',
                                left: '10px',
                                zIndex: 100,
                                display: 'flex',
                                gap: '8px'
                            }}
                        >
                            <Button 
                                variant={showDebug ? "info" : "outline-light"}
                                size="sm" 
                                onClick={() => setShowDebug(!showDebug)}
                                title="디버그 패널 토글"
                                style={{
                                    backgroundColor: showDebug ? '#0dcaf0' : 'rgba(0,0,0,0.6)',
                                    border: showDebug ? '1px solid #0dcaf0' : '1px solid rgba(255,255,255,0.3)',
                                    color: 'white'
                                }}
                            >
                                🔧
                            </Button>
                            <Button 
                                variant={showSettingsManager ? "warning" : "outline-light"}
                                size="sm" 
                                onClick={() => setShowSettingsManager(!showSettingsManager)}
                                title="TTS 설정 패널 토글"
                                style={{
                                    backgroundColor: showSettingsManager ? '#ffc107' : 'rgba(0,0,0,0.6)',
                                    border: showSettingsManager ? '1px solid #ffc107' : '1px solid rgba(255,255,255,0.3)',
                                    color: showSettingsManager ? 'black' : 'white'
                                }}
                            >
                                ⚙️
                            </Button>
                        </div>

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
                                    onAudioProgress={handleAudioProgressUpdate}
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