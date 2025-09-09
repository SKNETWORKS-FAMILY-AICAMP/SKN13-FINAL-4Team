import React from 'react';
import { NavLink } from 'react-router-dom';
import styles from './Sidebar.module.css';

function Sidebar() {
    return (
        <nav className="sidebar">
            <ul className="sidebar-nav">
                <li className="sidebar-item">
                    <NavLink to="/management" className={({ isActive }) => `${styles.sidebarLink} ${isActive ? styles.active : ''}`}>
                        사용자 관리
                    </NavLink>
                </li>
                <li>
                    <NavLink to="/staff/create" className={({ isActive }) => `${styles.sidebarLink} ${isActive ? styles.active : ''}`}>
                        방송 생성
                    </NavLink>
                </li>
                <li>
                    <NavLink to="/staff/management" className={({ isActive }) => `${styles.sidebarLink} ${isActive ? styles.active : ''}`}>
                        방송 관리
                    </NavLink>
                </li>
                <li className="sidebar-item">
                    <NavLink to="/staff/influencers" className={({ isActive }) => `${styles.sidebarLink} ${isActive ? styles.active : ''}`}>
                        인플루언서 관리
                    </NavLink>
                </li>
                <li className="sidebar-item">
                    <NavLink to="/debug/tts" className={({ isActive }) => `${styles.sidebarLink} ${isActive ? styles.active : ''}`}>
                        TTS 디버그
                    </NavLink>
                </li>
            </ul>
        </nav>
    );
}

export default Sidebar;
