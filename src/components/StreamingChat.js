import React, { useState, useEffect, useRef } from 'react';
import { Form, Button, Badge } from 'react-bootstrap';

const StreamingChat = ({ streamerId, isLoggedIn, username }) => {
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [connectionStatus, setConnectionStatus] = useState('연결 중...');
    const [isConnected, setIsConnected] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState(0);
    
    
    const websocketRef = useRef(null);
    const chatContainerRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const maxReconnectAttempts = 5;
    const isConnectingRef = useRef(false); // 연결 중 플래그

    useEffect(() => {
        let connectTimeout = null;
        let cleanup = false;

        // 기본 검증
        if (!streamerId) {
            return;
        }
        
        // 정리 함수
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
                console.log('🔌 기존 WebSocket 연결 정리');
                websocketRef.current.close();
                websocketRef.current = null;
            }
            
            isConnectingRef.current = false;
        };

        // WebSocket 연결 함수
        const connectWebSocket = () => {
            // 기본 검증
            if (!streamerId || !isLoggedIn) {
                return;
            }
            
            // 연결 중복 방지
            if (isConnectingRef.current) {
                return;
            }

            if (websocketRef.current && websocketRef.current.readyState === WebSocket.CONNECTING) {
                return;
            }
            
            if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
                return;
            }
            
            // 연결 시작 플래그 설정
            isConnectingRef.current = true;

            try {
                const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
                let wsUrl = `${protocol}://localhost:8000/ws/stream/${streamerId}/`;
                
                // JWT 토큰이 있으면 query parameter로 전달
                const token = localStorage.getItem('accessToken');
                if (token) {
                    wsUrl += `?token=${token}`;
                }
                
                // WebSocket 연결
                websocketRef.current = new WebSocket(wsUrl);
                
                websocketRef.current.onopen = () => {
                    setIsConnected(true);
                    setConnectionStatus('연결됨');
                    reconnectAttemptsRef.current = 0;
                    isConnectingRef.current = false;
                };
                
                websocketRef.current.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        
                        const newMessage = {
                            id: Date.now() + Math.random(),
                            ...data,
                            timestamp: data.timestamp || Date.now()
                        };
                        
                        setMessages(prev => [...prev, newMessage]);
                        
                        // 온라인 사용자 수 업데이트
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
                        setMessages(prev => [...prev, {
                            id: Date.now(),
                            message: '인증에 실패했습니다. 로그인을 다시 시도해주세요.',
                            message_type: 'system',
                            timestamp: Date.now()
                        }]);
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

        // 기존 연결 정리
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
            // 중복 연결 방지를 위한 지연
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

        // 정리 함수 반환
        return () => {
            cleanupConnections();
        };
    }, [streamerId, isLoggedIn, username]);

    // 자동 스크롤
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);


    const sendMessage = () => {
        if (!inputValue.trim() || !isConnected || !websocketRef.current) {
            return;
        }

        try {
            const messageText = inputValue.trim();
            const messageData = {
                message: messageText
            };

            // 메시지 전송
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
            {/* 채팅 헤더 */}
            <div className="chat-header bg-dark border-bottom border-secondary p-2">
                <div className="d-flex justify-content-between align-items-center">
                    <div>
                        <small className="text-light fw-bold">💬 {streamerId} 채팅방</small>
                        {onlineUsers > 0 && (
                            <span className="ms-2 text-muted">👥 {onlineUsers}명</span>
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

            {/* AI 사용법 안내 */}
            {isLoggedIn && (
                <div className="chat-help bg-primary bg-opacity-10 border-bottom border-primary p-2">
                    <small className="text-light">
                        <strong className="text-warning">🤖 AI 어시스턴트 사용법:</strong><br/>
                        <code className="text-success bg-dark px-1 rounded">@메시지</code> <span className="text-light">- 스트리머 멘션 (즉시 응답)</span> | 
                        <code className="text-success bg-dark px-1 rounded"> #명령어</code> <span className="text-light">- 특별 요청</span> | 
                        <code className="text-success bg-dark px-1 rounded"> ?질문</code> <span className="text-light">- 질문하기</span> | 
                        <code className="text-success bg-dark px-1 rounded"> !!중요</code> <span className="text-light">- 긴급 메시지</span> | 
                        <code className="text-success bg-dark px-1 rounded"> !일반</code> <span className="text-light">- 일반 요청</span>
                    </small>
                </div>
            )}

            {/* 채팅 메시지 영역 */}
            <div 
                className="chat-messages flex-grow-1 overflow-auto p-3 bg-dark"
                ref={chatContainerRef}
                style={{ 
                    maxHeight: '400px',
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
                                : "메시지를 입력하세요... (AI 호출: @, #, ?, !!, !)"
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

export default StreamingChat;