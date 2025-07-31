import React from 'react';
import { Link } from 'react-router-dom';

// App.js로부터 isLoggedIn prop만 받습니다.
function Navbar({ isLoggedIn }) {
  return (
    <nav className="navbar navbar-expand navbar-dark bg-dark">
      <div className="container-fluid">
        {/* 1. 배너(브랜드)를 누르면 홈 화면으로 이동합니다. */}
        <Link className="navbar-brand" to="/">Influencer App</Link>

        {/* 2. 오른쪽 버튼: ms-auto 클래스로 오른쪽 정렬합니다. */}
        <ul className="navbar-nav ms-auto">
          {isLoggedIn ? (
            // 로그인 상태일 때: "프로필" 버튼
            <li className="nav-item">
              <Link className="nav-link" to="/profile">프로필</Link>
            </li>
          ) : (
            // 로그아웃 상태일 때: "로그인" 버튼
            <li className="nav-item">
              <Link className="nav-link" to="/login">로그인</Link>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
}

export default Navbar;