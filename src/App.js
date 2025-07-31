import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios'; // axios 임포트
import Navbar from './components/Navbar';
import SignupForm from './components/SignupForm';
import LoginForm from './components/LoginForm';
import TermsPage from './components/TermsPage';
import UserListPage from './components/UserListPage';
import ProfilePage from './components/ProfilePage';
import StreamingPage from './components/StreamingPage';
import HomeTemporary from './components/HomeTemporary';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');

  // 사용자 정보를 가져와 상태를 설정하는 함수
  const fetchAndSetUser = async (token) => {
    try {
      // 1. 토큰 유효성 검사 (만료 시간)
      const decoded = jwtDecode(token);
      if (decoded.exp * 1000 < Date.now()) {
        throw new Error('Token expired');
      }
      
      // 2. 서버에서 사용자 정보 가져오기
      const response = await axios.get('http://localhost:8000/api/users/me/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // 3. 상태 업데이트
      setIsLoggedIn(true);
      // 닉네임이 있으면 닉네임을, 없으면 username을 사용
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