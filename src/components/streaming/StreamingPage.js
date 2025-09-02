import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Row, Col, Image, Button } from 'react-bootstrap';
import { StreamingChatClient } from './StreamingChatClient';
import VideoControlPanel from './VideoControlPanel';
import VideoPlayer from './VideoPlayer';
import SettingsPanel from './SettingsPanel';
import QueueWorkflowPanel from './QueueWorkflowPanel';
import DonationIsland from './DonationIsland';
import { MediaSyncController } from '../../services/MediaSyncController';
import { processTextForDisplay, debugVoiceTags } from '../../utils/textUtils';
import donationTTSService from '../../services/donationTTSService';
import { getDefaultIdleVideo } from '../../utils/videoConfig';
// Hot Reload 테스트 주석 - 2025.08.26 - 최종 수정!
import styles from './StreamingPage.module.css';

// Backend에서 TTS 설정 관리, fallback 기본값만 정의
const DEFAULT_SETTINGS = {
    streamingDelay: 50,
    ttsDelay: 500,
    chunkSize: 3,
    syncMode: 'after_complete',
    autoPlay: true,
    ttsEngine: 'elevenlabs'
};

// 캐릭터별 기본 idle 비디오 매핑 - utils/videoConfig.js로 이동됨

function StreamingPage({ isLoggedIn, username }) {
    const { roomId } = useParams();
    const [chatRoom, setChatRoom] = useState(null);
    const [streamerId, setStreamerId] = useState(null);
    const audioRef = useRef(null);
    const videoContainerRef = useRef(null);
    const videoTransitionRef = useRef(null);
    
    // 현재 비디오 상태
    const [currentVideo, setCurrentVideo] = useState(null);
    
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

    // 🆕 Queue 시스템 상태 관리
    const [showQueuePanel, setShowQueuePanel] = useState(true);
    const [queueStatus, setQueueStatus] = useState(null);
    const [sessionInfo, setSessionInfo] = useState(null);
    const [detailedQueueInfo, setDetailedQueueInfo] = useState(null);
    
    // 후원 시스템 상태
    const [isDonationIslandOpen, setIsDonationIslandOpen] = useState(false);
    const [donationOverlay, setDonationOverlay] = useState({ visible: false, data: null });
    
    // 채팅방 정보 가져오기 (방 기준)
    useEffect(() => {
        const fetchChatRoom = async () => {
            try {
                const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
                const response = await fetch(`${apiBaseUrl}/api/chat/rooms/${roomId}/`);
                const data = await response.json();
                setChatRoom(data);
                
                // streamerId를 방 정보에서 파생하여 설정 (DB 연동: streamer 필드 사용)
                const derivedStreamerId = data?.streamer?.character_id || data?.influencer?.username || null;
                setStreamerId(derivedStreamerId);
            } catch (error) {
                console.error('Error fetching chat room:', error);
                setStreamerId(null);
            }
        };

        if (roomId) {
            fetchChatRoom();
        }
    }, [roomId]);

    // chatRoom 정보가 로딩된 후 기본 비디오 설정
    useEffect(() => {
        if (chatRoom?.streamer?.character_id && !currentVideo) {
            const characterId = chatRoom.streamer.character_id;
            // video_assets.json에서 동적으로 기본 비디오 가져오기
            const defaultVideo = getDefaultIdleVideo(characterId);
            setCurrentVideo(defaultVideo);
            console.log(`🎬 기본 비디오 설정 완료: ${defaultVideo} (character: ${characterId})`);
        }
    }, [chatRoom, currentVideo]);

    // 서버에서 TTS 설정 가져오기
    const fetchServerTtsSettings = useCallback(async () => {
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
    }, [streamerId, isLoggedIn]);

    // Broadcasting 시스템에서 TTS 설정 관리됨
    // const handleTtsSettingChange = (key, value) => { ... }

    // 서버 TTS 설정 로드
    useEffect(() => {
        if (isLoggedIn && streamerId) {
            fetchServerTtsSettings();
        }
    }, [isLoggedIn, streamerId, fetchServerTtsSettings]);

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
                    characterId: streamerId || "hongseohyun", // DB 연동: characterId 설정
                    onIdleReturn: (idle_video, sync_id) => {
                        // Idle 복귀 시 상태 업데이트 (DB 연동: 동적 경로 처리)
                        const videoSrc = idle_video.replace(/^\/videos\//, '');
                        setCurrentVideo(videoSrc);
                        console.log(`😐 Idle 복귀 완료: ${videoSrc}`);
                    },
                    onTalkStart: (talk_video, sync_id) => {
                        console.log(`🗣️ Talk 시작 요청 - 원본 경로: ${talk_video}, sync_id: ${sync_id}`);
                        // Talk 시작 시 상태 업데이트 (DB 연동: 동적 경로 처리)
                        const videoSrc = talk_video.replace(/^\/videos\//, '');
                        console.log(`🗣️ 변환된 경로: ${videoSrc}`);
                        setCurrentVideo(videoSrc);
                        console.log(`🗣️ Talk 시작 완료: ${videoSrc}`);
                    },
                    onPlaybackError: (sync_id, error) => {
                        console.error('❌ 재생 오류:', error);
                    }
                }
            );
            
            console.log('✅ MediaSyncController 초기화 완료 (DB 연동)', {
                characterId: streamerId || "hongseohyun"
            });
        }
    }, [videoTransitionRef, audioRef, streamerId]); // streamerId 의존성 추가
    
    // streamerId 변경 시 MediaSyncController의 characterId 업데이트
    useEffect(() => {
        if (syncMediaPlayerRef.current && streamerId) {
            syncMediaPlayerRef.current.updateCharacterId(streamerId);
        }
    }, [streamerId]);

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
        // 🆕 Queue 상태 업데이트 처리
        else if (data.type === 'queue_status_update' && data.session_info) {
            console.log('📊 Queue 상태 업데이트 수신:', data.session_info);
            setSessionInfo(data.session_info);
            setQueueStatus(data.session_info);
        }
        // 🆕 상세 Queue 디버그 정보 처리
        else if (data.type === 'queue_debug_update' && data.detailed_queue_info) {
            console.log('🔍 상세 Queue 정보 수신:', data.detailed_queue_info);
            console.log('🔍 Request Queue:', data.detailed_queue_info.request_queue);
            console.log('🔍 Response Queue:', data.detailed_queue_info.response_queue);
            setDetailedQueueInfo(data.detailed_queue_info);
        }
        // 🆕 후원 오버레이 처리
        else if (data.type === 'donation_overlay' && data.data) {
            console.log('💰 후원 오버레이 표시:', data.data);
            setDonationOverlay({ visible: true, data: data.data });
            
            // TTS가 활성화된 후원인 경우 음성으로 읽어주기
            if (data.data.tts_enabled !== false) {
                console.log('🎤 후원 TTS 재생 시작:', data.data);
                donationTTSService.playDonationTTS(data.data, {
                    voice: 'aneunjin', // 기본 음성: 안은진
                    model_id: 'eleven_multilingual_v2',
                    stability: 0.5,
                    similarity_boost: 0.8,
                    style: 0.0,
                    use_speaker_boost: true
                });
            }
        }
        // 새로운 동기화된 미디어 브로드캐스트 처리
        else if (data.type === 'synchronized_media' && isBroadcastingEnabled) {
            handleSynchronizedMediaBroadcast(data);
        }
        // 🆕 MediaPacket 처리
        else if (data.type === 'media_packet' && data.packet) {
            console.log('📦 MediaPacket 수신:', data.packet);
            console.log('📦 Tracks 정보:', data.packet.tracks?.map(track => ({
                kind: track.kind,
                codec: track.codec,
                payload_ref: track.payload_ref
            })));
            
            // 🆕 기존 오디오 재생 중단 (새 패킷 수신 시)
            if (audioRef.current && !audioRef.current.paused) {
                console.log('🔇 기존 오디오 재생 중단 (새 MediaPacket으로 인해)');
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
            
            // 🆕 MediaSyncController 재생 중단
            if (syncMediaPlayerRef.current && syncMediaPlayerRef.current.abort) {
                console.log('🚫 MediaSyncController 재생 중단');
                syncMediaPlayerRef.current.abort();
            }
            
            // 🆕 진행 중인 자막 타이머 정리
            if (subtitleTimeoutRef.current) {
                clearTimeout(subtitleTimeoutRef.current);
                subtitleTimeoutRef.current = null;
            }
            
            // MediaPacket을 synchronized_media 형태로 변환하여 처리
            const packet = data.packet;
            
            // 텍스트 트랙 찾기 (kind 필드 사용)
            const textTrack = packet.tracks?.find(track => track.kind === 'subtitle');
            
            // 오디오 트랙 찾기  
            const audioTrack = packet.tracks?.find(track => track.kind === 'audio');
            
            // 비디오 트랙 찾기
            const videoTrack = packet.tracks?.find(track => track.kind === 'video');
            
            if (textTrack && isBroadcastingEnabled) {
                console.log('📦 MediaPacket에서 텍스트 처리:', textTrack);
                
                // textTrack의 payload_ref에서 자막 데이터 추출
                let subtitleData;
                try {
                    subtitleData = JSON.parse(textTrack.payload_ref);
                } catch (e) {
                    console.error('❌ 자막 데이터 파싱 실패:', e);
                    subtitleData = { text: textTrack.payload_ref }; // fallback
                }
                
                console.log('📝 추출된 자막 데이터:', subtitleData);
                
                // 자막 데이터에서 실제 텍스트 추출
                let displayText = '';
                if (subtitleData.segments && Array.isArray(subtitleData.segments)) {
                    displayText = subtitleData.segments.map(segment => segment.word || segment.text || '').join(' ');
                } else if (subtitleData.text) {
                    displayText = subtitleData.text;
                } else if (subtitleData.full_text) {
                    displayText = subtitleData.full_text;
                } else {
                    displayText = textTrack.payload_ref; // fallback
                }
                
                console.log('🔤 최종 추출된 텍스트:', displayText);
                console.log('🎵 오디오 트랙 정보:', audioTrack);
                console.log('🎵 오디오 duration 계산:', {
                    dur: audioTrack?.dur,
                    dur_ms: audioTrack?.dur_ms,
                    calculated: audioTrack ? (audioTrack.dur || audioTrack.dur_ms || 0) / 1000 : 0
                });
                console.log('🎬 비디오 트랙 정보:', videoTrack);
                
                // synchronized_media 형태로 변환
                const convertedData = {
                    type: 'synchronized_media',
                    content: {
                        text: displayText,
                        emotion: videoTrack?.meta?.emotion || 'happy', // 기본값 설정
                        audio_url: audioTrack?.payload_ref,
                        audio_duration: audioTrack ? (audioTrack.dur || audioTrack.dur_ms || 0) / 1000 : 0,
                        tts_info: audioTrack?.meta || { provider: 'queue_system' },
                        talk_video: videoTrack?.payload_ref || null,
                        idle_video: chatRoom?.streamer?.character_id ? 
                            `/videos/${chatRoom.streamer.character_id}/${getDefaultIdleVideo(chatRoom.streamer.character_id)}` :
                            `/videos/hongseohyun/hongseohyun_idle_2.mp4` // 기본 idle 비디오
                    },
                    sync_id: packet.sync_id,
                    sequence_number: packet.sequence_number,
                    timestamp: packet.timestamp
                };
                
                console.log('🔄 MediaPacket → synchronized_media 변환:', convertedData);
                console.log('🎬 Talk Video 경로:', convertedData.content?.talk_video);
                
                // 기존 동기화된 미디어 브로드캐스트 핸들러로 처리
                handleSynchronizedMediaBroadcast(convertedData);
            } else {
                console.log('⚠️  MediaPacket 처리 건너뜀:', {
                    hasTextTrack: !!textTrack,
                    isBroadcastingEnabled: isBroadcastingEnabled,
                    tracks: packet.tracks?.map(t => ({ kind: t.kind, codec: t.codec, pts: t.pts, dur: t.dur }))
                });
            }
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
    
    // 후원 오버레이 자동 종료 타이머
    useEffect(() => {
        if (!donationOverlay.visible) return;
        const timer = setTimeout(() => {
            setDonationOverlay({ visible: false, data: null });
        }, 5000);
        return () => clearTimeout(timer);
    }, [donationOverlay.visible]);


    // streamInfo 미사용으로 제거

    return (
        <Container fluid className={`${styles['streaming-container']} mt-4`}>
            
            {/* 후원 아일랜드 */}
            {isDonationIslandOpen && chatRoom && (
                <DonationIsland 
                    roomId={chatRoom.id} 
                    streamerId={streamerId} 
                    onClose={() => setIsDonationIslandOpen(false)} 
                />
            )}
            
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
                // 🆕 Queue 상태 정보 전달
                queueStatus={queueStatus}
                sessionInfo={sessionInfo}
                detailedQueueInfo={detailedQueueInfo}
            />

            {/* 🆕 Queue Workflow Panel - 통합 Queue 모니터 */}
            <QueueWorkflowPanel 
                detailedQueueInfo={detailedQueueInfo}
                queueStatus={queueStatus}
                sessionInfo={sessionInfo}
                isVisible={showQueuePanel}
                onToggle={() => setShowQueuePanel(false)}
            />

            <Row>
                <Col md={8}>
                    <div className={styles['video-player-wrapper']} ref={videoContainerRef} style={{ position: 'relative' }}>
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
                            <Button 
                                variant={showQueuePanel ? "success" : "outline-light"}
                                size="sm" 
                                onClick={() => setShowQueuePanel(!showQueuePanel)}
                                title="Queue 시스템 패널 토글"
                                style={{
                                    backgroundColor: showQueuePanel ? '#198754' : 'rgba(0,0,0,0.6)',
                                    border: showQueuePanel ? '1px solid #198754' : '1px solid rgba(255,255,255,0.3)',
                                    color: 'white'
                                }}
                            >
                                📋
                            </Button>
                        </div>

                        {/* 비디오 플레이어 (간단한 전환) - DB 연동: characterId 전달 */}
                        <VideoPlayer
                            ref={videoTransitionRef}
                            currentVideo={currentVideo}
                            onVideoLoaded={handleVideoLoaded}
                            className="streaming-video-container"
                            donationOverlay={donationOverlay}
                            characterId={streamerId || "hongseohyun"}
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
                            <div className={styles['ai-subtitle']}>
                                <div className={styles['subtitle-background']}>
                                    <span className={styles['subtitle-text']}>{revealedSubtitle}</span>
                                </div>
                            </div>
                        )}
                        <div className={styles['video-controls']}>
                            <Button 
                                variant="secondary" 
                                size="sm" 
                                onClick={handleMuteToggle}
                                style={{
                                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                    border: '1px solid rgba(255, 255, 255, 0.3)',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    minWidth: '60px'
                                }}
                            >
                                {isMuted ? '🔇' : '🔊'}
                            </Button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '120px' }}>
                                <span style={{ color: 'white', fontSize: '12px', minWidth: '30px' }}>
                                    {Math.round(volume * 100)}%
                                </span>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="1" 
                                    step="0.01" 
                                    value={volume} 
                                    onChange={handleVolumeChange} 
                                    className="volume-slider" 
                                    style={{
                                        width: '80px',
                                        height: '6px',
                                        borderRadius: '3px',
                                        background: 'rgba(255, 255, 255, 0.3)',
                                        outline: 'none',
                                        cursor: 'pointer'
                                    }}
                                />
                            </div>
                            <div style={{ flex: 1 }}></div>
                            <Button 
                                variant="secondary" 
                                size="sm" 
                                onClick={handleFullscreen}
                                style={{
                                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                    border: '1px solid rgba(255, 255, 255, 0.3)',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    minWidth: '80px'
                                }}
                            >
                                ⛶ 전체화면
                            </Button>
                        </div>
                        
                        {/* 비디오 제어 패널 */}
                        <VideoControlPanel 
                            onVideoChange={handleVideoChange} 
                            characterId={streamerId || "hongseohyun"} 
                        />
                    </div>
                    <div className="stream-info mt-3">
                        <h3>{chatRoom?.name || '스트림'}</h3>
                        <div className="d-flex justify-content-between align-items-center text-muted">
                            <span>시청자 수: 0명</span>
                            <span>방송 시작: {chatRoom?.created_at ? new Date(chatRoom.created_at).toLocaleString('ko-KR') : '-'}</span>
                        </div>
                        <hr />
                        <div className="d-flex align-items-center my-3">
                            {(() => {
                                const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
                                const imageUrl = chatRoom?.streamer?.display_name
                                    ? `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(`
                                        <svg width="50" height="50" xmlns="http://www.w3.org/2000/svg">
                                            <circle cx="25" cy="25" r="24" fill="#e3f2fd" stroke="#1976d2" stroke-width="1"/>
                                            <text x="50%" y="55%" font-family="Arial" font-size="12" fill="#1976d2" text-anchor="middle" dominant-baseline="middle">${chatRoom.streamer.display_name.charAt(0)}</text>
                                        </svg>
                                    `)))}`
                                    : `data:image/svg+xml;base64,${btoa(`
                                        <svg width="50" height="50" xmlns="http://www.w3.org/2000/svg">
                                            <circle cx="25" cy="25" r="24" fill="#f0f0f0" stroke="#ccc" stroke-width="1"/>
                                            <text x="50%" y="55%" font-family="Arial" font-size="12" fill="#999" text-anchor="middle" dominant-baseline="middle">?</text>
                                        </svg>
                                    `)}`;
                                return <Image src={imageUrl} roundedCircle />;
                            })()}
                            <div className="ms-3">
                                <h5 className="mb-0">{chatRoom?.streamer?.display_name || chatRoom?.host?.username || '-'}</h5>
                                <p className="mb-0">{chatRoom?.description || ''}</p>
                            </div>
                        </div>
                    </div>
                </Col>
                <Col md={4}>
                    <div className={`${styles['chat-section-wrapper']} d-flex flex-column h-100`}>
                        {/* 채팅 컨테이너 - 대부분의 공간 사용, 입력창 포함 */}
                        <div className={`${styles['chat-container-with-input']} flex-grow-1 d-flex flex-column`}>
                            {streamerId ? (
                                <StreamingChatClient 
                                        streamerId={streamerId}
                                        roomId={roomId}
                                        isLoggedIn={isLoggedIn}
                                        username={username}
                                        onAIMessage={handleAIMessage}
                                        onWebSocketMessage={handleWebSocketMessage}
                                        onAudioProgress={handleAudioProgressUpdate}
                                        onOpenDonation={() => setIsDonationIslandOpen(true)}
                                        onDonation={(d) => setDonationOverlay({ visible: true, data: d })}
                                    />
                            ) : (
                                <div className="text-center text-muted p-4">
                                    <p>채팅을 불러오는 중...</p>
                                </div>
                            )}
                        </div>
                        

                    </div>
                </Col>
            </Row>
            
            {/* 숨겨진 오디오 요소 - TTS 재생용 */}
            <audio
                ref={audioRef}
                style={{ display: 'none' }}
                controls={false}
                preload="auto"
            />
        </Container>
    );
}

export default StreamingPage;