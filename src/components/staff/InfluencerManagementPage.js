import React, { useState, useEffect, useCallback } from 'react';
import { Container, Table, Spinner, Alert, Button, Modal, Form } from 'react-bootstrap';
import Sidebar from '../layout/Sidebar';
import api from '../../api';

function InfluencerManagementPage() {
    const [influencers, setInfluencers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // 모달 및 폼 상태
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedInfluencer, setSelectedInfluencer] = useState(null);
    const [formData, setFormData] = useState({});

    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || '';

    const fetchInfluencers = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/influencers/');
            setInfluencers(response.data.results || []);
        } catch (err) {
            setError('인플루언서 목록을 불러오는 데 실패했습니다.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchInfluencers();
    }, [fetchInfluencers]);

    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedInfluencer(null);
        setFormData({});
        setIsEditing(false);
    };

    const handleShowCreateModal = () => {
        setIsEditing(false);
        setFormData({ gender: '남' }); // 기본값 설정
        setShowModal(true);
    };

    const handleShowEditModal = (influencer) => {
        setIsEditing(true);
        setSelectedInfluencer(influencer);
        setFormData({ ...influencer });
        setShowModal(true);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const apiCall = isEditing 
            ? api.put(`/api/influencers/${selectedInfluencer.id}/`, formData)
            : api.post('/api/influencers/', formData);

        try {
            await apiCall;
            alert(`인플루언서 정보가 성공적으로 ${isEditing ? '수정' : '생성'}되었습니다.`);
            handleCloseModal();
            fetchInfluencers(); // 목록 새로고침
        } catch (err) {
            alert(`작업에 실패했습니다: ${err.response?.data?.detail || err.message}`);
            console.error(err);
        }
    };

    if (loading) return <Container className="d-flex justify-content-center mt-5"><Spinner animation="border" /></Container>;
    if (error) return <Container className="mt-5"><Alert variant="danger">{error}</Alert></Container>;

    return (
        <div className="admin-page-wrapper">
            <Sidebar />
            <Container className="admin-content-container">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h2>인플루언서 관리</h2>
                    <Button variant="primary" onClick={handleShowCreateModal}>새 인플루언서 추가</Button>
                </div>
                <Table striped bordered hover responsive>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>이름</th>
                            <th>나이</th>
                            <th>성별</th>
                            <th>MBTI</th>
                            <th>관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {influencers.map(inf => (
                            <tr key={inf.id}>
                                <td>{inf.id}</td>
                                <td>{inf.name}</td>
                                <td>{inf.age}</td>
                                <td>{inf.gender}</td>
                                <td>{inf.mbti}</td>
                                <td>
                                    <Button variant="outline-primary" size="sm" onClick={() => handleShowEditModal(inf)}>
                                        수정
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </Container>

            <Modal show={showModal} onHide={handleCloseModal} centered>
                <Modal.Header closeButton>
                    <Modal.Title>{isEditing ? '인플루언서 수정' : '새 인플루언서 추가'}</Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleSubmit}>
                    <Modal.Body>
                        <Form.Group className="mb-3">
                            <Form.Label>실명</Form.Label>
                            <Form.Control type="text" name="name" value={formData.name_real || ''} onChange={handleChange} required />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>나이</Form.Label>
                            <Form.Control type="number" name="age" value={formData.age || ''} onChange={handleChange} required />
                        </Form.Group>
                         <Form.Group className="mb-3">
                            <Form.Label>성별</Form.Label>
                            <Form.Select name="gender" value={formData.gender || '남'} onChange={handleChange}>
                                <option value="남">남성</option>
                                <option value="여">여성</option>
                            </Form.Select>
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>MBTI</Form.Label>
                            <Form.Control type="text" name="mbti" value={formData.mbti || ''} onChange={handleChange} />
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={handleCloseModal}>취소</Button>
                        <Button variant="primary" type="submit">저장</Button>
                    </Modal.Footer>
                </Form>
            </Modal>
        </div>
    );
}

export default InfluencerManagementPage;
