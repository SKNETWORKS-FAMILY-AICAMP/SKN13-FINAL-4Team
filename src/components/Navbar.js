// frontend/src/components/Navbar.js

import React from 'react';

function Navbar() {
  return (
    // Bootstrap Navbar
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container-fluid">
        {/* 사이트 로고 또는 이름 */}
        <a className="navbar-brand" href="/">Influencer App</a>
        
        {/* 모바일 화면용 토글 버튼 */}
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
          <span className="navbar-toggler-icon"></span>
        </button>
        
        {/* 메뉴 링크 */}
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav">
            <li className="nav-item">
              <a className="nav-link active" aria-current="page" href="/">홈</a>
            </li>
            <li className="nav-item">
              <a className="nav-link" href="/chat/lobby">채팅</a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;