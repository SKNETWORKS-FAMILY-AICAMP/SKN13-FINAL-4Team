import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Table, Spinner, Alert, Form, Pagination, InputGroup, Button, Row, Col, Badge } from 'react-bootstrap';
import api from '../../api';
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

    const formatDateTimeLocal = (isoString) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        // KST (UTC+9) 오프셋을 적용하여 한국 시간으로 변환
        const kstOffset = 9 * 60 * 60 * 1000;
        const kstDate = new Date(date.getTime() + kstOffset);
        return kstDate.toISOString().slice(0, 16);
    };

    const fetchUsers = useCallback(async (page, query) => {
        setLoading(true);
        try {
            // [수정] api 모듈을 사용하고, URL 파라미터를 params 객체로 전달
            const response = await api.get('/api/users/management/', {
                params: {
                    page: page,
                    search: query || undefined // query가 비어있으면 파라미터에서 제외
                }
            });
            
            const userList = response.data.results || [];
            setUsers(userList);

            const initialDates = {};
            userList.forEach(user => {
                initialDates[user.id] = formatDateTimeLocal(user.sanctioned_until);
            });
            setSanctionDates(initialDates);
            
            const itemsPerPage = 30; // 백엔드 페이지네이션 설정과 일치해야 함
            setTotalPages(Math.ceil(response.data.count / itemsPerPage));
        } catch (err) {
            setError('사용자 목록을 불러오는 데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const checkAdmin = async () => {
            try {
                // [수정] api 모듈을 사용하여 요청
                const meResponse = await api.get('/api/users/me/');
                setCurrentUser(meResponse.data);
                if (!meResponse.data.is_staff) {
                    setError('접근 권한이 없습니다.');
                    setLoading(false);
                }
            } catch (err) {
                // api 모듈의 인터셉터가 토큰 만료 시 로그인 페이지로 리디렉션 처리
                setError('인증에 실패했습니다. 다시 로그인해주세요.');
                setLoading(false);
            }
        };
        checkAdmin();
    }, [navigate]);

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
        const newStatus = !userToUpdate.is_staff;
        if (window.confirm(`${userToUpdate.username} 님의 관리자 권한을 ${newStatus ? '부여' : '해제'}하시겠습니까?`)) {
            try {
                // [수정] api 모듈을 사용하여 요청
                await api.patch(`/api/users/management/${userToUpdate.id}/`, { is_staff: newStatus });
                setUsers(users.map(u => 
                    u.id === userToUpdate.id ? { ...u, is_staff: newStatus } : u
                ));
            } catch (err) {
                alert('권한 변경에 실패했습니다.');
            }
        }
    };

    const handleUpdateSanction = async (userToUpdate) => {
        const newDate = sanctionDates[userToUpdate.id] || null;
        const utcDate = newDate ? new Date(newDate).toISOString() : null;

        try {
            // [수정] api 모듈을 사용하여 요청
            await api.patch(`/api/users/management/${userToUpdate.id}/`, { sanctioned_until: utcDate });
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