import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode'; // jwt-decode: 토큰 디코딩 라이브러리
import Navbar from './components/Navbar';
import SignupForm from './components/SignupForm';
import LoginForm from './components/LoginForm';
import TermsPage from './components/TermsPage';
import UserListPage from './components/UserListPage';
import ProfilePage from './components/ProfilePage';
import HomeTemporary from './components/HomeTemporary';

function App() {
  /* [07/31 Lee]
  메인 함수입니다.
  앱의 전체 구성을 담당하며, 로그인 상태도 App 컴포넌트에서 관리하도록 수정했습니다. */
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        if (decoded.exp * 1000 > Date.now()) {
          setIsLoggedIn(true);
          setUsername(decoded.username); // 토큰에서 username을 가져올 수 있다고 가정하고 작성한 코드입니다.
        } else {
          localStorage.removeItem('accessToken');
        }
      } catch (e) {
        console.error('Invalid token:', e);
        localStorage.removeItem('accessToken');
      }
    }
  }, []);

  const handleLogin = (token) => {
    try {
      const decoded = jwtDecode(token);
      localStorage.setItem('accessToken', token);
      setIsLoggedIn(true);
      setUsername(decoded.username);  // 토큰에서 username을 가져올 수 있다고 가정하고 작성한 코드입니다.
    } catch (e) {
      console.error('Failed to decode token on login:', e);
    }
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
        <Navbar isLoggedIn={isLoggedIn} username={username} onLogout={handleLogout} />
        <Routes>
          {/* 기본 경로는 임시 홈 페이지로 설정 */}
          <Route path="/" element={<HomeTemporary />} />
          
          {/* 회원가입 2단계 경로 */}
          <Route path="/signup/terms" element={<TermsPage />} />
          <Route path="/signup" element={<SignupForm />} />
          
          {/* 로그인 페이지 (onLogin props 전달) */}
          <Route path="/login" element={<LoginForm onLogin={handleLogin} />} />
          
          {/* 아이디/비밀번호 찾기 페이지 */}
          <Route path="/find-id" element={<div>아이디 찾기 페이지</div>} />
          <Route path="/find-password" element={<div>비밀번호 찾기 페이지</div>} />
          
          {/* 관리자용 유저 목록 페이지 */}
          <Route path="/management" element={<UserListPage />} />
          
          {/* 개인 프로필 페이지 */}
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
