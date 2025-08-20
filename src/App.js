import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate, Outlet } from 'react-router-dom';
import api from './api'; // Axios 인스턴스 (토큰 갱신 로직이 포함된 파일)
import Navbar from './components/layout/Navbar';
import SignupForm from './components/auth/SignupForm';
import LoginForm from './components/auth/LoginForm';
import TermsPage from './components/auth/TermsPage';
import UserListPage from './components/user/UserListPage';
import ProfilePage from './components/user/ProfilePage';
import StreamingPage from './components/streaming/StreamingPage';
import HomeTemporary from './components/pages/HomeTemporary';
import TTSDebugTool from './components/ai/TTSDebugTool';
import CreateChatRoom from './components/staff/CreateChatRoom';
import ChatRoomManagement from './components/staff/ChatRoomManagement';
import './App.css';

api.interceptors.response.use(
  (response) => response, // 성공 응답은 그대로 반환합니다.
  async (error) => {
    const originalRequest = error.config;

    // 401 에러이고, 이전에 재시도된 요청이 아닐 경우 토큰 갱신을 시도합니다.
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // 무한 재시도를 방지하기 위해 플래그를 설정합니다.
      
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          // 리프레시 토큰으로 새로운 액세스 토큰을 요청합니다.
          const response = await api.post('/api/token/refresh/', { refresh: refreshToken });
          const newAccessToken = response.data.access;
          
          // 로컬 스토리지와 Axios 기본 헤더에 새로운 토큰을 저장합니다.
          localStorage.setItem('accessToken', newAccessToken);
          api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
          originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
          
          // 실패했던 원래 요청을 새로운 토큰으로 재시도합니다.
          return api(originalRequest);
        } catch (refreshError) {
          // 리프레시 토큰마저 만료되었거나 유효하지 않은 경우입니다.
          console.error('Session expired, please log in again.', refreshError);
          // 모든 토큰을 삭제하고 사용자를 로그인 페이지로 보냅니다.
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login'; 
          return Promise.reject(refreshError);
        }
      }
    }
    // 처리할 수 없는 다른 모든 에러는 그대로 반환합니다.
    return Promise.reject(error);
  }
);


// 로그인이 필요한 페이지를 보호하기 위한 Wrapper 컴포넌트입니다.
const ProtectedRoute = ({ isLoggedIn }) => {
  if (!isLoggedIn) {
    // 로그인이 되어있지 않다면, 현재 위치를 기억하고 로그인 페이지로 리디렉션합니다.
    return <Navigate to="/login" replace />;
  }
  // 로그인이 되어있다면, 요청된 페이지(자식 컴포넌트)를 렌더링합니다.
  return <Outlet />;
};


function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(true); // 앱의 최초 로딩 상태를 관리합니다.

  // 사용자 정보를 가져와 상태를 설정하는 함수입니다.
  const fetchAndSetUser = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setIsLoading(false); // 토큰이 없으면 바로 로딩을 종료합니다.
      return;
    }
    
    try {
      // 서버에 사용자 정보를 요청합니다. 토큰이 만료되었더라도 인터셉터가 처리해줍니다.
      const response = await api.get('/api/users/me/');
      setIsLoggedIn(true);
      setUsername(response.data.username);
    } catch (error) {
      console.error('Failed to fetch user data on initial load:', error);
      // 토큰이 유효하지 않으면 상태를 확실히 로그아웃으로 설정합니다.
      setIsLoggedIn(false);
      setUsername('');
    } finally {
      setIsLoading(false); // 모든 과정이 끝나면 로딩 상태를 해제합니다.
    }
  }, []);

  // 컴포넌트가 처음 마운트될 때 사용자 정보를 가져옵니다.
  useEffect(() => {
    fetchAndSetUser();
  }, [fetchAndSetUser]);

  // 로그인 성공 시 호출되는 핸들러입니다.
  const handleLogin = (accessToken, refreshToken) => {
    localStorage.setItem('accessToken', accessToken);
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }
    // 로그인 성공 후, 사용자 정보를 다시 가져와 앱 상태를 업데이트합니다.
    fetchAndSetUser();
  };

  // 로그아웃 시 호출되는 핸들러입니다.
  const handleLogout = () => {
    // 서버 측의 리프레시 토큰을 무효화하는 API를 호출하는 것이 더 안전합니다.
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setIsLoggedIn(false);
    setUsername('');
  };
  
  // 최초 로딩 중에는 스피너 등을 보여줍니다.
  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <div className="App">
        <NavbarWrapper isLoggedIn={isLoggedIn} onLogout={handleLogout} />
        <Routes>
          {/* 공개적으로 접근 가능한 경로들 */}
          <Route path="/" element={<HomeTemporary />} />
          <Route path="/signup/terms" element={<TermsPage />} />
          <Route path="/signup" element={<SignupForm />} />
          <Route path="/login" element={<LoginForm onLogin={handleLogin} />} />
          <Route path="/find-id" element={<div>아이디 찾기 페이지</div>} />
          <Route path="/find-password" element={<div>비밀번호 찾기 페이지</div>} />
          <Route path="/debug/tts" element={<TTSDebugTool />} />

          {/* 로그인이 필요한 보호된 경로들 */}
          <Route element={<ProtectedRoute isLoggedIn={isLoggedIn} />}>
            <Route path="/management" element={<UserListPage />} />
            <Route path="/management/userlist" element={<UserListPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/stream/:roomId" element={<StreamingPage isLoggedIn={isLoggedIn} username={username} />} />
            <Route path="/staff/create" element={<CreateChatRoom />}/>
            <Route path="/staff/management" element={<ChatRoomManagement />}/>
          </Route>
        </Routes>
      </div>
    </Router>
  );
}

// Navbar 컴포넌트에서 useNavigate 훅을 사용하기 위한 Wrapper 컴포넌트입니다.
const NavbarWrapper = ({ isLoggedIn, onLogout }) => {
  const navigate = useNavigate();

  const handleLogoutAndNavigate = () => {
    onLogout();
    navigate('/login'); // 로그아웃 후 로그인 페이지로
  };

  return <Navbar isLoggedIn={isLoggedIn} onLogout={handleLogoutAndNavigate} />;
};

export default App;