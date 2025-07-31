import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Container, Table, Spinner, Alert, Form } from 'react-bootstrap';

function UserListPage() {
    const [users, setUsers] = useState([]);
    const [currentUser, setCurrentUser] = useState(null); // 현재 로그인한 사용자 정보
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const checkAdminAndFetchUsers = async () => {
            const accessToken = localStorage.getItem('accessToken');
            if (!accessToken) {
                navigate('/login');
                return;
            }
            
            try {
                // 1. 현재 로그인한 유저 정보를 가져와서 관리자인지 확인
                const meResponse = await axios.get('http://localhost:8000/users/me/', {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                
                setCurrentUser(meResponse.data); // 현재 유저 정보 저장

                if (meResponse.data.is_staff) {
                    // 2. 관리자라면 전체 유저 목록을 불러옴
                    try {
                        const response = await axios.get('http://localhost:8000/admin/users/', {
                            headers: { Authorization: `Bearer ${accessToken}` }
                        });

                        const userList = Array.isArray(response.data) ? response.data : response.data.results;
                        
                        setUsers(userList || []);
                        
                    } catch (err) {
                        setError('사용자 목록을 불러오는 데 실패했습니다.');
                        console.error(err);
                    }
                } else {
                    setError('접근 권한이 없습니다.');
                }
            } catch (err) {
                setError('인증에 실패했습니다. 다시 로그인해주세요.');
            } finally {
                setLoading(false);
            }
        };

        checkAdminAndFetchUsers();
    }, [navigate]);

    const handleAdminToggle = async (userToUpdate) => {
        // 자기 자신의 권한은 변경할 수 없도록 방지
        if (currentUser && currentUser.username === userToUpdate.username) {
            alert('자기 자신의 권한은 변경할 수 없습니다.');
            return;
        }

        const accessToken = localStorage.getItem('accessToken');
        const newStatus = !userToUpdate.is_staff;

        if (window.confirm(`${userToUpdate.username} 님의 관리자 권한을 ${newStatus ? '부여' : '해제'}하시겠습니까?`)) {
            try {
                await axios.patch(`http://localhost:8000/admin/users/${userToUpdate.id}/`, 
                    { is_staff: newStatus },
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                );
                // 성공 시 화면의 사용자 목록을 즉시 업데이트
                setUsers(users.map(u => 
                    u.id === userToUpdate.id ? { ...u, is_staff: newStatus } : u
                ));
            } catch (err) {
                alert('권한 변경에 실패했습니다.');
                console.error(err);
            }
        }
    };

    if (loading) {
        return <Container className="d-flex justify-content-center mt-5"><Spinner animation="border" /></Container>;
    }

    if (error) {
        return <Container className="mt-5"><Alert variant="danger">{error}</Alert></Container>;
    }

    return (
        <Container className="mt-5">
            <h2 className="mb-4">전체 사용자 관리</h2>
            <Table striped bordered hover responsive>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Username</th>
                        <th>Nickname</th>
                        <th>Email</th>
                        <th>관리자 권한</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map(user => (
                        <tr key={user.id}>
                            <td>{user.id}</td>
                            <td>{user.username}</td>
                            <td>{user.nickname}</td>
                            <td>{user.email}</td>
                            <td>
                                <Form.Check 
                                    type="switch"
                                    id={`admin-switch-${user.id}`}
                                    checked={user.is_staff}
                                    onChange={() => handleAdminToggle(user)}
                                    // 자기 자신일 경우 스위치 비활성화
                                    disabled={currentUser && currentUser.username === user.username}
                                    label={user.is_staff ? 'Admin' : 'User'}
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </Table>
        </Container>
    );
}

export default UserListPage;