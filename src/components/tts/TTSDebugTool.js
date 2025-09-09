import React, { useState, useEffect, useCallback } from 'react';
import { Container, Table, Spinner, Alert, Button, Badge } from 'react-bootstrap';
import Sidebar from '../layout/Sidebar';
import api from '../../api';

function TTSDebugTool() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get('/api/debug/');
            setLogs(response.data.results || []);
        } catch (err) {
            setError('TTS 로그를 불러오는 데 실패했습니다.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const getStatusBadge = (status) => {
        switch (status) {
            case 'SUCCESS': return <Badge bg="success">성공</Badge>;
            case 'ERROR': return <Badge bg="danger">실패</Badge>;
            case 'PENDING': return <Badge bg="warning">대기중</Badge>;
            default: return <Badge bg="secondary">{status}</Badge>;
        }
    };

    if (loading) return <Container className="d-flex justify-content-center mt-5"><Spinner animation="border" /></Container>;
    if (error) return <Container className="mt-5"><Alert variant="danger">{error}</Alert></Container>;

    return (
        <div className="admin-page-wrapper">
            <Sidebar />
            <Container className="admin-content-container">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h2>TTS 디버그 로그</h2>
                    <Button variant="outline-primary" onClick={fetchLogs}>새로고침</Button>
                </div>
                <Table striped bordered hover responsive size="sm">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>요청 시간</th>
                            <th>사용자</th>
                            <th>인플루언서</th>
                            <th>상태</th>
                            <th>요청 텍스트</th>
                            <th>처리 시간(ms)</th>
                            <th>에러 메시지</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map(log => (
                            <tr key={log.id}>
                                <td>{log.id}</td>
                                <td>{new Date(log.created_at).toLocaleString('ko-KR')}</td>
                                <td>{log.user || 'N/A'}</td>
                                <td>{log.influencer || 'N/A'}</td>
                                <td>{getStatusBadge(log.status)}</td>
                                <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.request_text}>
                                    {log.request_text}
                                </td>
                                <td>{log.latency_ms}</td>
                                <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.error_message}>
                                    {log.error_message}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </Container>
        </div>
    );
}

export default TTSDebugTool;
