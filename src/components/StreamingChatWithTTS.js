import React, { useState, useEffect, useRef } from 'react';
import { Form, Button, Badge } from 'react-bootstrap';
import { AITTSService } from '../services/aiTTSService';
import { AIAudioService } from '../services/aiAudioService';
import { DEFAULT_SETTINGS } from '../config/aiChatSettings';

const StreamingChatWithTTS = ({ streamerId, isLoggedIn, username, onAIMessage }) => {
    const [messages, setMessages] = useState([]);
    const MAX_MESSAGES = 100; // 최대 메시지 개수 제한
    const [inputValue, setInputValue] = useState('');
    const [connectionStatus, setConnectionStatus] = useState('연결 중...');
    const [isConnected, setIsConnected] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState(0);
    
    // TTS 관련 상태
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [currentPlayingMessageId, setCurrentPlayingMessageId] = useState(null);
    const [volume, setVolume] = useState(0.8); // 음량 상태 추가
    const [ttsSettings] = useState({
        ttsVoice: DEFAULT_SETTINGS.ttsVoice,
        ttsSpeed: DEFAULT_SETTINGS.ttsSpeed,
        autoPlay: true // AI 메시지 자동 재생 (기본값)
    });
    
    const websocketRef = useRef(null);
    const chatContainerRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const maxReconnectAttempts = 5;
    const isConnectingRef = useRef(false);
    
    // TTS 서비스 참조
    const audioRef = useRef(null);
    const ttsServiceRef = useRef(null);
    const audioServiceRef = useRef(null);

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

    // TTS 서비스 초기화
    useEffect(() => {
        if (!ttsServiceRef.current) {
            ttsServiceRef.current = new AITTSService(null, ttsSettings);
        }
        
        if (!audioServiceRef.current && audioRef.current) {
            audioServiceRef.current = new AIAudioService(audioRef);
            audioServiceRef.current.setCallbacks(
                (playing) => setIsPlayingAudio(playing),
                () => {
                    setIsPlayingAudio(false);
                    setCurrentPlayingMessageId(null);
                }
            );
        }
    }, []);

    // 음량 변경 효과
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
    }, [volume]);

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
                let wsUrl = `ws://localhost:8000/ws/stream/${streamerId}/`;
                
                const token = localStorage.getItem('accessToken');
                if (token) {
                    wsUrl += `?token=${token}`;
                }
                
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
                        
                        const newMessage = {
                            id: Date.now() + Math.random(),
                            ...data,
                            timestamp: data.timestamp || Date.now()
                        };
                        
                        addMessage(newMessage);
                        
                        // AI 메시지 처리
                        if (data.message_type === 'ai') {
                            // TTS 자동 재생 및 자막 동기화
                            if (audioEnabled) {
                                await playTTS(newMessage, onAIMessage);
                            } else {
                                // 음성이 꺼져있을 때도 자막은 표시
                                if (onAIMessage) {
                                    onAIMessage(data.message, 0, null);
                                }
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

    // TTS 재생 함수
    const playTTS = async (message, onAIMessage) => {
        if (!audioEnabled || !message.message || isPlayingAudio) {
            return;
        }

        try {
            setCurrentPlayingMessageId(message.id);
            // TTS 생성
            const audioUrl = await ttsServiceRef.current.generateAudio(message.message);
            
            // 먼저 오디오 URL을 설정하고 충분한 버퍼링 후 재생
            if (audioRef.current) {
                audioRef.current.src = audioUrl;
                
                // 오디오 완전 로딩 완료 후 재생하는 Promise
                const waitForAudioReady = () => {
                    return new Promise((resolve, reject) => {
                        const audio = audioRef.current;
                        
                        // 이미 로드된 경우 즉시 실행
                        if (audio.readyState >= 4) { // HAVE_ENOUGH_DATA
                            resolve();
                            return;
                        }
                        
                        // canplaythrough 이벤트: 충분한 데이터 버퍼링 완료
                        const handleCanPlayThrough = () => {
                            audio.removeEventListener('canplaythrough', handleCanPlayThrough);
                            audio.removeEventListener('error', handleError);
                            resolve();
                        };
                        
                        const handleError = () => {
                            audio.removeEventListener('canplaythrough', handleCanPlayThrough);
                            audio.removeEventListener('error', handleError);
                            reject(new Error('오디오 로딩 실패'));
                        };
                        
                        audio.addEventListener('canplaythrough', handleCanPlayThrough);
                        audio.addEventListener('error', handleError);
                        
                        // 로딩 시작
                        audio.load();
                    });
                };
                
                // 메타데이터 로드 이벤트 리스너 (자막 동기화용)
                const handleLoadedMetadata = () => {
                    const audioDuration = audioRef.current.duration;
                    
                    if (onAIMessage) {
                        // 음성 재생 시간과 오디오 엘리먼트를 함께 전달
                        onAIMessage(message.message, audioDuration, audioRef.current);
                    }
                    
                    // 이벤트 리스너 정리
                    audioRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
                };
                
                audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
                
                // 충분한 버퍼링 후 재생 시작
                await waitForAudioReady();
                
                // 100ms 추가 버퍼 시간 (앞부분 잘림 방지)
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // 오디오 재생 시작
                if (audioServiceRef.current) {
                    await audioServiceRef.current.playAudio(audioUrl);
                }
            }
        } catch (error) {
            console.error('TTS 재생 오류:', error);
            setIsPlayingAudio(false);
            setCurrentPlayingMessageId(null);
            // TTS 실패 시에도 자막은 표시 (동기화 없이)
            if (onAIMessage) {
                onAIMessage(message.message, 0, null);
            }
        }
    };


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
                <div key={msg.id} className="chat-message system-message mb-2">
                    <small className="text-muted">
                        <span className="me-2">[{messageTime}]</span>
                        <span className="text-info">📢 {msg.message}</span>
                    </small>
                </div>
            );
        }

        // AI 응답 메시지
        if (msg.message_type === 'ai') {
            return (
                <div key={msg.id} className="chat-message ai-message mb-2">
                    <div className="d-flex align-items-start">
                        <Badge bg="secondary" className="me-2 flex-shrink-0">🤖</Badge>
                        <div className="flex-grow-1">
                            <div className="d-flex justify-content-between align-items-start">
                                <strong className="text-primary">AI Assistant</strong>
                                <small className="text-muted ms-2">[{messageTime}]</small>
                            </div>
                            <div className="message-content mt-1">
                                <span className="text-light">{msg.message}</span>
                            </div>
                            {msg.replied_to && (
                                <small className="text-muted">
                                    ↳ {msg.replied_to}님에게 답장 ({msg.ai_trigger_type})
                                </small>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        // 사용자 메시지
        const isMyMessage = msg.sender === username;
        
        return (
            <div key={msg.id} className={`chat-message user-message mb-2 ${isMyMessage ? 'my-message' : ''}`}>
                <div className="d-flex align-items-start">
                    <Badge 
                        bg={isMyMessage ? "success" : "primary"} 
                        className="me-2 flex-shrink-0"
                    >
                        👤
                    </Badge>
                    <div className="flex-grow-1">
                        <div className="d-flex justify-content-between align-items-start">
                            <strong className={isMyMessage ? "text-success" : "text-primary"}>
                                {msg.sender}
                            </strong>
                            <small className="text-muted ms-2">[{messageTime}]</small>
                        </div>
                        <div className="message-content mt-1">
                            <span className="text-light">{msg.message}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="streaming-chat-container h-100 d-flex flex-column">
            {/* 오디오 엘리먼트 (숨김) */}
            <audio ref={audioRef} style={{ display: 'none' }} />
            
            {/* 채팅 헤더 */}
            <div className="chat-header bg-dark border-bottom border-secondary p-2">
                <div className="d-flex justify-content-between align-items-center">
                    <div>
                        <small className="text-light fw-bold">💬 {streamerId} 채팅방</small>
                        {onlineUsers > 0 && (
                            <span className="ms-2 text-muted">👥 {onlineUsers}명</span>
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
                        <Badge 
                            bg={isConnected ? "success" : "warning"} 
                            className="connection-status"
                        >
                            {connectionStatus}
                        </Badge>
                    </div>
                </div>
            </div>

            {/* AI 사용법 안내 */}
            {isLoggedIn && (
                <div className="chat-help bg-primary bg-opacity-10 border-bottom border-primary p-2">
                    <small className="text-light">
                        <strong className="text-warning">🤖 AI 어시스턴트 사용법:</strong><br/>
                        <code className="text-success bg-dark px-1 rounded">@메시지</code> <span className="text-light">- 스트리머 멘션으로 AI 호출</span>
                        {audioEnabled && <span className="ms-2 text-info">| 🔊 AI 음성 자동 재생 활성화</span>}
                    </small>
                </div>
            )}

            {/* 채팅 메시지 영역 */}
            <div 
                className="chat-messages flex-grow-1 overflow-auto p-3 bg-dark"
                ref={chatContainerRef}
                style={{ 
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#495057 #212529'
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
            <div className="chat-input-section bg-dark border-top border-secondary p-3">
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
                        className="bg-secondary text-light border-secondary"
                        style={{ resize: 'none' }}
                    />
                    <Button 
                        variant="primary"
                        onClick={sendMessage}
                        disabled={!isLoggedIn || !isConnected || !inputValue.trim()}
                        className="px-3"
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

export default StreamingChatWithTTS;