// // frontend/src/App.js

// import React from 'react';
// import ChatComponent from './components/ChatComponent'; // ChatComponent 불러오기
// import './App.css';

// function App() {
//   return (
//     // 전체 화면을 어두운 배경으로 설정
//     <div className="bg-dark vh-100">
//       <ChatComponent />
//     </div>
//   );
// }

// export default App;

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SignupForm from './components/SignupForm';
import LoginForm from './components/LoginForm'; 

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/signup" element={<SignupForm />} />
          {/* '/login' 경로에 LoginForm 컴포넌트를 연결합니다. */}
          <Route path="/login" element={<LoginForm />} />
          {/* 아이디/비밀번호 찾기 라우트 추가 */}
          <Route path="/find-id" element={<div>아이디 찾기 페이지</div>} />
          <Route path="/find-password" element={<div>비밀번호 찾기 페이지</div>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;