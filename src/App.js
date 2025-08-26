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
import TTSDebugTool from './components/ai/TTSDebugTool';
import SuccessPage from './components/pages/SuccessPage';
import FailPage from './components/pages/FailPage';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [userBalance, setUserBalance] = useState(0);

  // 사용자 정보를 가져와 상태를 설정하는 함수
  const fetchAndSetUser = async (token) => {
    try {
      const decoded = jwtDecode(token);
      if (decoded.exp * 1000 < Date.now()) {
        throw new Error('Token expired');
      }
      
      const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
      const headers = { headers: { Authorization: `Bearer ${token}` } };

      // 1. 사용자 기본 정보 가져오기
      const userResponse = await axios.get(`${apiBaseUrl}/api/users/me/`, headers);
      
      // 2. 사용자 지갑 정보 가져오기
      const walletResponse = await axios.get(`${apiBaseUrl}/api/users/wallet/`, headers);

      setIsLoggedIn(true);
      setUsername(userResponse.data.username);
      setUserBalance(walletResponse.data.balance);

    } catch (error) {
      console.error('Failed to fetch user data or token is invalid:', error);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setIsLoggedIn(false);
      setUsername('');
      setUserBalance(0);
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
    setUserBalance(0);
    window.location.href = '/';
  };

  return (
    <Router>
      <div className="App">
        <Navbar isLoggedIn={isLoggedIn} onLogout={handleLogout} userBalance={userBalance} />
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

          {/* 토스페이먼츠 결제 콜백 페이지 */}
          <Route path="/success" element={<SuccessPage />} />
          <Route path="/fail" element={<FailPage />} />
        </Routes>
      </div>
    </Router>
  );
}
export default App;