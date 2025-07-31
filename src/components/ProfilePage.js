import React, { useState, useEffect } from 'react';
// axios, useNavigate를 잠시 사용하지 않으므로 주석 처리하거나 지울 수 있습니다.
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Container, Card, ListGroup } from 'react-bootstrap';

function ProfilePage() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    useEffect(() => {
        const fetchUserData = async () => {
            const accessToken = localStorage.getItem('accessToken');
            if (!accessToken) {
                alert('로그인이 필요합니다.');
                navigate('/login');
                return;
            }
            try {
                const response = await axios.get('http://localhost:8000/api/users/me/', {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                setUser(response.data);
            } catch (err) {
                // ... 에러 처리 ...
            } finally {
                setLoading(false);
            }
        };
        fetchUserData();
    }, []); 

    if (loading) { /* ... */ }
    if (!user) { return <div>사용자 정보가 없습니다.</div>}

    return (
        <Container className="mt-5">
            <Card style={{ maxWidth: '500px', margin: 'auto' }}>
                <Card.Header as="h5" className="text-center">계정 관리 (테스트)</Card.Header>
                <Card.Body>
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
                </Card.Body>
            </Card>
        </Container>
    );
}

export default ProfilePage;