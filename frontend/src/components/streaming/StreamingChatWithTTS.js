import React, { useState, useEffect, useRef } from 'react';
import { Form, Button, Badge } from 'react-bootstrap';
import api from '../../api'; // 수정: 모든 HTTP 요청에 api 인스턴스를 사용합니다.
import { TTSServiceManager } from '../../services/ttsServiceManager';
import { AIAudioService } from '../../services/aiAudioService';
import { DEFAULT_SETTINGS } from '../../config/aiChatSettings';

const StreamingChatWithTTS = ({ 
    streamerId, 
    isLoggedIn, 
    username, 
    onAIMessage,
    onWebSocketMessage,
    externalSettings,
    onSettingsChange,
    externalShowSettings,
    onShowSettingsChange
}) => {
    const [messages, setMessages] = useState([]);
    const MAX_MESSAGES = 100;
    const [inputValue, setInputValue] = useState('');
    const [connectionStatus, setConnectionStatus] = useState('연결 중...');
    const [isConnected, setIsConnected] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState(0);
    
    // --- (다른 useState, useRef 선언은 기존과 동일하게 유지합니다) ---
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [currentPlayingMessageId, setCurrentPlayingMessageId] = useState(null);
    const [volume, setVolume] = useState(0.8);
    const showSettings = externalShowSettings || false;
    const setShowSettings = onShowSettingsChange || (() => {});
    const settings = externalSettings || { ...DEFAULT_SETTINGS };
    const [serverSettings, setServerSettings] = useState(null);
    const [isSettingsSynced, setIsSettingsSynced] = useState(false);
    const websocketRef = useRef(null);
    const chatContainerRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const maxReconnectAttempts = 5;
    const isConnectingRef = useRef(false);
    const audioRef = useRef(null);
    const ttsManagerRef = useRef(null);
    const audioServiceRef = useRef(null);

    const addMessage = (newMessage) => {
        setMessages(prev => {
            const updatedMessages = [...prev, newMessage];
            if (updatedMessages.length > MAX_MESSAGES) {
                return updatedMessages.slice(-MAX_MESSAGES);
            }
            return updatedMessages;
        });
    };

    // 서버로 TTS 설정 업데이트 요청 (api 인스턴스 사용하도록 수정)
    const updateServerTTSSettings = async (newSettings) => {
        if (!streamerId || !isLoggedIn) return;
        
        try {
            // 수정: fetch 대신 api.post를 사용하고, 인증 헤더는 자동으로 처리됩니다.
            const response = await api.post(`/api/streamer/${streamerId}/tts/settings/update/`, newSettings);
            const result = response.data;
            
            if (result.success) {
                setServerSettings(result.settings);
                if (onSettingsChange) {
                    Object.keys(result.settings).forEach(key => {
                        if (!['streamer_id', 'lastUpdatedBy', 'updatedAt'].includes(key)) {
                            onSettingsChange(key, result.settings[key]);
                        }
                    });
                }
            } else {
                console.error('❌ 서버 TTS 설정 업데이트 실패:', result.error);
                alert('TTS 설정 업데이트에 실패했습니다: ' + result.error);
            }
        } catch (error) {
            console.error('❌ 서버 TTS 설정 업데이트 오류:', error);
            alert('TTS 설정 업데이트 중 오류가 발생했습니다.');
        }
    };

    // 웹소켓 연결 로직
    useEffect(() => {
        if (!streamerId || !isLoggedIn) {
            setConnectionStatus(isLoggedIn ? '스트리머 정보 없음' : '로그인이 필요합니다');
            return;
        }

        const connectWebSocket = () => {
            if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
                return;
            }

            // --- ▼▼▼ 가장 중요한 부분 ▼▼▼ ---
            // .env 파일의 REACT_APP_API_BASE_URL 값을 기반으로 WebSocket 주소를 생성합니다.
            // 이 값이 ngrok 주소가 아니면 채팅이 연결되지 않습니다.
            const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
            if (!apiBaseUrl) {
                console.error("환경 변수 'REACT_APP_API_BASE_URL'가 설정되지 않았습니다.");
                setConnectionStatus("설정 오류");
                return;
            }
            const wsBaseUrl = apiBaseUrl.replace(/^http/, 'ws');
            const token = localStorage.getItem('accessToken');
            const wsUrl = `${wsBaseUrl}/ws/stream/${streamerId}/?token=${token}`;
            // --- ▲▲▲ 여기까지 ▲▲▲ ---

            websocketRef.current = new WebSocket(wsUrl);
            setConnectionStatus('연결 시도 중...');

            websocketRef.current.onopen = () => {
                setIsConnected(true);
                setConnectionStatus('연결됨');
                reconnectAttemptsRef.current = 0;
            };

            websocketRef.current.onmessage = (event) => {
                const data = JSON.parse(event.data);
                // 부모 컴포넌트로 메시지 전달
                if (onWebSocketMessage) {
                    onWebSocketMessage(data);
                }
                // 메시지 타입에 따른 처리 로직 (기존과 동일)
                if (data.type === 'initial_tts_settings') {
                    // ...
                } else if (data.type === 'tts_settings_changed') {
                    // ...
                } else {
                    addMessage({ id: Date.now() + Math.random(), ...data });
                    if (data.message_type === 'ai' && onAIMessage) {
                        // ...
                    }
                }
            };

            websocketRef.current.onclose = (event) => {
                setIsConnected(false);
                // 재연결 로직 (기존과 동일)
                // ...
            };

            websocketRef.current.onerror = (error) => {
                console.error('WebSocket 오류:', error);
                setConnectionStatus('연결 오류');
            };
        };

        connectWebSocket();

        // 컴포넌트 언마운트 시 웹소켓 연결 정리
        return () => {
            if (websocketRef.current) {
                websocketRef.current.close();
            }
        };
    }, [streamerId, isLoggedIn]); // streamerId나 로그인 상태가 변경될 때 재연결

    // 자동 스크롤
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const sendMessage = () => {
        if (!inputValue.trim() || !isConnected || !websocketRef.current) return;
        websocketRef.current.send(JSON.stringify({ message: inputValue.trim() }));
        setInputValue('');
    };
    
    // ... (이하 렌더링 로직은 기존과 동일) ...

    return (
        <div className="streaming-chat-container h-100 d-flex flex-column">
            {/* ... */}
            <div className="chat-header">
                <small>💬 {streamerId} 채팅방</small>
                <Badge bg={isConnected ? "success" : "warning"}>{connectionStatus}</Badge>
            </div>
            <div className="chat-messages" ref={chatContainerRef}>
                {messages.map(msg => (
                    <div key={msg.id} className={`chat-message ${msg.message_type}`}>
                        <strong>{msg.sender || 'System'}: </strong>{msg.message}
                    </div>
                ))}
            </div>
            <div className="chat-input-section">
                <Form.Control
                    as="textarea"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                    disabled={!isLoggedIn || !isConnected}
                    placeholder={isLoggedIn ? (isConnected ? "메시지 입력..." : "연결 중...") : "로그인 필요"}
                />
                <Button onClick={sendMessage} disabled={!isLoggedIn || !isConnected || !inputValue.trim()}>
                    전송
                </Button>
            </div>
        </div>
    );
};

export default StreamingChatWithTTS;
