import React, { useState, useEffect, useRef } from 'react';
import { Form, Button } from 'react-bootstrap';
import { getValidToken } from '../../utils/tokenUtils';
// Broadcasting 시스템: Backend에서 TTS 설정 및 오디오 처리 관리
const DEFAULT_SETTINGS = {
    streamingDelay: 50,
    ttsDelay: 500,
    chunkSize: 3,
    syncMode: 'after_complete',
    autoPlay: true,
    ttsEngine: 'elevenlabs'
};

// Display name resolver – prefers nickname-like fields
const resolveDisplayName = (data) => {
    if (!data) return '';
    return (
        data.nickname ||
        data.sender_nickname ||
        data.user_nickname ||
        data.userNickname ||
        data.nick ||
        data.name ||
        data.display_name ||
        (data.sender && (data.sender.nickname || data.sender.display_name || data.sender.username)) ||
        (data.author && (data.author.nickname || data.author.display_name || data.author.username)) ||
        (data.user && (data.user.nickname || data.user.display_name || data.user.username)) ||
        data.sender_username ||
        data.user_name ||
        data.username ||
        (data.user && data.user.username) ||
        data.sender ||
        ''
    );
};

const StreamingChatWithTTS = ({ 
    streamerId, 
    isLoggedIn, 
    username, 
    onAIMessage,
    onWebSocketMessage,
    onAudioProgress,
    externalSettings,
    onSettingsChange,
    externalShowSettings,
    onShowSettingsChange,
    onOpenDonation
}) => {
    const [messages, setMessages] = useState([]);
    const MAX_MESSAGES = 100; // 최대 메시지 개수 제한
    const [inputValue, setInputValue] = useState('');
    const [connectionStatus, setConnectionStatus] = useState('연결 중...');
    const [isConnected, setIsConnected] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState(0);
    
    // TTS 관련 상태 - 확장된 설정
    const [audioEnabled, setAudioEnabled] = useState(true);
    // Broadcasting 시스템에서 오디오 재생 상태 관리됨
    const [volume, setVolume] = useState(0.8);
    // Broadcasting 시스템에서 설정 관리됨
    const settings = externalSettings || {
        ...DEFAULT_SETTINGS,
        autoPlay: true,
        ttsEngine: 'elevenlabs',
        elevenLabsVoice: 'aneunjin'
    };
    
    // 서버 설정 동기화 상태
    const [serverSettings, setServerSettings] = useState(null);
    const [isSettingsSynced, setIsSettingsSynced] = useState(false);
    
    const websocketRef = useRef(null);
    const chatContainerRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const maxReconnectAttempts = 5;
    const isConnectingRef = useRef(false);
    
    // 오디오 재생을 위한 참조
    const audioRef = useRef(null);

    // 메시지 추가 함수 (최대 개수 제한 포함)
    const addMessage = (newMessage) => {
        setMessages(prev => {
            const updatedMessages = [...prev, newMessage];
            // 최대 개수 초과 시 오래된 메시지 제거
            if (updatedMessages.length > MAX_MESSAGES) {
                return updatedMessages.slice(-MAX_MESSAGES);
            }
            return updatedMessages;
        });
    };

    // 음량 설정 초기화
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
    }, [settings.ttsEngine]);

    // 음량 변경 효과
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
    }, [volume]);

    // Broadcasting 시스템에서 TTS 설정 업데이트 관리됨
    // const updateServerTTSSettings = async (newSettings) => { ... }

    // Broadcasting 시스템에서 TTS 설정 업데이트 처리됨
    // const updateSetting = (key, value) => { ... }

    useEffect(() => {
        let connectTimeout = null;
        let cleanup = false;

        if (!streamerId) {
            return;
        }
        
        const cleanupConnections = () => {
            cleanup = true;
            
            if (connectTimeout) {
                clearTimeout(connectTimeout);
                connectTimeout = null;
            }
            
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }

            if (websocketRef.current && websocketRef.current.readyState !== WebSocket.CLOSED) {
                websocketRef.current.close();
                websocketRef.current = null;
            }
            
            isConnectingRef.current = false;
        };

        const connectWebSocket = async () => {
            if (!streamerId || !isLoggedIn) {
                return;
            }
            
            if (isConnectingRef.current) {
                return;
            }

            if (websocketRef.current && websocketRef.current.readyState === WebSocket.CONNECTING) {
                return;
            }
            
            if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
                return;
            }
            
            isConnectingRef.current = true;

            try {
                const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
                const wsBaseUrl = apiBaseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
                let wsUrl = `${wsBaseUrl}/ws/stream/${streamerId}/`;
                
                // 🆕 유효한 토큰 자동 갱신
                const token = await getValidToken();
                if (token) {
                    wsUrl += `?token=${token}`;
                } else if (isLoggedIn) {
                    console.warn('⚠️ 로그인 상태이지만 유효한 토큰을 가져올 수 없습니다. 다시 로그인해주세요.');
                    setConnectionStatus('토큰 만료 - 다시 로그인 필요');
                    return;
                }
                
                console.log('🔗 WebSocket 연결 시도:', wsUrl);
                console.log('📝 토큰 존재:', !!token);
                console.log('👤 로그인 상태:', isLoggedIn);
                console.log('🎯 스트리머 ID:', streamerId);
                
                websocketRef.current = new WebSocket(wsUrl);
                
                websocketRef.current.onopen = () => {
                    setIsConnected(true);
                    setConnectionStatus('연결됨');
                    reconnectAttemptsRef.current = 0;
                    isConnectingRef.current = false;
                };
                
                websocketRef.current.onmessage = async (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        console.log('📥 WebSocket 메시지 수신:', data);
                        console.log('📋 메시지 타입:', data.type);
                        
                        // 🔍 모든 메시지 타입 상세 로깅
                        if (data.type === 'media_packet') {
                            console.log('🎯 MEDIA_PACKET 수신!', data.packet);
                        } else if (data.type === 'synchronized_media') {
                            console.log('🎯 SYNCHRONIZED_MEDIA 수신!', data.content);
                        } else {
                            console.log('🔍 기타 메시지 타입:', data.type, data);
                        }
                        
                        // 🆕 Queue 메시지 전용 로깅
                        if (data.type === 'queue_status_update' || data.type === 'queue_debug_update') {
                            console.log('🎯 Queue 메시지 수신!', {
                                type: data.type,
                                session_info: data.session_info,
                                detailed_queue_info: data.detailed_queue_info,
                                timestamp: data.timestamp
                            });
                        }
                        
                        // WebSocket 메시지 타입별 처리
                        if (data.type === 'initial_tts_settings') {
                            // 초기 TTS 설정 수신
                            setServerSettings(data.settings);
                            setIsSettingsSynced(true);
                            
                            // 외부 설정을 서버 설정으로 동기화
                            if (onSettingsChange && data.settings) {
                                Object.keys(data.settings).forEach(key => {
                                    if (key !== 'streamer_id' && key !== 'lastUpdatedBy' && key !== 'updatedAt') {
                                        onSettingsChange(key, data.settings[key]);
                                    }
                                });
                            }
                            
                            // Broadcasting 시스템에서 TTS 설정 자동 동기화됨
                            return;
                        }
                        
                        if (data.type === 'tts_settings_changed') {
                            // TTS 설정 변경 브로드캐스트 수신
                            setServerSettings(data.settings);
                            
                            // 부모 컴포넌트에도 WebSocket 메시지 전달
                            if (onWebSocketMessage) {
                                onWebSocketMessage(data);
                            }
                            
                            // 외부 설정을 새로운 서버 설정으로 동기화
                            if (onSettingsChange && data.settings) {
                                Object.keys(data.settings).forEach(key => {
                                    if (key !== 'streamer_id' && key !== 'lastUpdatedBy' && key !== 'updatedAt') {
                                        onSettingsChange(key, data.settings[key]);
                                    }
                                });
                            }
                            
                            // Broadcasting 시스템에서 TTS 설정 자동 동기화됨
                            
                            // 설정 변경 알림 표시
                            if (data.changed_by && username !== data.changed_by) {
                                const alertMessage = {
                                    id: Date.now() + Math.random(),
                                    message: `${data.changed_by}님이 TTS 설정을 변경했습니다. (엔진: ${data.settings.ttsEngine}, 음성: ${data.settings.elevenLabsVoice})`,
                                    message_type: 'system',
                                    timestamp: Date.now()
                                };
                                addMessage(alertMessage);
                            }
                            return;
                        }
                        
                        // 🆕 Queue 시스템 메시지 처리
                        if (data.type === 'queue_status_update' || data.type === 'queue_debug_update' || data.type === 'media_packet') {
                            console.log(`📊 Queue 시스템 메시지 수신 (${data.type}):`, data);
                            
                            // 부모 컴포넌트로 전달 (StreamingPage에서 처리)
                            if (onWebSocketMessage) {
                                onWebSocketMessage(data);
                            }
                            return;
                        }
                        
                        // 🆕 후원 메시지 처리
                        if (data.type === 'donation_message') {
                            console.log('💰 후원 메시지 수신:', data);
                            
                            // 후원 메시지를 채팅에 표시
                            const donationMessage = {
                                id: Date.now() + Math.random(),
                                message: data.data.message || '',
                                message_type: 'donation',
                                sender: data.data.username,
                                sender_display: data.data.nickname || data.data.username,
                                timestamp: data.timestamp || Date.now(),
                                donation_amount: data.data.amount,
                                tts_enabled: data.data.tts_enabled
                            };
                            
                            addMessage(donationMessage);
                            
                            // 부모 컴포넌트로 후원 오버레이 데이터 전달
                            if (onWebSocketMessage) {
                                onWebSocketMessage({
                                    type: 'donation_overlay',
                                    data: data.data
                                });
                            }
                            
                            return;
                        }
                        
                        // synchronized_media 메시지 처리 (AI 응답 + TTS + 비디오)
                        if (data.type === 'synchronized_media') {
                            console.log('🎬 동기화된 미디어 수신:', data);
                            console.log('   텍스트:', data.content?.text);
                            console.log('   오디오 URL 타입:', data.content?.audio_url?.startsWith('data:') ? 'base64 data URL' : 'file URL');
                            console.log('   오디오 URL (처음 100자):', data.content?.audio_url?.substring(0, 100) + '...');
                            console.log('   TTS 정보:', data.content?.tts_info);
                            console.log('   오디오 길이:', data.content?.audio_duration);
                            
                            const aiMessage = {
                                id: Date.now() + Math.random(),
                                message: data.content.text,
                                message_type: 'ai',
                                sender: 'AI_Assistant',
                                timestamp: data.timestamp || Date.now(),
                                sync_id: data.sync_id,
                                audio_url: data.content.audio_url,
                                video_info: {
                                    talk_video: data.content.talk_video,
                                    idle_video: data.content.idle_video,
                                    emotion: data.content.emotion
                                },
                                sync_timing: data.sync_timing
                            };
                            
                            addMessage(aiMessage);
                            
                            // TTS 자동 재생 (서버에서 이미 생성된 오디오 사용)
                            if (audioEnabled && settings.autoPlay && data.content.audio_url) {
                                try {
                                    // 서버에서 생성된 오디오 URL 직접 재생
                                    const audioElement = new Audio(data.content.audio_url);
                                    audioElement.volume = volume;
                                    
                                    // setCurrentPlayingMessageId(aiMessage.id); // Broadcasting 시스템에서 관리
                                    // setIsPlayingAudio(true);
                                    
                                    // 실시간 진행률 업데이트를 위한 타이머
                                    let progressInterval = null;
                                    
                                    // 오디오 메타데이터 로드 완료 시
                                    audioElement.onloadedmetadata = () => {
                                        const duration = audioElement.duration;
                                        console.log('🎵 오디오 메타데이터 로드 완료:', duration + 's');
                                        
                                        // 진행률 업데이트 타이머 시작 (100ms 간격)
                                        progressInterval = setInterval(() => {
                                            if (!audioElement.paused && !audioElement.ended) {
                                                const currentTime = audioElement.currentTime;
                                                const progress = (currentTime / duration) * 100;
                                                
                                                // 부모 컴포넌트에 진행률 전달
                                                if (onAudioProgress) {
                                                    onAudioProgress(currentTime, duration, progress);
                                                }
                                            }
                                        }, 100);
                                    };
                                    
                                    audioElement.onended = () => {
                                        // setCurrentPlayingMessageId(null); // Broadcasting 시스템에서 관리
                                        // setIsPlayingAudio(false);
                                        
                                        // 진행률 업데이트 타이머 정리
                                        if (progressInterval) {
                                            clearInterval(progressInterval);
                                            progressInterval = null;
                                        }
                                        
                                        // 완료 상태로 마지막 업데이트
                                        if (onAudioProgress) {
                                            onAudioProgress(audioElement.duration, audioElement.duration, 100);
                                        }
                                    };
                                    
                                    audioElement.onerror = (error) => {
                                        console.error('❌ 오디오 재생 실패:', error);
                                        // setCurrentPlayingMessageId(null); // Broadcasting 시스템에서 관리
                                        // setIsPlayingAudio(false);
                                        
                                        // 진행률 업데이트 타이머 정리
                                        if (progressInterval) {
                                            clearInterval(progressInterval);
                                            progressInterval = null;
                                        }
                                    };
                                    
                                    await audioElement.play();
                                    
                                    console.log('✅ 서버 생성 오디오 재생 시작');
                                    
                                } catch (error) {
                                    console.error('❌ 서버 오디오 재생 오류:', error);
                                }
                            }
                            
                            // 부모 컴포넌트에 AI 메시지 전달 (비디오 동기화 등)
                            if (onAIMessage) {
                                onAIMessage(data.content.text, data.content.audio_duration || 0, null, {
                                    engine: 'elevenlabs',
                                    sync_id: data.sync_id,
                                    video_info: aiMessage.video_info,
                                    server_generated: true
                                });
                            }
                            
                            // 부모 컴포넌트에도 WebSocket 메시지 전달
                            if (onWebSocketMessage) {
                                onWebSocketMessage(data);
                            }
                            
                            return;
                        }
                        
                        // 일반 채팅 메시지 처리
                        const newMessage = {
                            id: Date.now() + Math.random(),
                            ...data,
                            // Normalize sender display to nickname
                            sender_display: resolveDisplayName(data),
                            sender_id: data.user_id || data.sender_id || null,
                            timestamp: data.timestamp || Date.now()
                        };
                        
                        addMessage(newMessage);
                        
                        // AI 메시지 처리
                        if (data.message_type === 'ai') {
                            // 서버에서 전송된 TTS 설정이 있으면 우선 사용
                            // let effectiveSettings = settings; // Broadcasting 시스템에서 관리
                            if (data.tts_settings) {
                                setServerSettings(data.tts_settings);
                                
                                // 즉시 로컬 설정에 반영
                                if (onSettingsChange) {
                                    Object.keys(data.tts_settings).forEach(key => {
                                        if (key !== 'streamer_id' && key !== 'lastUpdatedBy' && key !== 'updatedAt') {
                                            onSettingsChange(key, data.tts_settings[key]);
                                        }
                                    });
                                }
                                
                                // effectiveSettings = { ...settings, ...data.tts_settings }; // Broadcasting 시스템에서 관리
                                
                                // Broadcasting 시스템에서 서버 설정 자동 적용됨
                            }
                            
                            // TTS는 Broadcasting 시스템에서 서버가 자동 처리함
                            // 클라이언트에서는 메시지 표시만 처리
                            if (onAIMessage) {
                                onAIMessage(data.message, 0, null);
                            }
                        }
                        
                        if (data.online_users) {
                            setOnlineUsers(data.online_users);
                        }
                        
                    } catch (error) {
                        console.error('스트리밍 채팅 메시지 파싱 오류:', error);
                    }
                };
                
                websocketRef.current.onclose = (event) => {
                    setIsConnected(false);
                    isConnectingRef.current = false;
                    
                    if (event.code === 4001) {
                        setConnectionStatus('인증 실패');
                        addMessage({
                            id: Date.now(),
                            message: '인증에 실패했습니다. 로그인을 다시 시도해주세요.',
                            message_type: 'system',
                            timestamp: Date.now()
                        });
                    } else if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
                        setConnectionStatus(`재연결 시도 중... (${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
                        reconnectAttemptsRef.current++;
                        
                        reconnectTimeoutRef.current = setTimeout(() => {
                            connectWebSocket();
                        }, Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000));
                    } else {
                        setConnectionStatus('연결 끊김');
                    }
                };
                
                websocketRef.current.onerror = (error) => {
                    console.error('❌ WebSocket 연결 오류:', error);
                    console.error('❌ WebSocket URL:', wsUrl);
                    console.error('❌ 로그인 상태:', isLoggedIn);
                    console.error('❌ 토큰:', token ? 'exists' : 'missing');
                    setConnectionStatus('연결 오류');
                    isConnectingRef.current = false;
                };
                
            } catch (error) {
                setConnectionStatus('연결 실패');
                isConnectingRef.current = false;
            }
        };

        if (connectTimeout) {
            clearTimeout(connectTimeout);
            connectTimeout = null;
        }
        
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (websocketRef.current && websocketRef.current.readyState !== WebSocket.CLOSED) {
            websocketRef.current.close();
            websocketRef.current = null;
        }
        
        isConnectingRef.current = false;

        if (isLoggedIn && streamerId && !cleanup) {
            connectTimeout = setTimeout(() => {
                if (!cleanup && !websocketRef.current && !isConnectingRef.current) {
                    connectWebSocket();
                }
            }, 200);
        }
        
        if (!isLoggedIn) {
            setConnectionStatus('로그인이 필요합니다');
            setMessages([
                {
                    id: 'login-required',
                    message: '로그인 후 채팅에 참여할 수 있습니다.',
                    message_type: 'system',
                    timestamp: Date.now()
                }
            ]);
        }

        return () => {
            cleanupConnections();
        };
    }, [streamerId, isLoggedIn, username, audioEnabled]);

    // 자동 스크롤
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    // Legacy TTS 재생 함수 - 현재 Broadcasting 시스템에서 사용하지 않음
    // TTS는 서버에서 생성되어 WebSocket으로 전달됨


    const sendMessage = () => {
        if (!inputValue.trim() || !isConnected || !websocketRef.current) {
            return;
        }

        try {
            const messageText = inputValue.trim();
            const messageData = {
                message: messageText
            };

            websocketRef.current.send(JSON.stringify(messageData));
            setInputValue('');
            
        } catch (error) {
            console.error('스트리밍 채팅 메시지 전송 실패:', error);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const renderMessage = (msg) => {
        const messageTime = new Date(msg.timestamp).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // 시스템 메시지
        if (msg.message_type === 'system') {
            return (
                <div key={msg.id} className="chat-message system-message compact-message">
                    <span className="message-badge">📢</span>{' '}
                    <strong className="message-sender text-info">System</strong>{' '}
                    <span className="message-text text-info">{msg.message}</span>{' '}
                    <small className="message-time">[{messageTime}]</small>
                </div>
            );
        }

        // AI 응답 메시지
        if (msg.message_type === 'ai') {
            return (
                <div key={msg.id} className="chat-message ai-message compact-message">
                    <span className="message-badge">🤖</span>{' '}
                    <strong className="message-sender">AI</strong>{' '}
                    <span className="message-text">{msg.message}</span>{' '}
                    <small className="message-time">[{messageTime}]</small>
                </div>
            );
        }

        // 후원 메시지 (SuperChat 스타일)
        if (msg.message_type === 'donation') {
            const getDonationColor = (amount) => {
                if (amount >= 50000) return '#e91e63'; // 핑크 (5만원 이상)
                if (amount >= 20000) return '#ff9800'; // 오렌지 (2만원 이상) 
                if (amount >= 10000) return '#4caf50'; // 그린 (1만원 이상)
                if (amount >= 5000) return '#2196f3';  // 블루 (5천원 이상)
                return '#9c27b0'; // 퍼플 (기본)
            };

            const donationColor = getDonationColor(msg.donation_amount);
            
            return (
                <div key={msg.id} className="chat-message donation-message compact-message" 
                     style={{ 
                         backgroundColor: donationColor + '20',
                         border: `2px solid ${donationColor}`,
                         borderRadius: '8px',
                         margin: '8px 0',
                         padding: '12px'
                     }}>
                    <div className="donation-header" style={{ marginBottom: '4px' }}>
                        <span className="message-badge" style={{ fontSize: '1.2em' }}>💰</span>
                        <strong className="message-sender" style={{ color: donationColor, fontSize: '1.1em' }}>
                            {msg.sender}
                        </strong>
                        <span className="donation-amount badge ms-2" 
                              style={{ backgroundColor: donationColor, color: 'white', fontSize: '0.9em' }}>
                            {msg.donation_amount.toLocaleString()} 크레딧
                        </span>
                    </div>
                    {msg.message && (
                        <div className="donation-text" style={{ 
                            color: '#fff', 
                            fontWeight: 'bold',
                            backgroundColor: donationColor + '40',
                            padding: '6px 10px',
                            borderRadius: '4px',
                            marginTop: '6px'
                        }}>
                            "{msg.message}"
                        </div>
                    )}
                    <small className="message-time" style={{ color: donationColor, marginTop: '4px', display: 'block' }}>
                        [{messageTime}]
                    </small>
                </div>
            );
        }

        // 사용자 메시지
        const isMyMessage = (msg.username === username) || (msg.sender === username) || (msg.sender_display === username);
        
        return (
            <div key={msg.id} className={`chat-message user-message compact-message ${isMyMessage ? 'my-message' : ''}`}>
                <span className="message-badge">👤</span>{' '}
                <strong className={`message-sender ${isMyMessage ? 'text-success' : 'text-primary'}`}>
                    {msg.sender_display || msg.sender}
                </strong>{' '}
                <span className="message-text">{msg.message}</span>{' '}
                <small className="message-time">[{messageTime}]</small>
            </div>
        );
    };

    return (
        <div className="streaming-chat-container h-100 d-flex flex-column">
            {/* 오디오 엘리먼트 (숨김) */}
            <audio ref={audioRef} style={{ display: 'none' }} />
            
            {/* 채팅 헤더 */}
            <div className="chat-header p-2">
                <div className="d-flex justify-content-between align-items-center">
                    <div>
                        <small className="fw-bold" style={{ color: 'var(--color-text)' }}>💬 {streamerId} 채팅방</small>
                        {onlineUsers > 0 && (
                            <span className="ms-2" style={{ color: 'var(--color-text)', opacity: 0.7 }}>👥 {onlineUsers}명</span>
                        )}
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        
                        {/* 음량 컨트롤 */}
                        <div className="d-flex align-items-center">
                            <Button
                                variant="link"
                                size="sm"
                                className="text-decoration-none p-1"
                                onClick={() => setAudioEnabled(!audioEnabled)}
                                title={audioEnabled ? "음성 비활성화" : "음성 활성화"}
                            >
                                {audioEnabled ? '🔊' : '🔇'}
                            </Button>
                            {audioEnabled && (
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={volume}
                                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                                    className="ms-2"
                                    style={{ width: '80px' }}
                                    title={`음량: ${Math.round(volume * 100)}%`}
                                />
                            )}
                        </div>
                        <span className="connection-status" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid rgba(0,0,0,0.15)', borderRadius: '999px', padding: '2px 8px' }}>
                            {connectionStatus}
                        </span>
                    </div>
                </div>
            </div>

            {/* AI 사용법 안내 */}
            {isLoggedIn && (
                <div className="chat-help p-2">
                    <small style={{ color: 'var(--color-text)' }}>
                        <strong style={{ color: 'var(--brand)' }}>🤖 AI 어시스턴트 사용법:</strong><br/>
                        <code className="px-1 rounded" style={{ backgroundColor: 'rgba(0,0,0,0.08)', color: 'var(--color-text)', border: '1px solid rgba(0,0,0,0.15)' }}>@메시지</code> <span style={{ color: 'var(--color-text)' }}>- 스트리머 멘션으로 AI 호출</span>
                        {audioEnabled && <span className="ms-2" style={{ color: 'var(--color-text)', opacity: 0.85 }}>| 🔊 AI 음성 자동 재생 ({
                            settings.ttsEngine === 'elevenlabs' ? 'ElevenLabs TTS' : 
                            settings.ttsEngine === 'elevenlabs' ? 'ElevenLabs' :
                            settings.ttsEngine === 'melotts' ? 'MeloTTS' :
                            settings.ttsEngine === 'coqui' ? 'Coqui TTS' :
                            settings.ttsEngine.toUpperCase()
                        })</span>}
                        {isSettingsSynced && serverSettings && (
                            <span className="ms-2" style={{ color: 'var(--brand)' }}>| 📡 서버 설정 동기화됨 ({serverSettings.lastUpdatedBy || 'System'})</span>
                        )}
                    </small>
                </div>
            )}


            {/* 채팅 메시지 영역 */}
            <div 
                className="chat-messages flex-grow-1 overflow-auto p-3"
                ref={chatContainerRef}
                style={{ 
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#495057 #212529',
                    minHeight: '400px'
                }}
            >
                {messages.length === 0 ? (
                    <div className="text-center text-muted mt-4">
                        <p>💬 채팅이 아직 없습니다.</p>
                        <p><small>첫 번째 메시지를 보내보세요!</small></p>
                    </div>
                ) : (
                    messages.map(renderMessage)
                )}
            </div>

            {/* 채팅 입력 영역 */}
            <div className="chat-input-section p-3">
                <div className="input-group">
                    <Form.Control
                        as="textarea"
                        rows={2}
                        placeholder={
                            !isLoggedIn 
                                ? "로그인 후 채팅에 참여할 수 있습니다..." 
                                : !isConnected 
                                ? "연결을 기다리는 중..." 
                                : "메시지를 입력하세요... (AI 호출: @메시지)"
                        }
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={!isLoggedIn || !isConnected}
                        className="chat-input"
                        style={{ 
                            resize: 'none',
                            minHeight: '50px',
                            fontSize: '14px',
                            lineHeight: '1.4'
                        }}
                    />
                </div>
                
                {/* 버튼 영역 */}
                <div className="d-flex justify-content-between align-items-center mt-2">
                    <Button 
                        variant="outline-primary"
                        size="sm"
                        onClick={() => onOpenDonation && onOpenDonation()}
                        disabled={!isLoggedIn || !isConnected}
                        style={{
                            backgroundColor: 'var(--brand)',
                            borderColor: 'var(--brand)',
                            color: 'white'
                        }}
                    >
                        💰 후원
                    </Button>
                    
                    <Button 
                        variant="primary"
                        size="sm"
                        onClick={sendMessage}
                        disabled={!isLoggedIn || !isConnected || !inputValue.trim()}
                        style={{
                            backgroundColor: 'var(--brand)',
                            borderColor: 'var(--brand)'
                        }}
                    >
                        전송
                    </Button>
                </div>
                
                {!isConnected && isLoggedIn && (
                    <small className="text-warning mt-2 d-block">
                        ⚠️ 연결이 끊어졌습니다. 자동으로 재연결을 시도하고 있습니다...
                    </small>
                )}
            </div>
        </div>
    );
};

// StreamingChatClient로도 사용 가능하도록 별칭 export 추가
export { StreamingChatWithTTS as StreamingChatClient };
export default StreamingChatWithTTS;