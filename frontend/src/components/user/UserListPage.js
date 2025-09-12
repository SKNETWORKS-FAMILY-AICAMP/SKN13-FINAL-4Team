import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Container, Table, Spinner, Alert, Form, Pagination, InputGroup, Button, Row, Col, Badge } from 'react-bootstrap';
import Sidebar from '../layout/Sidebar';

function UserListPage() {
    const [users, setUsers] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);

    const [searchTerm, setSearchTerm] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const [sanctionDates, setSanctionDates] = useState({});

    // [수정] 백엔드 API 기본 주소를 환경 변수에서 가져오도록 설정
    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

    const formatDateTimeLocal = (isoString) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        const kstOffset = 9 * 60 * 60 * 1000;
        const kstDate = new Date(date.getTime() + kstOffset);
        return kstDate.toISOString().slice(0, 16);
    };

    const fetchUsers = useCallback(async (page, query) => {
        const accessToken = localStorage.getItem('accessToken');
        if (!accessToken) return;

        setLoading(true);
        try {
            // [수정] API 주소에 apiBaseUrl 변수 사용
            let url = `${apiBaseUrl}/api/users/management/?page=${page}`;
            if (query) {
                url += `&search=${query}`;
            }

            const response = await axios.get(url, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            
            const userList = response.data.results || [];
            setUsers(userList);

            const initialDates = {};
            userList.forEach(user => {
                initialDates[user.id] = formatDateTimeLocal(user.sanctioned_until);
            });
            setSanctionDates(initialDates);
            
            const itemsPerPage = 30;
            setTotalPages(Math.ceil(response.data.count / itemsPerPage));
        } catch (err) {
            setError('사용자 목록을 불러오는 데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    }, [apiBaseUrl]); // apiBaseUrl을 의존성 배열에 추가

    useEffect(() => {
        const checkAdmin = async () => {
            const accessToken = localStorage.getItem('accessToken');
            if (!accessToken) navigate('/login');
            try {
                // [수정] API 주소에 apiBaseUrl 변수 사용
                const meResponse = await axios.get(`${apiBaseUrl}/api/users/me/`, {
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
    }, [navigate, apiBaseUrl]); // apiBaseUrl을 의존성 배열에 추가

    useEffect(() => {
        if (currentUser && currentUser.is_staff) {
            fetchUsers(currentPage, searchQuery);
        }
    }, [currentUser, currentPage, searchQuery, fetchUsers]);

    const handleAdminToggle = async (userToUpdate) => {
        if (currentUser && currentUser.username === userToUpdate.username) {
            alert('자기 자신의 권한은 변경할 수 없습니다.');
            return;
        }
        const accessToken = localStorage.getItem('accessToken');
        const newStatus = !userToUpdate.is_staff;
        if (window.confirm(`${userToUpdate.username} 님의 관리자 권한을 ${newStatus ? '부여' : '해제'}하시겠습니까?`)) {
            try {
                // [수정] API 주소에 apiBaseUrl 변수 사용
                await axios.patch(`${apiBaseUrl}/api/users/management/${userToUpdate.id}/`, 
                    { is_staff: newStatus },
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                );
                setUsers(users.map(u => 
                    u.id === userToUpdate.id ? { ...u, is_staff: newStatus } : u
                ));
            } catch (err) {
                alert('권한 변경에 실패했습니다.');
            }
        }
    };

    const handleDateChange = (userId, date) => {
        setSanctionDates(prev => ({ ...prev, [userId]: date }));
    };

    const handleUpdateSanction = async (userToUpdate) => {
        const newDate = sanctionDates[userToUpdate.id] || null;
        const utcDate = newDate ? new Date(newDate).toISOString() : null;

        const accessToken = localStorage.getItem('accessToken');
        try {
            // [수정] API 주소에 apiBaseUrl 변수 사용
            await axios.patch(`${apiBaseUrl}/api/users/management/${userToUpdate.id}/`, 
                { sanctioned_until: utcDate },
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            alert('제재일시가 성공적으로 업데이트되었습니다.');
            fetchUsers(currentPage, searchQuery);
        } catch (err) {
            alert('제재일시 업데이트에 실패했습니다.');
            console.error(err);
        }
    };

    const handlePageChange = (pageNumber) => setCurrentPage(pageNumber);
    const handleSearch = (e) => {
        e.preventDefault();
        setCurrentPage(1);
        setSearchQuery(searchTerm);
    };
    const handleShowAll = () => {
        setSearchTerm('');
        setSearchQuery('');
        setCurrentPage(1);
    };

    if (loading) return <Container className="d-flex justify-content-center mt-5"><Spinner animation="border" /></Container>;
    if (error) return <Container className="mt-5"><Alert variant="danger">{error}</Alert></Container>;

    return (
        <div className="admin-page-wrapper">
            <Sidebar />
            <Container className="admin-content-container">
                <h2 className="mb-4">사용자 관리</h2>

                <Form onSubmit={handleSearch} className="mb-4">
                    <Row className="justify-content-center">
                        <Col xs={12} md={8} lg={6}>
                            <InputGroup>
                                <Form.Control
                                    type="text"
                                    placeholder="ID 또는 닉네임으로 검색"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <Button type="submit" variant="primary">검색</Button>
                                <Button variant="outline-secondary" onClick={handleShowAll}>전체 보기</Button>
                            </InputGroup>
                        </Col>
                    </Row>
                </Form>

                <Table striped bordered hover responsive>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Username</th>
                            <th>Nickname</th>
                            <th>Email</th>
                            <th>관리자 권한</th>
                            <th>제재 만료일</th>
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
                                <td>
                                    {user.is_sanctioned && <Badge bg="danger" className="me-2">제재 중</Badge>}
                                    <InputGroup size="sm">
                                        <Form.Control
                                            type="datetime-local"
                                            value={sanctionDates[user.id] || ''}
                                            onChange={(e) => handleDateChange(user.id, e.target.value)}
                                        />
                                        <Button variant="outline-secondary" onClick={() => handleUpdateSanction(user)}>
                                            저장
                                        </Button>
                                    </InputGroup>
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
        </div>
    );
}

export default UserListPage;