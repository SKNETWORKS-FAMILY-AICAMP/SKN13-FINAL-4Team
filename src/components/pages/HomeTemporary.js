import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './HomeTemporary.css';

function HomeTemporary() {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

useEffect(() => {
    const fetchChatRooms = async () => {
        // [수정] accessToken을 확인하고 보내는 로직 전체를 제거
        try {
            // 인증 헤더 없이 API 요청
            const response = await axios.get('http://localhost:8000/api/chat/rooms/');
            setRooms(response.data);
        } catch (err) {
            setError('방송 목록을 불러오는 데 실패했습니다.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    fetchChatRooms();
}, []);

    if (loading) return <div className="loading-message">로딩 중...</div>;
    if (error) return <div className="loading-message">{error}</div>;

    return (
        <div className="home-temporary-container">
            <h2>스트리밍 목록</h2>
            <div className="broadcast-list">
                {rooms.length > 0 ? (
                    rooms.map((room) => {
                        const isLive = room.status === 'live';
                        const thumbnailUrl = room.thumbnail 
                            ? `http://localhost:8000${room.thumbnail}`
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
                                    <p className="streamer-name">{room.influencer?.nickname || room.host.username}</p>
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

                        if  (room.status === 'live' || room.status === 'pending') {
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