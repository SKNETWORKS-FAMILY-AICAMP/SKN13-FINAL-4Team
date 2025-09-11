import React, { forwardRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Dropdown, Button } from 'react-bootstrap';
import styles from './Navbar.module.css';
import api from '../../api';

function Navbar({ isLoggedIn, initialUser, onLogout }) {
  const [theme, setTheme] = useState(
    document.documentElement.getAttribute('data-theme') || 'light'
  );
  const [user, setUser] = useState(initialUser || null);
  const navigate = useNavigate();

  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || '';

  useEffect(() => {
    const fetchUserData = async () => {
      if (isLoggedIn) {
        try {
          const response = await api.get('/api/users/me/');
          setUser(response.data);
        } catch (err) {
          console.error("Failed to fetch user data in Navbar", err);
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

  const CustomToggle = forwardRef(({ children, onClick }, ref) => (
    <button
      type="button"
      ref={ref}
      onClick={onClick}
      className="nav-link btn btn-link p-0"
      style={{ textDecoration: 'none' }}
    >
      {children}
    </button>
  ));

  return (
    <nav className={styles.navbar}>
      <div className={styles.containerFluid}>
        <div className={styles.logoGroup}>
          <Link className={styles.logoLink} to="/">
            <img src="/images/logo2.png" alt="LLM" className={styles.logoLlm} />
          </Link>
        </div>
        <ul className={styles.navbarNav}>
          {isLoggedIn && user?.is_staff && (
            <li className={styles.navItem}>
              <Link to="/management" className={`${styles.managementBtn} ${styles.iconBtn}`} title="사이트 관리">
                <svg className={styles.iconSvg} viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11.03L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11.03C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" />
                </svg>
              </Link>
            </li>
          )}
          <li className={styles.navItem}>
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
                <svg className={styles.iconSvg} viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#262323" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg className={styles.iconSvg} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="5" fill="#F5F5F5" />
                  <g stroke="#F5F5F5" strokeWidth="2">
                    <line x1="12" y1="1" x2="12" y2="4" />
                    <line x1="12" y1="20" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" />
                    <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="4" y2="12" />
                    <line x1="20" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
                    <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
                  </g>
                </svg>
              )}
            </button>
          </li>
          {isLoggedIn ? (
            <Dropdown as="li" className={styles.navItem} align="end">
              <Dropdown.Toggle as={CustomToggle} id="profile-dropdown-toggle">
                {user ? (
                  <img
                    src={
                      user.profile_image
                        ? `${apiBaseUrl}${user.profile_image}`
                        : `${apiBaseUrl}/media/profile_pics/default_profile.png`
                    }
                    alt="Profile"
                    className={styles.profileToggleImage}
                    title="프로필"
                  />
                ) : (
                  <div
                    className="placeholder rounded-circle"
                    style={{ display: 'inline-block', width: '32px', height: '32px', backgroundColor: 'rgba(0,0,0,0.1)' }}
                  />
                )}
              </Dropdown.Toggle>
              <Dropdown.Menu className={`p-3 ${styles.profileMenu}`} style={{ width: '280px', top: '120%' }}>
                {user ? (
                  <>
                    <div className="d-flex align-items-center mb-3">
                      <img
                        src={
                          user.profile_image
                            ? `${apiBaseUrl}${user.profile_image}`
                            : `${apiBaseUrl}/media/profile_pics/default_profile.png`
                        }
                        alt="Profile"
                        className="rounded-circle"
                        style={{ width: '40px', height: '40px', objectFit: 'cover' }}
                      />
                      <div className="ms-3">
                        <h6 className="mb-0" style={{ color: 'var(--color-text)' }}>
                          {user.nickname || user.username}
                        </h6>
                        <div className="text-muted" style={{ fontSize: '0.9rem' }}>
                          {user.email}
                        </div>
                      </div>
                    </div>
                    <div className="mb-3">
                      <small>보유 크레딧</small>
                      <h5 style={{ color: 'var(--color-text)' }}>
                        {user.credits?.toLocaleString() || '0'} C
                      </h5>
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
            <li className={styles.navItem}>
              <Link to="/login" className={styles.loginBtn}>
                로그인
              </Link>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
}

export default Navbar;