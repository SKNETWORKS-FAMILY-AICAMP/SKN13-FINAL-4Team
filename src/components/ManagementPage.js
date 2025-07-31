import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Container, Card, Spinner, Alert, ListGroup } from 'react-bootstrap';

function ManagementPage() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchUserData = async () => { // 함수 이름 변경 (선택 사항)
            const accessToken = localStorage.getItem('accessToken');
            if (!accessToken) {
                alert('로그인이 필요합니다.');
                navigate('/login');
                return;
            }
            try {
                const response = await axios.get('http://localhost:8000/users/me/', {
                    headers: {
                        Authorization: `Bearer ${accessToken}`
                    }
                });
                setUser(response.data);
            } catch (err) {
                setError('계정 정보를 불러오는 데 실패했습니다. 다시 로그인해주세요.');
                if (err.response && err.response.status === 401) {
                    localStorage.removeItem('accessToken');
                    navigate('/login');
                }
            } finally {
                setLoading(false);
            }
        };
        fetchUserData();
    }, [navigate]);

    if (loading) {
        return <Container className="d-flex justify-content-center mt-5"><Spinner animation="border" /></Container>;
    }

    if (error) {
        return <Container className="mt-5"><Alert variant="danger">{error}</Alert></Container>;
    }

    return (
        <Container className="mt-5">
            <Card style={{ maxWidth: '500px', margin: 'auto' }}>
                <Card.Header as="h5" className="text-center">계정 관리</Card.Header> {/* 텍스트 변경 */}
                <Card.Body>
                    {user && (
                        <ListGroup variant="flush">
                            <ListGroup.Item>
                                <strong>ID:</strong> {user.username}
                            </ListGroup.Item>
                            <ListGroup.Item>
                                <strong>닉네임:</strong> {user.nickname}
                            </ListGroup.Item>
                            <ListGroup.Item>
                                <strong>이메일:</strong> {user.email}
                            </ListGroup.Item>
                            <ListGroup.Item>
                                <strong>가입일:</strong> {new Date(user.date_joined).toLocaleDateString()}
                            </ListGroup.Item>
                        </ListGroup>
                    )}
                </Card.Body>
            </Card>
        </Container>
    );
}

export default ManagementPage; // 컴포넌트 이름 변경