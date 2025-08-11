import React, { useState, useEffect, useRef } from 'react';
import { Form, Button, Badge } from 'react-bootstrap';
import { TTSServiceManager } from '../services/ttsServiceManager';
import { AIAudioService } from '../services/aiAudioService';
import { DEFAULT_SETTINGS } from '../config/aiChatSettings';
import AITTSEngineSelector from './AITTSEngineSelector';
import AISettingsPanel from './AISettingsPanel';

const StreamingChatWithTTS = ({ 
    streamerId, 
    isLoggedIn, 
    username, 
    onAIMessage,
    externalSettings,
    onSettingsChange,
    externalShowSettings,
    onShowSettingsChange
}) => {
    const [messages, setMessages] = useState([]);
    const MAX_MESSAGES = 100; // 최대 메시지 개수 제한
    const [inputValue, setInputValue] = useState('');
    const [connectionStatus, setConnectionStatus] = useState('연결 중...');
    const [isConnected, setIsConnected] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState(0);
    
    // TTS 관련 상태 - 확장된 설정
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [currentPlayingMessageId, setCurrentPlayingMessageId] = useState(null);
    const [volume, setVolume] = useState(0.8);
    // 외부에서 전달받은 설정 사용
    const showSettings = externalShowSettings || false;
    const setShowSettings = onShowSettingsChange || (() => {});
    const settings = externalSettings || {
        ...DEFAULT_SETTINGS,
        autoPlay: true,
        ttsEngine: 'elevenlabs',
        elevenLabsVoice: 'aneunjin'
    };
    
    const websocketRef = useRef(null);
    const chatContainerRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const maxReconnectAttempts = 5;
    const isConnectingRef = useRef(false);
    
    // TTS 서비스 참조 - TTS Manager 사용
    const audioRef = useRef(null);
    const ttsManagerRef = useRef(null);
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

    // TTS Manager 초기화
    useEffect(() => {
        if (!ttsManagerRef.current) {
            ttsManagerRef.current = new TTSServiceManager(settings);
            console.log('🎵 TTS Manager 초기화 완료:', settings);
        } else {
            // 이미 존재하면 설정만 업데이트
            ttsManagerRef.current.updateSettings(settings);
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
    }, [settings.ttsEngine]); // settings 전체가 아닌 ttsEngine만 감시

    // 음량 변경 효과
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
    }, [volume]);

    // TTS 설정 업데이트 함수 - 외부 함수 사용
    const updateSetting = onSettingsChange || ((key, value) => {
        console.log('Settings change not available:', key, value);
    });

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
                            // TTS 자동 재생 및 자막 동기화 (설정에 따라)
                            if (audioEnabled && settings.autoPlay) {
                                await playTTS(newMessage, onAIMessage);
                            } else {
                                // 음성이 꺼져있거나 자동 재생이 꺼져있을 때도 자막은 표시
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

    // TTS 재생 함수 - TTS Manager 사용
    const playTTS = async (message, onAIMessage) => {
        if (!audioEnabled || !message.message || isPlayingAudio) {
            console.log('🔇 TTS 재생 스킵:', { audioEnabled, hasMessage: !!message.message, isPlayingAudio });
            return;
        }

        if (!ttsManagerRef.current) {
            console.error('❌ TTS Manager가 초기화되지 않았습니다');
            return;
        }

        try {
            console.log('🎵 TTS 재생 시작:', message.message.substring(0, 50) + '...');
            setCurrentPlayingMessageId(message.id);
            setIsPlayingAudio(true);
            
            // TTS Manager를 통한 TTS 생성
            const startTime = Date.now();
            const audioUrl = await ttsManagerRef.current.generateAudio(message.message);
            const generationTime = (Date.now() - startTime) / 1000;
            
            console.log('✅ TTS 생성 완료:', { generationTime: generationTime + 's', audioUrl: !!audioUrl });
            
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
                const handleLoadedMetadata = async () => {
                    const audioDuration = audioRef.current.duration;
                    
                    // 오디오 파일 크기 측정 (근사값)
                    let audioFileSize = 0;
                    try {
                        const response = await fetch(audioUrl);
                        if (response.ok) {
                            const blob = await response.blob();
                            audioFileSize = blob.size;
                        }
                    } catch (error) {
                        console.log('오디오 파일 크기 측정 실패:', error);
                    }
                    
                    // TTS 정보 객체 생성 (실제 사용된 엔진 정보)
                    const actualEngine = ttsManagerRef.current ? ttsManagerRef.current.currentEngine : settings.ttsEngine;
                    
                    // 디버그 로깅
                    console.log('🔍 TTS 디버그 정보:', {
                        settingsEngine: settings.ttsEngine,
                        actualEngine: actualEngine,
                        managerExists: !!ttsManagerRef.current,
                        managerCurrentEngine: ttsManagerRef.current?.currentEngine
                    });
                    
                    const ttsInfo = {
                        engine: actualEngine,
                        requestedEngine: settings.ttsEngine, // 사용자가 요청한 엔진
                        voice: settings.ttsEngine === 'elevenlabs' ? settings.elevenLabsVoice :
                               settings.ttsEngine === 'melotts' ? settings.meloVoice :
                               settings.ttsEngine === 'coqui' ? settings.coquiModel : 'default',
                        fileSize: audioFileSize,
                        generationTime: generationTime,
                        fallbackUsed: actualEngine !== settings.ttsEngine
                    };
                    
                    if (onAIMessage) {
                        // 음성 재생 시간, 오디오 엘리먼트, TTS 정보를 함께 전달
                        onAIMessage(message.message, audioDuration, audioRef.current, ttsInfo);
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
            console.error('❌ TTS 재생 오류:', {
                error: error.message,
                stack: error.stack,
                settings: settings,
                ttsManager: !!ttsManagerRef.current,
                currentEngine: ttsManagerRef.current?.currentEngine
            });
            
            setIsPlayingAudio(false);
            setCurrentPlayingMessageId(null);
            
            // 사용자에게 오류 알림
            alert(`⚠️ 오류: ${error.message}`);
            
            // TTS 실패 시에도 자막은 표시 (동기화 없이)
            if (onAIMessage) {
                const actualEngine = ttsManagerRef.current ? ttsManagerRef.current.currentEngine : settings.ttsEngine;
                const ttsInfo = {
                    engine: actualEngine,
                    requestedEngine: settings.ttsEngine,
                    voice: 'error',
                    fileSize: 0,
                    generationTime: 0,
                    error: error.message,
                    fallbackUsed: false
                };
                onAIMessage(message.message, 0, null, ttsInfo);
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
                <div key={msg.id} className="chat-message system-message compact-message">
                    <span className="message-badge">📢</span>
                    <strong className="message-sender text-info">System</strong>
                    <span className="message-text text-info">{msg.message}</span>
                    <small className="message-time">[{messageTime}]</small>
                </div>
            );
        }

        // AI 응답 메시지
        if (msg.message_type === 'ai') {
            return (
                <div key={msg.id} className="chat-message ai-message compact-message">
                    <span className="message-badge">🤖</span>
                    <strong className="message-sender">AI</strong>
                    <span className="message-text">{msg.message}</span>
                    <small className="message-time">[{messageTime}]</small>
                </div>
            );
        }

        // 사용자 메시지
        const isMyMessage = msg.sender === username;
        
        return (
            <div key={msg.id} className={`chat-message user-message compact-message ${isMyMessage ? 'my-message' : ''}`}>
                <span className="message-badge">👤</span>
                <strong className={`message-sender ${isMyMessage ? 'text-success' : 'text-primary'}`}>
                    {msg.sender}
                </strong>
                <span className="message-text">{msg.message}</span>
                <small className="message-time">[{messageTime}]</small>
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
                        {audioEnabled && <span className="ms-2 text-info">| 🔊 AI 음성 자동 재생 ({
                            settings.ttsEngine === 'elevenlabs' ? 'ElevenLabs TTS' : 
                            settings.ttsEngine === 'elevenlabs' ? 'ElevenLabs' :
                            settings.ttsEngine === 'melotts' ? 'MeloTTS' :
                            settings.ttsEngine === 'coqui' ? 'Coqui TTS' :
                            settings.ttsEngine.toUpperCase()
                        })</span>}
                    </small>
                </div>
            )}


            {/* 채팅 메시지 영역 */}
            <div 
                className="chat-messages flex-grow-1 overflow-auto p-3 bg-dark"
                ref={chatContainerRef}
                style={{ 
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#495057 #212529',
                    minHeight: '500px'
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
                        rows={3}
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
                        style={{ 
                            resize: 'none',
                            minHeight: '80px',
                            fontSize: '14px',
                            lineHeight: '1.4'
                        }}
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