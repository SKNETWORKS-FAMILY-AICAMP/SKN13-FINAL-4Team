import React from 'react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css'; // Sidebar 전용 CSS

function Sidebar() {
    return (
        <nav className="sidebar">
            <div className="sidebar-header">
                관리자 메뉴
            </div>
            <ul className="sidebar-nav">
                <li className="sidebar-item">
                    {/* NavLink는 현재 경로와 일치할 때 active 클래스를 자동으로 추가해 줍니다. */}
                    <NavLink to="/management/userlist" className="sidebar-link">
                        사용자 관리
                    </NavLink>
                </li>
                <li className="sidebar-item">
                    <NavLink to="/staff/create" className="sidebar-link">
                        방송 생성
                    </NavLink>
                </li>
                <li className="sidebar-item">
                    <NavLink to="/staff/management" className="sidebar-link">
                        방송 관리
                    </NavLink>
                </li>
                <li className="sidebar-item">
                    <NavLink to="/staff/influencers" className="sidebar-link">
                        인플루언서 관리
                    </NavLink>
                </li>
                <li className="sidebar-item">
                    <NavLink to="/debug/tts" className="sidebar-link">
                        TTS 디버그
                    </NavLink>
                </li>
            </ul>
        </nav>
    );
}

export default Sidebar;
