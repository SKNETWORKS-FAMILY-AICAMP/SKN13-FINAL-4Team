import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Dropdown, Button } from 'react-bootstrap';
import styles from './Navbar.module.css';
import api from '../../utils/unifiedApiClient';

function Navbar({ isLoggedIn, onLogout, userBalance }) {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState(() => (document.documentElement.getAttribute('data-theme') || 'light'));
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      if (isLoggedIn) {
        try {
          // App.js에서 이미 토큰 유효성 검사를 하므로 여기서는 호출만 함
          const response = await api.get('/api/users/me/');
          setUser(response.data);
        } catch (err) {
          console.error("Failed to fetch user data in Navbar", err);
          // 에러 발생 시 App.js에서 처리하므로 여기서는 로그아웃만 호출
          onLogout();
        }
      } else {
        setUser(null);
      }
    };
    fetchUserData();
  }, [isLoggedIn, onLogout]);

  const handleLogout = () => {
    onLogout();
    navigate('/');
  };

  // Custom Dropdown Toggle
  const CustomToggle = React.forwardRef(({ children, onClick }, ref) => (
    <a
      href="/"
      ref={ref}
      onClick={(e) => {
        e.preventDefault();
        onClick(e);
      }}
      className="nav-link"
    >
      {children}
    </a>
  ));

  return (
    <nav className="navbar navbar-expand" style={{ backgroundColor: 'var(--color-surface)' }}>
      <div className="container-fluid">
        <Link className="navbar-brand" to="/" style={{ color: 'var(--brand)' }}>Love Language Model</Link>
        <ul className="navbar-nav ms-auto align-items-center">
          <li className="nav-item me-3">
            <button
              className={`${styles.themeToggleBtn} ${styles.iconBtn}`}
              onClick={() => {
                const next = theme === 'light' ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', next);
                setTheme(next);
              }}
              title="테마 전환"
            >
              {theme === 'light' ? (
                // Light → Dark 전환 버튼: 달 아이콘(#262323)
                <svg className={styles.iconSvg} viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#262323" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              ) : (
                // Dark → Light 전환 버튼: 태양 아이콘(#F5F5F5)
                <svg className={styles.iconSvg} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="5" fill="#F5F5F5"/>
                  <g stroke="#F5F5F5" strokeWidth="2">
                    <line x1="12" y1="1" x2="12" y2="4"/>
                    <line x1="12" y1="20" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/>
                    <line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="4" y2="12"/>
                    <line x1="20" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/>
                    <line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/>
                  </g>
                </svg>
              )}
            </button>
          </li>
          {isLoggedIn ? (
            <Dropdown as="li" className="nav-item" align="end">
              <Dropdown.Toggle as={CustomToggle} id="profile-dropdown-toggle">
                {user ? (
                  <img
                    src={user.profile_image ? `http://localhost:8000${user.profile_image}` : `http://localhost:8000/media/profile_pics/default_profile.png`}
                    alt="Profile"
                    className={`${styles.profileToggleImage}`}
                    title="프로필"
                  />
                ) : (
                  <span className="placeholder rounded-circle" style={{ display: 'inline-block', width: '32px', height: '32px', backgroundColor: 'rgba(0,0,0,0.1)' }} />
                )}
              </Dropdown.Toggle>

              <Dropdown.Menu 
                className={`p-3 ${styles.profileMenu}`} 
                style={{ width: '280px', top: '120%' }}
              >
                {user ? (
                  <>
                    <div className="d-flex align-items-center mb-3">
                      <img
                        src={user.profile_image ? `http://localhost:8000${user.profile_image}` : `http://localhost:8000/media/profile_pics/default_profile.png`}
                        alt="Profile"
                        className="rounded-circle"
                        style={{ width: '40px', height: '40px', objectFit: 'cover' }}
                      />
                      <div className="ms-3">
                        <h6 className="mb-0" style={{ color: 'var(--color-text)' }}>{user.nickname || user.username}</h6>
                        <div className="text-muted" style={{ fontSize: '0.9rem' }}>{user.email}</div>
                      </div>
                    </div>
                    <div className="mb-3">
                      <small>보유 크레딧</small>
                      {/* App.js로부터 받은 userBalance를 표시 */}
                      <h5 style={{ color: 'var(--color-text)' }}>{userBalance?.toLocaleString() || '0'} C</h5>
                    </div>
                    <Dropdown.Divider />
                    <Button as={Link} to="/profile" variant="outline-primary" className="w-100 mb-2">
                      프로필 수정
                    </Button>
                    <Button variant="outline-danger" className="w-100" onClick={handleLogout}>
                      로그아웃
                    </Button>
                  </>
                ) : (
                  <div className="text-center">로딩 중...</div>
                )}
              </Dropdown.Menu>
            </Dropdown>
          ) : (
            <li className="nav-item">
              <Link className="nav-link" to="/login" style={{ color: 'var(--color-text)' }}>로그인</Link>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
}

export default Navbar;