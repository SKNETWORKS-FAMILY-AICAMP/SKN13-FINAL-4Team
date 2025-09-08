import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import styles from './HomeTemporary.module.css';

function HomeTemporary() {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [user, setUser] = useState(null);
    const [influencers, setInfluencers] = useState([]);

    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || '';

    useEffect(() => {
        const abortController = new AbortController();
        const signal = abortController.signal;

        const fetchData = async () => {
            try {
                // 여러 API 호출을 동시에 시작합니다.
                const roomsPromise = api.get(`/api/chat/rooms/`, { signal });
                const userPromise = api.get('/api/users/me/', { signal });
                const influencersPromise = api.get('/api/influencers/', { signal });
                
                // 모든 API 응답을 기다립니다.
                const [roomsResponse, userResponse, influencersResponse] = await Promise.all([roomsPromise, userPromise, influencersPromise]);
                
                // 각 응답 데이터를 처리합니다.
                const roomsResults = roomsResponse.data?.results || roomsResponse.data || [];
                setRooms(Array.isArray(roomsResults) ? roomsResults : []);

                setUser(userResponse.data);

                const influencersResults = influencersResponse.data?.results || influencersResponse.data || [];
                setInfluencers(Array.isArray(influencersResults) ? influencersResults : []);

            } catch (err) {
                if (err.name !== 'CanceledError') {
                    setError('데이터를 불러오는 데 실패했습니다.');
                    console.error("데이터 로딩 실패:", err);
                    setUser(null); // 에러 발생 시 사용자 정보 초기화
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        return () => {
            abortController.abort();
        };
    }, []);

    const liveRooms = rooms.filter(room => room.status === 'live');
    const mainLive = liveRooms.slice(0, 4);
    
    // 카드 렌더링 함수
    const renderRoomCard = (room) => {
        const isLive = room.status === 'live';

        const thumbnailUrl = room.thumbnail && (room.thumbnail.startsWith('http') || room.thumbnail.startsWith('/media'))
            ? room.thumbnail.startsWith('http') ? room.thumbnail : `${apiBaseUrl}${room.thumbnail}`
            : `https://via.placeholder.com/400x225.png?text=No+Image`;
        
        return (
            <Link to={`/stream/${room.id}`} key={room.id} className={styles.cardLink}>
                <div className={styles.card}>
                    <div className={styles.thumb}>
                        <img src={thumbnailUrl} alt={`${room.name} 썸네일`} />
                        <div className={`${styles.statusBadge} ${styles.statusLive}`}>LIVE</div>
                    </div>
                    <div className={styles.info}>
                        <p className={styles.streamTitle}>{room.name}</p>
                        <p className={styles.streamerName}>{room.influencer?.name || '스트리머'}</p>
                        <div className={styles.bottomInfo}>
                            {isLive ? (
                                <span className={styles.viewerCount}>시청자 {room.viewer_count || 0}</span>
                            ) : (
                                // 라이브가 아닐 때는 조회수를 표시하거나, 아무것도 표시하지 않을 수 있습니다.
                                <span>시청자 0 명</span> 
                            )}
                            <span className={styles.timeInfo}>{new Date(room.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
            </Link>
        );
    };

    if (loading) return <div className={styles.loadingMessage}>로딩 중...</div>;
    if (error) return <div className={styles.errorMessage}>{error}</div>;

    return (
        <div className={styles.container}>
            {/* 1. 메인 라이브 섹션 */}
            <header className={styles.mainLiveHeader}>
                <div className={styles.headerText}>
                    <h1>지금 뜨는 라이브를 한눈에</h1>
                    <p>실시간 연애 상담, 사연 읽기까지 고민, AI 스트리머에게 물어보세요</p>
                </div>
                <div className={styles.mainLiveGrid}>
                    {mainLive.map(room => (
                        <Link to={`/stream/${room.id}`} key={room.id} className={styles.mainLiveCard}>
                            <img src={room.thumbnail ? `${apiBaseUrl}${room.thumbnail}` : `https://via.placeholder.com/400x225.png?text=LIVE`} alt={room.name} />
                            <div className={styles.liveOverlay}>
                                <div className={styles.liveIndicator}></div>
                                <span>LIVE</span>
                            </div>
                        </Link>
                    ))}
                </div>
            </header>

            {/* 2. 지금 라이브 섹션 */}
            <section className={styles.sectionContainer}>
                <h2 className={styles.sectionTitle}>🔥 지금 라이브</h2>
                <div className={styles.broadcastList}>
                    {/* {liveRooms.length > 0 ? liveRooms.map(renderRoomCard) : <p>진행중인 라이브가 없습니다.</p>} */}
                    {rooms.length > 0 ? rooms.map(renderRoomCard) : <p>진행중인 라이브가 없습니다.</p>}
                </div>
            </section>

            {/* 3. 광고 이벤트 섹션 */}
            <section className={styles.adBanner}>
                <div className={styles.adText}>
                    <h2>[광고] AI 스트리머 특별 연애 상담 이벤트</h2>
                    <p>사연 보내고 방송 참여할 기회 잡으세요!</p>
                </div>
                <button className={styles.adButton}>참여하기</button>
            </section>
            <br></br>

            {/* 4. AI 크리에이터의 연애 상담 섹션 */}
            <section className={styles.sectionContainer}>
                <h2 className={styles.sectionTitle}>🤖 AI 크리에이터의 연애 상담</h2>
                <div className={styles.broadcastList}>
                    {rooms.length > 0 ? rooms.slice(0, 5).map(renderRoomCard) : <p>방송 목록이 없습니다.</p>}
                </div>
            </section>

            {/* 5. 추천 스트리머 방송국 바로가기 */}
            <section className={styles.sectionContainer}>
                <h2 className={styles.sectionTitle}>⭐ 추천 스트리머 방송국 바로가기</h2>
                <div className={styles.influencerGrid}>
                    {influencers.slice(0, 6).map(inf => (
                        <Link to={`/influencers/${inf.id}`} key={inf.id} className={styles.influencerCard}>
                            <img 
                                src={inf.profile_image ? `${inf.profile_image}` : `https://via.placeholder.com/100`}
                                alt={inf.name}
                            />
                            <span>{inf.name}</span>
                        </Link>
                    ))}
                </div>
            </section>

            {/* 6. 팔로우하는 크리에이터의 실시간 방송 */}
            <section className={styles.sectionContainer}>
                <h2 className={styles.sectionTitle}>❤️ {user?.nickname || '회원'}님이 좋아하는 크리에이터의 실시간 방송</h2>
                <div className={styles.broadcastList}>
                    {rooms.length > 0 ? rooms.map(renderRoomCard) : <p>팔로우하는 크리에이터의 라이브가 없습니다.</p>}
                </div>
            </section>
        </div>
    );
}

export default HomeTemporary;