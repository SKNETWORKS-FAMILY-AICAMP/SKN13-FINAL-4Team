// src/components/layout/Sidebar.js

import React from 'react';
import { NavLink } from 'react-router-dom';
import styles from './Sidebar.module.css';

function Sidebar() {
    return (
        <nav className={styles.sidebar}>
            <ul className={styles.sidebarNav}>
                <li>
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
            </ul>
        </nav>
    );
}

export default Sidebar;