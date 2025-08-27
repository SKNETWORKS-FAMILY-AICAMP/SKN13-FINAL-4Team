import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api'; // 설정된 Axios 인스턴스
import './HomeTemporary.css';

function HomeTemporary() {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || '';

    useEffect(() => {
        // 컴포넌트가 언마운트될 때 API 요청을 취소하기 위한 AbortController
        const abortController = new AbortController();

        const fetchChatRooms = async () => {
            try {
                // API 요청 시 AbortController의 signal을 전달하여 취소할 수 있도록 합니다.
                const response = await api.get(`/api/chat/rooms/`, {
                    signal: abortController.signal
                });
                
                // DRF 페이지네이션 응답을 더 간결하게 처리합니다.
                const results = response.data?.results || response.data || [];
                if (Array.isArray(results)) {
                    setRooms(results);
                } else {
                    console.error("Received data is not an array:", results);
                    setRooms([]);
                }

            } catch (err) {
                // 요청이 취소된 경우는 에러로 처리하지 않습니다.
                if (err.name === 'CanceledError') {
                    console.log('Request canceled on component unmount');
                    return;
                }
                setError('방송 목록을 불러오는 데 실패했습니다.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchChatRooms();

        // Cleanup 함수: 컴포넌트가 언마운트될 때 실행됩니다.
        return () => {
            abortController.abort();
        };
    }, []); // 의존성 배열이 비어있으므로, 컴포넌트가 처음 마운트될 때 한 번만 실행됩니다.

    if (loading) return <div className="loading-message">로딩 중...</div>;
    if (error) return <div className="loading-message">{error}</div>;

    return (
        <div className="home-temporary-container">
            <h2>스트리밍 목록</h2>
            <div className="broadcast-list">
                {rooms.length > 0 ? (
                    rooms.map((room) => {
                        const isLive = room.status === 'live';
                        
                        // 정의된 apiBaseUrl 변수를 사용하여 썸네일 전체 주소를 만듭니다.
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
                                    <p className="streamer-name">{room.influencer_nickname || room.host_username}</p>
                                    {isLive && <p className="stream-title">{room.name}</p>}
                                    <div className="bottom-info">
                                        {/* 시청자 수를 동적으로 표시 (API 응답에 viewer_count가 있다고 가정) */}
                                        {isLive && <p className="viewer-count">시청자 {room.viewer_count || 0}명</p>}
                                        <p className="time-info">
                                            {isLive ? `방송 시작: ${new Date(room.created_at).toLocaleTimeString()}` : `생성: ${new Date(room.created_at).toLocaleDateString()}`}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );

                        // 방송이 'live' 또는 'pending' 상태일 때만 클릭 가능한 링크로 감쌉니다.
                        if (room.status === 'live' || room.status === 'pending') {
                            return (
                                <Link to={`/stream/${room.id}`} key={room.id} className="broadcast-card-link">
                                    {cardContent}
                                </Link>
                            );
                        }
                        
                        // 그 외 상태는 클릭 불가능한 div로 렌더링합니다.
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