// src/components/layout/Sidebar.js

import React from 'react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css'; // 사이드바 스타일을 위한 CSS 파일

function Sidebar() {
    return (
        <nav className="sidebar">
            <ul className="sidebar-nav">
                <li className="sidebar-item">
                    {/* NavLink는 현재 경로와 일치할 때 active 클래스를 자동으로 추가해 줍니다. */}
                    <NavLink to="/management" className="sidebar-link">
                        사용자 관리
                    </NavLink>
                </li>
                {/* 다른 관리자 메뉴가 있다면 여기에 추가 */}
            </ul>
        </nav>
    );
}

export default Sidebar;