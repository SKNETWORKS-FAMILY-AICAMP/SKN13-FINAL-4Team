import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
// import { jwtDecode } from 'jwt-decode';
//import api from './utils/unifiedApiClient';
import api from './api';
import { getValidToken } from './utils/tokenUtils';
import Navbar from './components/layout/Navbar';
import SignupForm from './components/auth/SignupForm';
import LoginForm from './components/auth/LoginForm';
import TermsPage from './components/auth/TermsPage';
import UserListPage from './components/user/UserListPage';
import ProfilePage from './components/user/ProfilePage';
import StreamingPage from './components/streaming/StreamingPage';
import HomeTemporary from './components/pages/HomeTemporary';
import FindId from './components/auth/FindId';
import FindPassword from './components/auth/FindPassword';
import SuccessPage from './components/pages/SuccessPage';
import FailPage from './components/pages/FailPage';
import CreateChatRoom from './components/staff/CreateChatRoom';
import ChatRoomManagement from './components/staff/ChatRoomManagement';
import InfluencerManagementPage from './components/staff/InfluencerManagementPage';
import TTSDebugTool from './components/tts/TTSDebugTool';
import InfluencerPage from './components/pages/InfluencerPage';
//import StreamerManagement from './components/staff/StreamerManagement';
import { initializeVideoConfig } from './utils/videoConfig';
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
    console.log('🚀 App.js useEffect 실행됨');
    fetchAndSetUser();
    // 다크모드를 기본값으로 설정
    if (!document.documentElement.getAttribute('data-theme')) {
      document.documentElement.setAttribute('data-theme', 'dark');
      console.log('🌙 기본 테마를 dark로 설정');
    }
    
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
          {/* 결제 결과 페이지 */}
          <Route path="/success" element={<SuccessPage />} />
          <Route path="/fail" element={<FailPage />} />
          <Route path="/signup/terms" element={<TermsPage />} />
          <Route path="/signup" element={<SignupForm />} />
          <Route path="/login" element={<LoginForm onLogin={handleLogin} />} />
          <Route path="/find-id" element={<FindId />} />
          <Route path="/find-password" element={<FindPassword />} />
          <Route path="/stream/:roomId" element={<StreamingPage isLoggedIn={isLoggedIn} user={user} />} />
          <Route path="/influencers/:id" element={<InfluencerPage />} />
          {/* is_staff가 true일 때만 렌더링되도록 보호 */}
          {user?.is_staff && (
            <>
              <Route path="/management" element={<UserListPage />} />
              <Route path="/management/userlist" element={<UserListPage />} />
          {/* 스태프 페이지 */}
            <Route path="/staff/create" element={<CreateChatRoom />} />
            <Route path="/staff/management" element={<ChatRoomManagement />} />
              <Route path="/staff/influencers" element={<InfluencerManagementPage />} />
              <Route path="/debug/tts" element={<TTSDebugTool />} />
            </>
          )}

          {/* 로그인이 필요한 페이지 */}
          {isLoggedIn && (
            <>
              <Route path="/profile" element={<ProfilePage refreshUserData={fetchAndSetUser} />} />
            </>
          )}
          {/* 호환 라우트: 과거 링크 대응 */}
          <Route path="/chat/lobby" element={<HomeTemporary />} />
          <Route path="/chat/:roomId" element={<StreamingPage isLoggedIn={isLoggedIn} username={username} />} /> */}
            </>
          )}
        </Routes>
      </div>
    </Router>
  );
}

export default App;