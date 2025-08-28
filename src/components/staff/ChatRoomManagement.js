import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Table, Spinner, Alert, Button, Badge, Modal, Form } from 'react-bootstrap';
import Sidebar from '../layout/Sidebar';
import api from '../../api';

function ChatRoomManagement() {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [editFormData, setEditFormData] = useState({});
    
    const [editThumbnailFile, setEditThumbnailFile] = useState(null);
    const [editThumbnailPreview, setEditThumbnailPreview] = useState('');
    const fileInputRef = useRef(null);

    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || '';

    const fetchRooms = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get(`/api/chat/rooms/`);
            const roomsData = response.data?.results || (Array.isArray(response.data) ? response.data : []);
            setRooms(roomsData);
        } catch (err) {
            if (err.response?.status === 401) {
                alert('세션이 만료되었거나 로그인이 필요합니다.');
                navigate('/login');
            } else {
                setError('방송 목록을 불러오는 데 실패했습니다.');
            }
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        fetchRooms();
    }, [fetchRooms]);

    const handleEdit = (room) => {
        setSelectedRoom(room);
        setEditFormData({
            name: room.name,
            description: room.description,
            status: room.status,
        });
        // [수정] 모달의 썸네일 미리보기 URL 생성 로직
        const thumbnailUrl = room.thumbnail && (room.thumbnail.startsWith('http') || room.thumbnail.startsWith('/media'))
            ? room.thumbnail.startsWith('http') ? room.thumbnail : `${apiBaseUrl}${room.thumbnail}`
            : ''; // 이미지가 없을 경우 빈 문자열
        setEditThumbnailPreview(thumbnailUrl);
        setShowEditModal(true);
    };

    const handleCloseModal = () => {
        setShowEditModal(false);
        setSelectedRoom(null);
        setEditFormData({});
        setEditThumbnailFile(null);
        setEditThumbnailPreview('');
    };
    
    const handleEditFormChange = (e) => {
        const { name, value } = e.target;
        setEditFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleEditThumbnailChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setEditThumbnailFile(file);
            setEditThumbnailPreview(URL.createObjectURL(file));
        }
    };

    const handleUpdate = useCallback(async (e) => {
        e.preventDefault();
        if (!selectedRoom) return;

        const submissionData = new FormData();
        Object.keys(editFormData).forEach(key => {
            submissionData.append(key, editFormData[key]);
        });

        if (editThumbnailFile) {
            submissionData.append('thumbnail', editThumbnailFile);
        }

        try {
            await api.patch(`/api/chat/rooms/${selectedRoom.id}/`, submissionData, { 
                headers: { 'Content-Type': 'multipart/form-data' } 
            });
            alert('방송 정보가 성공적으로 수정되었습니다.');
            handleCloseModal();
            fetchRooms();
        } catch (err) {
            alert('정보 수정에 실패했습니다.');
            console.error(err);
        }
    }, [selectedRoom, editFormData, editThumbnailFile, fetchRooms]);

    const handleDelete = useCallback(async (roomId, roomName) => {
        if (window.confirm(`'${roomName}' 방송을 정말로 삭제하시겠습니까?`)) {
            try {
                await api.delete(`/api/chat/rooms/${roomId}/`);
                alert('방송이 삭제되었습니다.');
                fetchRooms();
            } catch (err) {
                alert('방송 삭제에 실패했습니다.');
                console.error(err);
            }
        }
    }, [fetchRooms]);

    const getStatusBadge = (status) => {
        switch (status) {
            case 'live': return <Badge bg="danger">방송중</Badge>;
            case 'pending': return <Badge bg="warning">준비중</Badge>;
            case 'finished': return <Badge bg="secondary">방송종료</Badge>;
            default: return <Badge bg="dark">{status}</Badge>;
        }
    };
    
    if (loading) return <Container className="d-flex justify-content-center mt-5"><Spinner animation="border" /></Container>;
    if (error) return <Container className="mt-5"><Alert variant="danger">{error}</Alert></Container>;

    return (
        <div className="admin-page-wrapper">
            <Sidebar />
            <Container className="admin-content-container">
                <h2 className="mb-4">방송 관리</h2>
                <Table striped bordered hover responsive>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>썸네일</th>
                            <th>방송 제목</th>
                            <th>인플루언서</th>
                            <th>상태</th>
                            <th>생성일</th>
                            <th>관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rooms.map(room => {
                            const thumbnailUrl = room.thumbnail && (room.thumbnail.startsWith('http') || room.thumbnail.startsWith('/media'))
                                ? room.thumbnail.startsWith('http') ? room.thumbnail : `${apiBaseUrl}${room.thumbnail}`
                                : 'https://via.placeholder.com/80x45';

                            return (
                                <tr key={room.id}>
                                    <td>{room.id}</td>
                                    <td>
                                        <img 
                                            src={thumbnailUrl} 
                                            alt={room.name} 
                                            style={{ width: '80px', height: '45px', objectFit: 'cover' }}
                                        />
                                    </td>
                                    <td>{room.name}</td>
                                    <td>{room.influencer_nickname || 'N/A'}</td>
                                    <td>{getStatusBadge(room.status)}</td>
                                    <td>{new Date(room.created_at).toLocaleString('ko-KR')}</td>
                                    <td>
                                        <Button variant="outline-primary" size="sm" className="me-2" onClick={() => handleEdit(room)}>
                                            수정
                                        </Button>
                                        <Button variant="outline-danger" size="sm" onClick={() => handleDelete(room.id, room.name)}>
                                            삭제
                                        </Button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </Table>
            </Container>

            {selectedRoom && (
                <Modal show={showEditModal} onHide={handleCloseModal} centered>
                    <Modal.Header closeButton>
                        <Modal.Title>방송 정보 수정</Modal.Title>
                    </Modal.Header>
                    <Form onSubmit={handleUpdate}>
                        <Modal.Body>
                            <Form.Group className="mb-3 text-center">
                                <Form.Label>썸네일 이미지</Form.Label>
                                <div className="thumbnail-preview mx-auto mb-2">
                                    {editThumbnailPreview ? (
                                        <img src={editThumbnailPreview} alt="썸네일 미리보기" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div className="thumbnail-placeholder d-flex align-items-center justify-content-center h-100">이미지 없음</div>
                                    )}
                                </div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleEditThumbnailChange}
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                />
                                <Button variant="outline-secondary" size="sm" onClick={() => fileInputRef.current.click()}>
                                    이미지 변경
                                </Button>
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label>방송 제목</Form.Label>
                                <Form.Control 
                                    type="text"
                                    name="name"
                                    value={editFormData.name || ''}
                                    onChange={handleEditFormChange}
                                />
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label>방송 설명</Form.Label>
                                <Form.Control 
                                    as="textarea"
                                    rows={3}
                                    name="description"
                                    value={editFormData.description || ''}
                                    onChange={handleEditFormChange}
                                />
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label>방송 상태</Form.Label>
                                <Form.Select
                                    name="status"
                                    value={editFormData.status || ''}
                                    onChange={handleEditFormChange}
                                >
                                    <option value="pending">준비중</option>
                                    <option value="live">방송중</option>
                                    <option value="finished">방송종료</option>
                                </Form.Select>
                            </Form.Group>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="secondary" onClick={handleCloseModal}>
                                취소
                            </Button>
                            <Button variant="primary" type="submit">
                                변경사항 저장
                            </Button>
                        </Modal.Footer>
                    </Form>
                </Modal>
            )}
        </div>
    );
}

export default ChatRoomManagement;