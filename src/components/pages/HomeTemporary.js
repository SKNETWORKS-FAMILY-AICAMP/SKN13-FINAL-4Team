import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './HomeTemporary.css';

function HomeTemporary() {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // 백엔드 API 기본 주소를 환경 변수에서 가져오도록 설정
    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

    useEffect(() => {
        const fetchChatRooms = async () => {
            try {
                // axios 요청 시 apiBaseUrl 변수 사용
                const response = await axios.get(`${apiBaseUrl}/api/chat/rooms/`);
                
                // DRF 페이지네이션 응답에 맞게 수정
                if (response.data && Array.isArray(response.data.results)) {
                    setRooms(response.data.results);
                } else if (Array.isArray(response.data)) { // 페이지네이션이 없는 경우 대비
                    setRooms(response.data);
                } else {
                    setRooms([]);
                }

            } catch (err) {
                setError('방송 목록을 불러오는 데 실패했습니다.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchChatRooms();
    }, [apiBaseUrl]); // apiBaseUrl을 의존성 배열에 추가

    if (loading) return <div className="loading-message">로딩 중...</div>;
    if (error) return <div className="loading-message">{error}</div>;

    return (
        <div className="home-temporary-container">
            <h2>스트리밍 목록</h2>
            <div className="broadcast-list">
                {rooms.length > 0 ? (
                    rooms.map((room) => {
                        const isLive = room.status === 'live';
                        
                        // [수정] 썸네일 주소 생성 시 apiBaseUrl 변수 사용
                        const thumbnailUrl = room.thumbnail 
                            ? `${apiBaseUrl}${room.thumbnail}`
                            : `https://via.placeholder.com/400x225.png?text=No+Image`;

                        const cardContent = (
                            <div className="broadcast-card">
                                <div className="thumbnail-container">
                                    <img src={thumbnailUrl} alt={`${room.name} 방송 썸네일`} />
                                    <div className={`status-badge ${isLive ? 'live' : 'off'}`}>
                                        {isLive ? 'LIVE' : (room.status === 'pending' ? '준비중' : 'OFF')}
                                    </div>
                                </div>
                                <div className="info-container">
                                    {/* API 응답 구조에 맞게 수정 */}
                                    <p className="streamer-name">{room.influencer_nickname || room.host_username}</p>
                                    {isLive && <p className="stream-title">{room.name}</p>}
                                    <div className="bottom-info">
                                        {isLive && <p className="viewer-count">시청자 0명</p>}
                                        <p className="time-info">
                                            {isLive ? `방송 시작: ${new Date(room.created_at).toLocaleTimeString()}` : `생성: ${new Date(room.created_at).toLocaleDateString()}`}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );

                        if (room.status === 'live' || room.status === 'pending') {
                            return (
                                <Link to={`/stream/${room.id}`} key={room.id} className="broadcast-card-link">
                                    {cardContent}
                                </Link>
                            );
                        }
                        
                        return <div key={room.id}>{cardContent}</div>;
                    })
                ) : (
                    <p>현재 진행중인 방송이 없습니다.</p>
                )}
            </div>
        </div>
    );
};

export default HomeTemporary;