import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Container, Table, Spinner, Alert, Form, Pagination } from 'react-bootstrap';

function UserListPage() {
    const [users, setUsers] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);

    const fetchUsers = useCallback(async (page) => {
        const accessToken = localStorage.getItem('accessToken');
        if (!accessToken) return;

        setLoading(true);
        try {
            const response = await axios.get(`http://localhost:8000/api/users/management/?page=${page}`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            
            const userList = response.data.results || [];
            setUsers(userList);
            
            const itemsPerPage = 30;
            setTotalPages(Math.ceil(response.data.count / itemsPerPage));
        } catch (err) {
            setError('사용자 목록을 불러오는 데 실패했습니다.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const checkAdmin = async () => {
            const accessToken = localStorage.getItem('accessToken');
            if (!accessToken) {
                navigate('/login');
                return;
            }
            try {
                const meResponse = await axios.get('http://localhost:8000/api/users/me/', {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                setCurrentUser(meResponse.data);
                if (!meResponse.data.is_staff) {
                    setError('접근 권한이 없습니다.');
                    setLoading(false);
                }
            } catch (err) {
                setError('인증에 실패했습니다. 다시 로그인해주세요.');
                setLoading(false);
            }
        };
        checkAdmin();
    }, [navigate]);

    useEffect(() => {
        if (currentUser && currentUser.is_staff) {
            fetchUsers(currentPage);
        }
    }, [currentUser, currentPage, fetchUsers]);

    const handleAdminToggle = async (userToUpdate) => {
        if (currentUser && currentUser.username === userToUpdate.username) {
            alert('자기 자신의 권한은 변경할 수 없습니다.');
            return;
        }

        const accessToken = localStorage.getItem('accessToken');
        const newStatus = !userToUpdate.is_staff;

        if (window.confirm(`${userToUpdate.username} 님의 관리자 권한을 ${newStatus ? '부여' : '해제'}하시겠습니까?`)) {
            try {
                await axios.patch(`http://localhost:8000/api/users/management/${userToUpdate.id}/`, 
                    { is_staff: newStatus },
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                );
                setUsers(users.map(u => 
                    u.id === userToUpdate.id ? { ...u, is_staff: newStatus } : u
                ));
            } catch (err) {
                alert('권한 변경에 실패했습니다.');
                console.error(err);
            }
        }
    };

    const handlePageChange = (pageNumber) => {
        setCurrentPage(pageNumber);
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
                                    disabled={currentUser && currentUser.username === user.username}
                                    label={user.is_staff ? 'Admin' : 'User'}
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </Table>

            {totalPages > 1 && (
                <Pagination className="justify-content-center">
                    {Array.from({ length: totalPages }, (_, index) => (
                        <Pagination.Item
                            key={index + 1}
                            active={index + 1 === currentPage}
                            onClick={() => handlePageChange(index + 1)}
                        >
                            {index + 1}
                        </Pagination.Item>
                    ))}
                </Pagination>
            )}
        </Container>
    );
}

export default UserListPage;