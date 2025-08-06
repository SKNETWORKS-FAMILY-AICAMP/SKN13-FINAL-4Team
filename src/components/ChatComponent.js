// frontend/src/components/ChatComponent.js

import React, { useState, useEffect, useRef } from 'react';

function ChatComponent() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [aiIsTyping, setAiIsTyping] = useState(false);
  const socketRef = useRef(null);
  const chatLogRef = useRef(null);
  const roomName = 'lobby'; // 예시 방 이름

  useEffect(() => {
    // Docker 환경에서는 React 앱이 실행되는 호스트의 8000번 포트로 접속합니다.
    const wsUrl = `ws://${window.location.hostname}:8000/ws/chat/${roomName}/`;
    socketRef.current = new WebSocket(wsUrl);

    socketRef.current.onopen = () => {
      console.log('WebSocket에 연결되었습니다.');
      setIsConnected(true);
    };

    socketRef.current.onmessage = (e) => {
      const data = JSON.parse(e.data);
      const messageType = data.message_type || 'user';
      const sender = data.sender || 'other';
      
      // AI 타이핑 상태 업데이트
      if (sender === 'ai') {
        setAiIsTyping(false);
      }
      
      // 메시지 표시용 sender 결정
      let displaySender;
      if (sender === 'ai') {
        displaySender = 'ai';
      } else if (sender === 'user') {
        // 내가 보낸 메시지는 'me'로 표시
        displaySender = 'me';
      } else {
        // 다른 사용자가 보낸 메시지
        displaySender = 'other';
      }
      
      // 메시지 추가
      setMessages((prevMessages) => [
        ...prevMessages, 
        { 
          text: data.message, 
          sender: displaySender,
          messageType: messageType,
          timestamp: new Date()
        }
      ]);
    };

    socketRef.current.onclose = () => {
      console.error('WebSocket 연결이 닫혔습니다.');
      setIsConnected(false);
    };

    socketRef.current.onerror = (error) => {
      console.error('WebSocket 에러:', error);
    };

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [roomName]);

  // 새 메시지가 추가될 때마다 스크롤을 맨 아래로 이동
  useEffect(() => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = () => {
    if (inputValue.trim() === '' || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const messageData = {
      message: inputValue,
      sender: 'user'
    };

    socketRef.current.send(JSON.stringify(messageData));
    
    // 내가 보낸 메시지는 WebSocket 에코백에서 처리하므로 여기서는 추가하지 않음
    // WebSocket으로부터 받은 메시지만 화면에 표시
    
    // AI 타이핑 상태 활성화
    setAiIsTyping(true);
    setInputValue('');
  };

  return (
    <div className="container d-flex justify-content-center align-items-center vh-100">
      <div className="card w-100" style={{ maxWidth: '800px', height: '80vh' }}>
        {/* 채팅방 헤더 */}
        <div className="card-header bg-primary text-white">
          <div className="d-flex justify-content-between align-items-center">
            <h2 className="h5 mb-0">💬 AI 채팅방: {roomName}</h2>
            <div className="d-flex align-items-center">
              <span className={`badge ${isConnected ? 'bg-success' : 'bg-danger'} me-2`}>
                {isConnected ? '연결됨' : '연결 끊김'}
              </span>
              <small>🤖 AI 어시스턴트 활성</small>
            </div>
          </div>
        </div>

        {/* 메시지 로그 */}
        <div 
          ref={chatLogRef} 
          className="card-body d-flex flex-column p-3" 
          style={{ overflowY: 'auto' }}
        >
          {messages.map((msg, index) => {
            const isMe = msg.sender === 'me';
            const isAI = msg.sender === 'ai';
            
            return (
              <div 
                key={index} 
                className={`d-flex ${isMe ? 'justify-content-end' : 'justify-content-start'} mb-3`}
              >
                <div className="d-flex flex-column" style={{ maxWidth: '75%' }}>
                  {/* 송신자 라벨 */}
                  {!isMe && (
                    <small className={`mb-1 ${isAI ? 'text-success' : 'text-muted'}`}>
                      {isAI ? '🤖 AI 어시스턴트' : '👤 다른 사용자'}
                    </small>
                  )}
                  
                  {/* 메시지 버블 */}
                  <div 
                    className={`p-3 rounded-3 ${
                      isMe 
                        ? 'bg-primary text-white' 
                        : isAI 
                          ? 'bg-success text-white'
                          : 'bg-light text-dark'
                    }`}
                    style={{ wordBreak: 'break-word' }}
                  >
                    {msg.text}
                  </div>
                </div>
              </div>
            );
          })}
          
          {/* AI 타이핑 인디케이터 */}
          {aiIsTyping && (
            <div className="d-flex justify-content-start mb-3">
              <div className="d-flex flex-column" style={{ maxWidth: '75%' }}>
                <small className="mb-1 text-success">
                  🤖 AI 어시스턴트
                </small>
                <div className="p-3 rounded-3 bg-success text-white">
                  <div className="d-flex align-items-center">
                    <div className="spinner-border spinner-border-sm me-2" role="status">
                      <span className="visually-hidden">로딩 중...</span>
                    </div>
                    응답을 생성하고 있습니다...
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 메시지 입력 폼 */}
        <div className="card-footer">
          <div className="input-group">
            <input
              type="text"
              className="form-control"
              placeholder="AI와 대화하세요... (모든 메시지에 AI가 응답합니다)"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              disabled={!isConnected}
            />
            <button onClick={sendMessage} className="btn btn-primary">
              전송
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatComponent;