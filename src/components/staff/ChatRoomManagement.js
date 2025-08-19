
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Container, Table, Spinner, Alert, Button, Badge, Modal, Form } from 'react-bootstrap';
import Sidebar from '../layout/Sidebar';

function ChatRoomManagement() {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [editFormData, setEditFormData] = useState({});
    
    // 모달 내 썸네일 수정을 위한 state
    const [editThumbnailFile, setEditThumbnailFile] = useState(null);
    const [editThumbnailPreview, setEditThumbnailPreview] = useState('');
    const fileInputRef = useRef(null);

    const fetchRooms = useCallback(async () => {
        const accessToken = localStorage.getItem('accessToken');
        if (!accessToken) {
            alert('로그인이 필요합니다.');
            navigate('/login');
            return;
        }
        setLoading(true);
        try {
            const response = await axios.get('http://localhost:8000/api/chat/rooms/', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            setRooms(response.data);
        } catch (err) {
            setError('방송 목록을 불러오는 데 실패했습니다.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        fetchRooms();
    }, [fetchRooms]);

    // 모달 열기 핸들러 (썸네일 상태 초기화 추가)
    const handleEdit = (room) => {
        setSelectedRoom(room);
        setEditFormData({
            name: room.name,
            description: room.description,
            status: room.status,
        });
        // 현재 썸네일로 미리보기 초기화
        setEditThumbnailPreview(room.thumbnail ? `http://localhost:8000${room.thumbnail}` : '');
        setShowEditModal(true);
    };

    // 모달 닫기 핸들러 (썸네일 상태 초기화 추가)
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

    // 모달 내 썸네일 파일 변경 핸들러
    const handleEditThumbnailChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setEditThumbnailFile(file);
            setEditThumbnailPreview(URL.createObjectURL(file));
        }
    };

    // 모달 저장 핸들러 (FormData 사용)
    const handleUpdate = async (e) => {
        e.preventDefault();
        if (!selectedRoom) return;

        const submissionData = new FormData();
        submissionData.append('name', editFormData.name);
        submissionData.append('description', editFormData.description);
        submissionData.append('status', editFormData.status);

        // 새 썸네일 파일이 선택된 경우에만 FormData에 추가
        if (editThumbnailFile) {
            submissionData.append('thumbnail', editThumbnailFile);
        }

        try {
            const accessToken = localStorage.getItem('accessToken');
            await axios.patch(`http://localhost:8000/api/chat/rooms/${selectedRoom.id}/`, 
                submissionData, // FormData 객체 전송
                { 
                    headers: { 
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'multipart/form-data' // 헤더 변경
                    } 
                }
            );
            alert('방송 정보가 성공적으로 수정되었습니다.');
            handleCloseModal();
            fetchRooms();
        } catch (err) {
            alert('정보 수정에 실패했습니다.');
            console.error(err);
        }
    };

    const handleDelete = async (roomId) => {
        if (window.confirm(`${roomId}번 방송을 정말로 삭제하시겠습니까?`)) {
            try {
                const accessToken = localStorage.getItem('accessToken');
                await axios.delete(`http://localhost:8000/api/chat/rooms/${roomId}/`, {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                alert('방송이 삭제되었습니다.');
                fetchRooms();
            } catch (err) {
                alert('방송 삭제에 실패했습니다.');
                console.error(err);
            }
        }
    };

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
                    <tbody>
                        {rooms.map(room => (
                            <tr key={room.id}>
                                <td>{room.id}</td>
                                <td>
                                    <img 
                                        src={room.thumbnail ? `http://localhost:8000${room.thumbnail}` : 'https://via.placeholder.com/80x45'} 
                                        alt={room.name} 
                                        style={{ width: '80px', height: '45px', objectFit: 'cover' }}
                                    />
                                </td>
                                <td>{room.name}</td>
                                <td>{room.influencer?.nickname || 'N/A'}</td>
                                <td>{getStatusBadge(room.status)}</td>
                                <td>{new Date(room.created_at).toLocaleString('ko-KR')}</td>
                                <td>
                                    <Button variant="outline-primary" size="sm" className="me-2" onClick={() => handleEdit(room)}>
                                        수정
                                    </Button>
                                    <Button variant="outline-danger" size="sm" onClick={() => handleDelete(room.id)}>
                                        삭제
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </Container>

            {/* 썸네일 수정 기능이 추가된 모달 */}
            {selectedRoom && (
                <Modal show={showEditModal} onHide={handleCloseModal} centered>
                    <Modal.Header closeButton>
                        <Modal.Title>방송 정보 수정 {/*(ID: {selectedRoom.id})*/}</Modal.Title>
                    </Modal.Header>
                    <Form onSubmit={handleUpdate}>
                        <Modal.Body>
                            {/* 썸네일 수정 UI */}
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

                            {/* 방송 제목 */}
                            <Form.Group className="mb-3">
                                <Form.Label>방송 제목</Form.Label>
                                <Form.Control 
                                    type="text"
                                    name="name"
                                    value={editFormData.name || ''}
                                    onChange={handleEditFormChange}
                                />
                            </Form.Group>

                            {/* 방송 설명 */}
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

                            {/* 방송 상태 */}
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