// frontend/src/components/ChatComponent.js

import React, { useState, useEffect, useRef } from 'react';

function ChatComponent() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const socketRef = useRef(null);
  const chatLogRef = useRef(null);
  const roomName = 'lobby'; // 예시 방 이름

  useEffect(() => {
    // Docker 환경에서는 React 앱이 실행되는 호스트의 8000번 포트로 접속합니다.
    const wsUrl = `ws://${window.location.hostname}:8000/ws/chat/${roomName}/`;
    socketRef.current = new WebSocket(wsUrl);

    socketRef.current.onopen = () => {
      console.log('WebSocket에 연결되었습니다.');
    };

    socketRef.current.onmessage = (e) => {
      const data = JSON.parse(e.data);
      // 실제로는 사용자 정보도 함께 받아 누가 보냈는지 구분하면 좋습니다.
      setMessages((prevMessages) => [...prevMessages, { text: data.message, sender: 'other' }]);
    };

    socketRef.current.onclose = () => {
      console.error('WebSocket 연결이 닫혔습니다.');
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
    };

    socketRef.current.send(JSON.stringify(messageData));
    
    // 내가 보낸 메시지를 화면에 바로 추가
    setMessages((prevMessages) => [...prevMessages, { text: inputValue, sender: 'me' }]);
    setInputValue('');
  };

  return (
    <div className="container d-flex justify-content-center align-items-center vh-100">
      <div className="card w-100" style={{ maxWidth: '800px', height: '80vh' }}>
        {/* 채팅방 헤더 */}
        <div className="card-header bg-primary text-white">
          <h2 className="h5 mb-0 text-center">채팅방: {roomName}</h2>
        </div>

        {/* 메시지 로그 */}
        <div 
          ref={chatLogRef} 
          className="card-body d-flex flex-column p-3" 
          style={{ overflowY: 'auto' }}
        >
          {messages.map((msg, index) => (
            <div 
              key={index} 
              className={`d-flex ${msg.sender === 'me' ? 'justify-content-end' : 'justify-content-start'} mb-3`}
            >
              <div 
                className={`p-2 rounded-3 mw-75 ${msg.sender === 'me' ? 'bg-primary text-white' : 'bg-light text-dark'}`}
                style={{ wordBreak: 'break-word' }}
              >
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        {/* 메시지 입력 폼 */}
        <div className="card-footer">
          <div className="input-group">
            <input
              type="text"
              className="form-control"
              placeholder="메시지를 입력하세요..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
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