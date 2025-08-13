import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Dropdown, Image, Button } from 'react-bootstrap';
import axios from 'axios';

function Navbar({ isLoggedIn, onLogout }) {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      const accessToken = localStorage.getItem('accessToken');
      if (isLoggedIn && accessToken) {
        try {
          const response = await axios.get('http://localhost:8000/api/users/me/', {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          setUser(response.data);
        } catch (err) {
          console.error("Failed to fetch user data", err);
          if (err.response && (err.response.status === 401 || err.response.status === 403)) {
            onLogout();
          }
        }
      } else if (!isLoggedIn) {
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
      href=""
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
    <nav className="navbar navbar-expand navbar-dark bg-dark">
      <div className="container-fluid">
        <Link className="navbar-brand" to="/">Influencer App</Link>
        <ul className="navbar-nav ms-auto">
          {isLoggedIn ? (
            <Dropdown as="li" className="nav-item" align="end">
              <Dropdown.Toggle as={CustomToggle} id="profile-dropdown-toggle">
                프로필
              </Dropdown.Toggle>

              <Dropdown.Menu 
                className="p-3" 
                style={{ width: '280px', top: '120%' }}
              >
                {user ? (
                  <>
                    <div className="d-flex align-items-center mb-3">
                      <Image src={user.profile_image ? `http://localhost:8000${user.profile_image}` : `http://localhost:8000/media/profile_pics/default_profile.png`} roundedCircle  style={{ width: '40px', height: '40px', objectFit: 'cover' }} />
                      <div className="ms-3">
                        <h6 className="mb-0">{user.nickname || user.username}</h6>
                        <div className="text-muted" style={{ fontSize: '0.9rem' }}>{user.email}</div>
                      </div>
                    </div>
                    <div className="mb-3">
                      <small>보유 크레딧</small>
                      <h5>1,000 C</h5>
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
              <Link className="nav-link" to="/login">로그인</Link>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
}

export default Navbar;