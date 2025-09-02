import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/unifiedApiClient';
import styles from './HomeTemporary.module.css';

function HomeTemporary() {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || '';

    useEffect(() => {
        const abortController = new AbortController();

        const fetchChatRooms = async () => {
            try {
                const response = await api.get(`/api/chat/rooms/`, {
                    signal: abortController.signal
                });
                
                const results = response.data?.results || response.data || [];
                if (Array.isArray(results)) {
                    setRooms(results);
                } else {
                    console.error("Received data is not an array:", results);
                    setRooms([]);
                }

            } catch (err) {
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

        return () => {
            abortController.abort();
        };
    }, []);

    if (loading) return <div className="loading-message">로딩 중...</div>;
    if (error) return <div className="loading-message">{error}</div>;

    return (
        <div className={styles.container}>
            <h2>스트리밍 목록</h2>
            <div className={styles.broadcastList}>
                {rooms.length > 0 ? (
                    rooms.map((room) => {
                        const isLive = room.status === 'live';
                        
                        const thumbnailUrl = room.thumbnail 
                            ? room.thumbnail
                            : `data:image/svg+xml;base64,${btoa(`
                                <svg width="400" height="225" xmlns="http://www.w3.org/2000/svg">
                                    <rect width="100%" height="100%" fill="#f0f0f0"/>
                                    <text x="50%" y="50%" font-family="Arial" font-size="18" fill="#999" text-anchor="middle" dominant-baseline="middle">No Image</text>
                                </svg>
                            `)}`;

                        const cardContent = (
                            <div className={styles.card}>
                                <div className={styles.thumb}>
                                    <img src={thumbnailUrl} alt={`${room.name} 방송 썸네일`} />
                                    <div className={`${styles.statusBadge} ${isLive ? styles.statusLive : styles.statusOff}`}>
                                        {isLive ? 'LIVE' : (room.status === 'pending' ? '준비중' : 'OFF')}
                                    </div>
                                </div>
                                <div className={styles.info}>
                                    <p className={styles.streamerName}>{room.streamer?.display_name || room.host_username}</p>
                                    {isLive && <p className={styles.streamTitle}>{room.name}</p>}
                                    <div className={styles.bottomInfo}>
                                        {isLive && <p className={styles.viewerCount}>시청자 {room.viewer_count || 0}명</p>}
                                        <p className={styles.timeInfo}>
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