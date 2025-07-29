// frontend/src/App.js

import React from 'react';
import ChatComponent from './components/ChatComponent'; // ChatComponent 불러오기
import './App.css';

function App() {
  return (
    // 전체 화면을 어두운 배경으로 설정
    <div className="bg-dark vh-100">
      <ChatComponent />
    </div>
  );
}

export default App;