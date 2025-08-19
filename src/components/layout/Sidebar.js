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
                <li className="sidebar-item">
                    <NavLink to="/staff/create" className="sidebar-link">
                        채팅방 생성
                    </NavLink>
                </li>
                <li className="sidebar-item">
                    <NavLink to="/staff/management_room" className="sidebar-link">
                        채팅방 관리
                    </NavLink>
                </li>
            </ul>
        </nav>
    );
}

export default Sidebar;