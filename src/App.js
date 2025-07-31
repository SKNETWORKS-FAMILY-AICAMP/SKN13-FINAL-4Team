import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SignupForm from './components/SignupForm';
import LoginForm from './components/LoginForm'; 
import TermsPage from './components/TermsPage';
import UserListPage from './components/UserListPage';
import ProfilePage from './components/ProfilePage';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/signup/terms" element={<TermsPage />} />  # 이용약관 페이지
          <Route path="/signup" element={<SignupForm />} /> # 회원가입 페이지
          <Route path="/login" element={<LoginForm />} /> # 로그인 페이지
          <Route path="/find-id" element={<div>아이디 찾기 페이지</div>} /> # 아이디 찾기 페이지
          <Route path="/find-password" element={<div>비밀번호 찾기 페이지</div>} /> # 비밀번호 찾기 페이지
          <Route path="/management/userlist" element={<UserListPage />} /> # 유저 관리페이지
          <Route path="/profile" element={<ProfilePage />} /> # 유저 관리페이지
        </Routes>
      </div>
    </Router>
  );
}

export default App;