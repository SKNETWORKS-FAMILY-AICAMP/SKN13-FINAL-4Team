import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import Navbar from './components/layout/Navbar';
import SignupForm from './components/auth/SignupForm';
import LoginForm from './components/auth/LoginForm';
import TermsPage from './components/auth/TermsPage';
import UserListPage from './components/user/UserListPage';
import ProfilePage from './components/user/ProfilePage';
import StreamingPage from './components/streaming/StreamingPage';
import HomeTemporary from './components/pages/HomeTemporary';
import TTSDebugTool from './components/tts/TTSDebugTool';
import './App.css';

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
      
      const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
      const response = await axios.get(`${apiBaseUrl}/api/users/me/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setIsLoggedIn(true);
      setUsername(response.data.username); 
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
          <Route path="/signup/terms" element={<TermsPage />} />
          <Route path="/signup" element={<SignupForm />} />
          <Route path="/login" element={<LoginForm onLogin={handleLogin} />} />
          <Route path="/find-id" element={<div>아이디 찾기 페이지</div>} />
          <Route path="/find-password" element={<div>비밀번호 찾기 페이지</div>} />
          {/* 관리자용 유저 목록 페이지 */}
          <Route path="/management" element={<UserListPage />} />
          <Route path="/management/userlist" element={<UserListPage />} />
          
          {/* 개인 프로필 페이지 */}
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/stream/:streamerId" element={<StreamingPage isLoggedIn={isLoggedIn} username={username} />} />
          <Route path="/debug/tts" element={<TTSDebugTool />} />
        </Routes>
      </div>
    </Router>
  );
}
export default App;