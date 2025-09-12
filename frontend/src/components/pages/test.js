import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/unifiedApiClient';
import styles from './HomeTemporary.module.css';
// InfluencerSidebar는 더 이상 사용하지 않으므로 import 제거

function HomeTemporary() {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [user, setUser] = useState(null); // 현재 로그인 사용자 정보
    const [influencers, setInfluencers] = useState([]); // 추천 스트리머 목록

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

        const fetchUser = async () => {
            try {
                const response = await api.get('/api/users/me/');
                setUser(response.data);
            } catch (err) {
                console.error('사용자 정보 로딩 실패:', err);
                setUser(null);
            }
        };

        const fetchInfluencers = async () => {
            try {
                const response = await api.get('/api/users/influencers/');
                setInfluencers(response.data);
            } catch (err) {
                console.error("인플루언서 목록을 불러오는 데 실패했습니다:", err);
            }
        };

        fetchChatRooms();
        fetchUser();
        fetchInfluencers(); // 인플루언서 정보 가져오는 함수 호출

        return () => {
            abortController.abort();
        };
    }, []);

    // API에서 받은 rooms 데이터를 이미지 레이아웃에 맞춰 분류합니다.
    const mainLive = rooms.slice(0, 4); // 첫 4개 방을 메인 라이브로 가정
    const aiCreators = rooms.slice(4, 9); // 다음 5개 방을 AI 크리에이터로 가정
    const followedStreams = rooms.slice(9, 14); // 다음 5개 방을 팔로우하는 크리에이터로 가정


    // 모든 섹션에 대한 렌더링 로직을 담을 하나의 함수
    const renderSection = (title, list, isMainLive = false) => (
        <section className={styles.sectionContainer}>
            <h2 className={styles.sectionTitle}>{title}</h2>
            <div className={isMainLive ? styles.mainLiveList : styles.broadcastList}>
                {list.length > 0 ? (
                    list.map((room) => {
                        const isLive = room.status === 'live';
            
                        // 썸네일 URL 인코딩 처리
                        const getThumbnailUrl = (thumbnail) => {
                            if (!thumbnail) {
                                return "data:image/svg+xml,%3Csvg width='400' height='225' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='400' height='225' fill='%23ddd'/%3E%3Ctext x='50%25' y='50%25' font-size='16' fill='%23999' text-anchor='middle' dy='.3em'%3ENo Image%3C/text%3E%3C/svg%3E";
                            }
                            if (thumbnail.startsWith('http')) {
                                return thumbnail;
                            }
                            const encodedPath = thumbnail.split('/').map(segment => encodeURIComponent(segment)).join('/');
                            return `${apiBaseUrl}/media/${encodedPath}`;
                        };
                        
                        const thumbnailUrl = getThumbnailUrl(room.thumbnail);
        
                        const cardContent = (
                            <div className={isMainLive ? styles.mainLiveCard : styles.card}>
                                <div className={styles.thumb}>
                                    <img src={thumbnailUrl} alt={`${room.name} 방송 썸네일`} />
                                    {isLive && (
                                        <div className={`${styles.statusBadge} ${styles.statusLive}`}>
                                            LIVE
                                        </div>
                                    )}
                                </div>
                                <div className={isMainLive ? styles.mainLiveInfo : styles.info}>
                                    <p className={styles.streamerName}>{room.influencer?.name_ko || room.influencer_nickname || room.host_username}</p>
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
                    <p>방송 목록이 없습니다.</p>
                )}
            </div>
        </section>
    );

    const renderInfluencerSection = (title, list) => (
        <section className={styles.sidebarSection}> {/* sidebarSection 클래스 추가 */}
            <h3 className={styles.sidebarSectionTitle}>{title}</h3>
            <div className={styles.influencerList}>
                {list.length > 0 ? (
                    list.map(influencer => (
                        <Link to={`/streamer/${influencer.id}`} key={influencer.id} className={styles.influencerCard}>
                            <div className={styles.influencerThumb}>
                                <img 
                                    src={influencer.profile_image ? `${apiBaseUrl}${influencer.profile_image}` : `${apiBaseUrl}/media/profile_pics/default_profile.png`} 
                                    alt={`${influencer.nickname} 프로필`} 
                                    className={styles.profileImage}
                                />
                            </div>
                            <div className={styles.influencerInfo}>
                                <p className={styles.influencerName}>{influencer.nickname || influencer.username}</p>
                                <p className={styles.influencerRole}>{influencer.role || '크리에이터'}</p>
                            </div>
                        </Link>
                    ))
                ) : (
                    <p className={styles.noDataMessage}>추천 스트리머가 없습니다.</p>
                )}
            </div>
        </section>
    );


    return (
        <div className={styles.homeLayout}>
            {/* 사이드바 영역 */}
            <aside className={styles.sidebar}>
                {renderInfluencerSection('추천 스트리머 방송국 바로가기', influencers)}
            </aside>

            {/* 메인 콘텐츠 영역 */}
            <main className={styles.mainContent}>
                {loading && <div className="loading-message">로딩 중...</div>}
                {error && <div className="loading-message">{error}</div>}
                {!loading && !error && (
                    <>
                        {/* 1. 메인 라이브 섹션 */}
                        <div className={styles.mainLiveHeader}>
                            <h2>지금 뜨는 라이브를 한눈에</h2>
                            <p>실시간 연애 상담, 사연 읽기까지 고민, AI 스트리머에게 물어보세요</p>
                        </div>
                        {renderSection('', mainLive, true)}

                        <hr className={styles.sectionDivider} />

                        {/* 2. 광고 이벤트 섹션 */}
                        <div className={styles.adBanner}>
                            <span>[광고] AI 스트리머 특별 연애 상담 이벤트
                                <p>사연 보내고 방송 참여할 기회 가세요!</p>
                            </span>
                            <button className={styles.adButton}>참여하기</button>
                        </div>

                        <hr className={styles.sectionDivider} />

                        {/* 3. AI 크리에이터의 연애 상담 섹션 */}
                        {renderSection('AI 크리에이터의 연애 상담', aiCreators)}

                        <hr className={styles.sectionDivider} />

                        {/* 4. 팔로우하는 크리에이터의 실시간 방송 섹션 */}
                        {user && (
                             renderSection(`${user.nickname || user.username}님이 팔로우하는 크리에이터의 실시간 방송`, followedStreams)
                        )}
                        {/* user가 없을 경우 대체 텍스트 또는 섹션을 숨기기 */}
                        {!user && (
                            <section className={styles.sectionContainer}>
                                <h2 className={styles.sectionTitle}>로그인 후 팔로우하는 방송을 확인하세요</h2>
                                <p>팔로우하는 크리에이터의 실시간 방송</p>
                            </section>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default HomeTemporary;