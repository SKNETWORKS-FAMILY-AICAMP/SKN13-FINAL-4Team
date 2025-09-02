import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
// import { jwtDecode } from 'jwt-decode';
import api from './utils/unifiedApiClient';
import { getValidToken } from './utils/tokenUtils';
import Navbar from './components/layout/Navbar';
import SignupForm from './components/auth/SignupForm';
import LoginForm from './components/auth/LoginForm';
import TermsPage from './components/auth/TermsPage';
import UserListPage from './components/user/UserListPage';
import ProfilePage from './components/user/ProfilePage';
import StreamingPage from './components/streaming/StreamingPage';
import HomeTemporary from './components/pages/HomeTemporary';
import SuccessPage from './components/pages/SuccessPage';
import FailPage from './components/pages/FailPage';
import CreateChatRoom from './components/staff/CreateChatRoom';
import ChatRoomManagement from './components/staff/ChatRoomManagement';
import StreamerManagement from './components/staff/StreamerManagement';
import { initializeVideoConfig } from './utils/videoConfig';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [userBalance, setUserBalance] = useState(0);

  // 사용자 정보를 가져와 상태를 설정하는 함수
  const fetchAndSetUser = async (providedToken = null) => {
    console.log('🔍 fetchAndSetUser 호출됨, providedToken:', !!providedToken);
    
    try {
      // 유효한 토큰 자동 갱신 시도
      console.log('🔄 getValidToken 호출 시작...');
      const token = providedToken || await getValidToken();
      console.log('✅ getValidToken 결과:', !!token);
      
      if (!token) {
        console.log('❌ 유효한 토큰이 없음');
        throw new Error('No valid token available');
      }
      
      console.log('🌐 API 요청 시작: /api/users/me/');
      
      const response = await api.get('/api/users/me/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ 사용자 정보 조회 성공:', response.data.username);
      setIsLoggedIn(true);
      setUsername(response.data.username);
      setUserBalance(response.data.balance || 0); 
    } catch (error) {
      console.error('❌ 사용자 정보 조회 실패:', error);
      console.error('❌ 오류 상세:', error.response?.status, error.response?.data);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setIsLoggedIn(false);
      setUsername('');
      setUserBalance(0);
    }
  };

  useEffect(() => {
    console.log('🚀 App.js useEffect 실행됨');
    const token = localStorage.getItem('accessToken');
    console.log('🔍 localStorage에서 토큰 확인:', !!token);
    
    // 비디오 설정 초기화
    initializeVideoConfig()
      .then(() => console.log('✅ 비디오 설정 초기화 완료'))
      .catch(error => console.error('❌ 비디오 설정 초기화 실패:', error));
    
    if (token) {
      console.log('📞 fetchAndSetUser 호출됨 (초기 로드)');
      fetchAndSetUser(); // 토큰 자동 갱신 로직 사용
    } else {
      console.log('❌ 토큰이 없으므로 로그인 상태를 false로 설정');
      setIsLoggedIn(false);
    }
  }, []);

  const handleLogin = (token) => {
    console.log('🎯 App.js handleLogin 호출됨, token:', !!token);
    localStorage.setItem('accessToken', token);
    console.log('💾 accessToken localStorage에 저장됨');
    console.log('📞 fetchAndSetUser 호출 시작...');
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
          {/* 결제 결과 페이지 */}
          <Route path="/success" element={<SuccessPage />} />
          <Route path="/fail" element={<FailPage />} />
          <Route path="/signup/terms" element={<TermsPage />} />
          <Route path="/signup" element={<SignupForm />} />
          <Route path="/login" element={<LoginForm onLogin={handleLogin} />} />
          <Route path="/find-id" element={<div>아이디 찾기 페이지</div>} />
          <Route path="/find-password" element={<div>비밀번호 찾기 페이지</div>} />
          {/* 관리자용 유저 목록 페이지 */}
          <Route path="/management" element={<UserListPage />} />
          <Route path="/management/userlist" element={<UserListPage />} />
          {/* 스태프 페이지 */}
          <Route path="/staff/create" element={<CreateChatRoom />} />
          <Route path="/staff/management" element={<ChatRoomManagement />} />
          <Route path="/staff/streamers" element={<StreamerManagement />} />
          
          {/* 개인 프로필 페이지 */}
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/stream/:roomId" element={<StreamingPage isLoggedIn={isLoggedIn} username={username} />} />
          {/* 호환 라우트: 과거 링크 대응 */}
          <Route path="/chat/lobby" element={<HomeTemporary />} />
          <Route path="/chat/:roomId" element={<StreamingPage isLoggedIn={isLoggedIn} username={username} />} />
        </Routes>
      </div>
    </Router>
  );
}
export default App;