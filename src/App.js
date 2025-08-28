import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import api from './api';
import Navbar from './components/layout/Navbar';
import SignupForm from './components/auth/SignupForm';
import LoginForm from './components/auth/LoginForm';
import TermsPage from './components/auth/TermsPage';
import UserListPage from './components/user/UserListPage';
import ProfilePage from './components/user/ProfilePage';
import StreamingPage from './components/streaming/StreamingPage';
import HomeTemporary from './components/pages/HomeTemporary';
import CreateChatRoom from './components/staff/CreateChatRoom';
import ChatRoomManagement from './components/staff/ChatRoomManagement';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('accessToken'));
  const [user, setUser] = useState(null); // username 대신 user 객체 전체를 저장
  const [userBalance, setUserBalance] = useState(0);

  // 사용자 정보를 가져와 상태를 설정하는 함수
  const fetchAndSetUser = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setIsLoggedIn(false);
      setUser(null);
      return;
    }
    
    try {
      // api 모듈을 사용하여 요청합니다. 헤더는 자동으로 추가됩니다.
      const response = await api.get('/api/users/me/');
      
      setIsLoggedIn(true);
      setUser(response.data);// 사용자 정보 전체를 저장
      setUserBalance(response.data.balance || 0); 
    } catch (error) {
      // api.js의 인터셉터가 토큰 갱신 실패 시 자동으로 토큰을 삭제하고 로그인 페이지로 보낼 수 있습니다.
      // 여기서는 상태만 초기화합니다.
      console.error('Failed to fetch user data, token might be invalid:', error);
      setIsLoggedIn(false);
      setUser(null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUserBalance(0);
    }
  };

  // 앱이 처음 로드될 때 사용자 정보 가져오기
  useEffect(() => {
    fetchAndSetUser();
  }, []);

  // 로그인 성공 시 호출되는 함수
  const handleLogin = (accessToken, refreshToken) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken); // Refresh Token도 저장
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`; // api 인스턴스 헤더 즉시 업데이트
    fetchAndSetUser();
  };

  // 로그아웃 처리 함수
  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    delete api.defaults.headers.common['Authorization']; // api 인스턴스 헤더에서 토큰 제거
    setIsLoggedIn(false);
    setUser(null);
    setUserBalance(0);
    window.location.href = '/login'; // 로그아웃 후 로그인 페이지로 이동
  };

  return (
    <Router>
      <div className="App">
        <Navbar isLoggedIn={isLoggedIn} user={user} onLogout={handleLogout} userBalance={userBalance} />
        <Routes>
          <Route path="/" element={<HomeTemporary />} />
          <Route path="/signup/terms" element={<TermsPage />} />
          <Route path="/signup" element={<SignupForm />} />
          <Route path="/login" element={<LoginForm onLogin={handleLogin} />} />
          <Route path="/find-id" element={<div>아이디 찾기 페이지</div>} />
          <Route path="/find-password" element={<div>비밀번호 찾기 페이지</div>} />
          
          {/* is_staff가 true일 때만 렌더링되도록 보호 */}
          {user?.is_staff && (
            <>
              <Route path="/management" element={<UserListPage />} />
              <Route path="/management/userlist" element={<UserListPage />} />
              <Route path="/staff/create" element={<CreateChatRoom />} />
              <Route path="/staff/management" element={<ChatRoomManagement />} />
            </>
          )}

          {/* 로그인이 필요한 페이지 */}
          {isLoggedIn && (
            <>
              <Route path="/profile" element={<ProfilePage refreshUserData={fetchAndSetUser} />} />
              <Route path="/stream/:roomId" element={<StreamingPage isLoggedIn={isLoggedIn} user={user} />} />
            </>
          )}
        </Routes>
      </div>
    </Router>
  );
}

export default App;