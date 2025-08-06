import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import Navbar from './components/Navbar';
import SignupForm from './components/SignupForm';
import LoginForm from './components/LoginForm';
import TermsPage from './components/TermsPage';
import UserListPage from './components/UserListPage';
import ProfilePage from './components/ProfilePage';
import StreamingPage from './components/StreamingPage';
import HomeTemporary from './components/HomeTemporary';
import ChatComponent from './components/ChatComponent'; // 레거시 웹소켓 채팅
import ChatBot from './components/ChatBot'; // 메인 TTS 지원 AI 챗봇
import './App.css';

/**
 * TTS 챗봇 페이지 컴포넌트
 */
const ChatBotPage = () => {
  const getInitialMode = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('mode') || localStorage.getItem('appMode') || 'chatbot';
  };

  const [currentMode, setCurrentMode] = useState(getInitialMode);

  useEffect(() => {
    console.log(`🚀 챗봇 모드 시작: ${currentMode}`);
  }, []);

  const switchMode = (mode) => {
    console.log(`🔄 모드 변경: ${currentMode} → ${mode}`);
    setCurrentMode(mode);
    localStorage.setItem('appMode', mode);
    
    const newUrl = `${window.location.pathname}?mode=${mode}`;
    window.history.pushState({ mode }, '', newUrl);
  };

  const NavigationBar = () => (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary shadow-sm" 
         style={{ minHeight: '60px', zIndex: 1000 }}>
      <div className="container-fluid px-3">
        <div className="navbar-brand fw-bold d-flex align-items-center">
          <span className="me-2">🤖</span>
          <span>AI 인플루언서 - TTS 챗봇</span>
        </div>
        
        <div className="d-flex gap-2">
          <button
            className={`btn btn-sm ${
              currentMode === 'chatbot' 
                ? 'btn-light text-primary fw-bold shadow-sm' 
                : 'btn-outline-light'
            }`}
            onClick={() => switchMode('chatbot')}
            style={{ minWidth: '120px' }}
          >
            <span className="me-1">🎤</span>
            AI 챗봇
          </button>
          <button
            className={`btn btn-sm ${
              currentMode === 'websocket' 
                ? 'btn-light text-primary fw-bold shadow-sm' 
                : 'btn-outline-light'
            }`}
            onClick={() => switchMode('websocket')}
            style={{ minWidth: '120px' }}
          >
            <span className="me-1">💬</span>
            웹소켓 채팅
          </button>
        </div>
      </div>
    </nav>
  );

  const renderContent = () => {
    switch (currentMode) {
      case 'chatbot':
        return <ChatBot />;
      case 'websocket':
        return (
          <div className="bg-dark h-100 position-relative">
            <ChatComponent />
          </div>
        );
      default:
        return <ChatBot />;
    }
  };

  return (
    <div className="vh-100 d-flex flex-column">
      <NavigationBar />
      <div className="flex-grow-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
};

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');

  // 사용자 정보를 가져와 상태를 설정하는 함수
  const fetchAndSetUser = async (token) => {
    try {
      const decoded = jwtDecode(token);
      if (decoded.exp * 1000 < Date.now()) {
        throw new Error('Token expired');
      }
      
      const response = await axios.get('http://localhost:8000/api/users/me/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setIsLoggedIn(true);
      setUsername(response.data.nickname); 
    } catch (error) {
      console.error('Failed to fetch user data or token is invalid:', error);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setIsLoggedIn(false);
      setUsername('');
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      fetchAndSetUser(token);
    }
  }, []);

  const handleLogin = (token) => {
    localStorage.setItem('accessToken', token);
    fetchAndSetUser(token);
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setIsLoggedIn(false);
    setUsername('');
    window.location.href = '/';
  };

  return (
    <Router>
      <div className="App">
        <Navbar isLoggedIn={isLoggedIn} onLogout={handleLogout} />
        <Routes>
          <Route path="/" element={<HomeTemporary />} />
          <Route path="/chatbot" element={<ChatBotPage />} />
          <Route path="/signup/terms" element={<TermsPage />} />
          <Route path="/signup" element={<SignupForm />} />
          <Route path="/login" element={<LoginForm onLogin={handleLogin} />} />
          <Route path="/find-id" element={<div>아이디 찾기 페이지</div>} />
          <Route path="/find-password" element={<div>비밀번호 찾기 페이지</div>} />
          <Route path="/management/userlist" element={<UserListPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/stream/:streamerId" element={<StreamingPage isLoggedIn={isLoggedIn} username={username} />} />
        </Routes>
      </div>
    </Router>
  );
}
export default App;