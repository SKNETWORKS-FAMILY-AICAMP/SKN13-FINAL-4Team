import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate  } from 'react-router-dom';
import { getValidToken } from '../../utils/tokenUtils'; 
// HLS.js 완전 제거
import api from '../../api';
// import { getDefaultIdleVideo, getRandomIdleVideo } from '../../utils/videoConfig';

// import VideoPlayer from './VideoPlayer';

import styles from './StreamingPage.module.css';
import DonationIsland from './DonationIsland';
import { w3cwebsocket as W3CWebSocket } from 'websocket';

// 한글 이름을 영문 캐릭터 ID로 매핑
const getCharacterIdFromName = (name) => {
    const nameMapping = {
        '홍세현': 'hongseohyun',
        '김춘기': 'kimchunki', 
        '오율': 'ohyul',
        '강시현': 'kangsihyun'
    };
    return nameMapping[name] || 'hongseohyun'; // 기본값
};

function StreamingPage() {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const videoRef = useRef(null);
    const videoTransitionRef = useRef(null);
    // hlsRef 제거
    const [room, setRoom] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const chatClientRef = useRef(null);
    const chatContainerRef = useRef(null);
    const lastDonationRef = useRef(null);
    const [user, setUser] = useState(null);
    const [isLiked, setIsLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);

    // 🆕 Queue 시스템 상태 관리
    const [showQueuePanel, setShowQueuePanel] = useState(true);
    const [queueStatus, setQueueStatus] = useState(null);
    const [sessionInfo, setSessionInfo] = useState(null);
    const [detailedQueueInfo, setDetailedQueueInfo] = useState(null);
    
    // 후원 시스템 상태
    const [isDonationIslandOpen, setIsDonationIslandOpen] = useState(false);
    const [donationOverlay, setDonationOverlay] = useState({ visible: false, data: null });
    
    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
    const websocketBaseUrl = process.env.REACT_APP_WEBSOCKET_BASE_URL || 'ws://localhost:8000';

    // WebSocket 메시지 처리 (TTS 설정 변경 및 새로운 Broadcasting 포함)
    const handleWebSocketMessage = (data) => {
        if (data.type === 'tts_settings_changed' && data.settings) {
            console.log('🔧 TTS 설정 변경:', data.settings);
        } 
        // 🆕 Queue 상태 업데이트 처리
        else if (data.type === 'queue_status_update' && data.session_info) {
            console.log('📊 Queue 상태 업데이트 수신:', data.session_info);
            setSessionInfo(data.session_info);
            setQueueStatus(data.session_info);
        }
        // 🆕 상세 Queue 디버그 정보 처리
        else if (data.type === 'queue_debug_update' && data.detailed_queue_info) {
            console.log('🔍 상세 Queue 정보 수신:', data.detailed_queue_info);
            setDetailedQueueInfo(data.detailed_queue_info);
        }
        // 🆕 후원 오버레이 처리
        else if (data.type === 'donation_overlay' && data.data) {
            console.log('💰 후원 오버레이 표시:', data.data);
            setDonationOverlay({ visible: true, data: data.data });
        }
        // 서버에서 직접 온 후원 메시지도 오버레이로 표시
        else if (data.type === 'donation_message') {
            const overlayData = {
                message: data.message,
                username: data.user,
                amount: data.amount,
                timestamp: data.timestamp
            };
            console.log('💰 후원 오버레이(직접 변환) 표시:', overlayData);
            setDonationOverlay({ visible: true, data: overlayData });
        }
        // 🆕 비디오 전환 이벤트 처리
        else if (data.type === 'video_transition' && data.transition) {
            console.log('🎬 비디오 전환 이벤트 처리:', data.transition);
            
            const { video_file, state, character_id, emotion } = data.transition;
            
            // VideoPlayer에 비디오 전환 요청
            if (videoTransitionRef.current && video_file) {
                console.log(`🎥 비디오 전환 실행: ${state} -> ${video_file}`);
                videoTransitionRef.current.changeVideo(video_file);
            }
        }
        // 🆕 MediaPacket 처리 (FIFO 순차 처리)
        else if (data.type === 'media_packet' && data.packet) {
            console.log('📦 MediaPacket 수신 (FIFO 순차 처리):', data.packet);
            
            // MediaPacket의 트랙들을 처리
            const packet = data.packet;
            if (packet.tracks && packet.tracks.length > 0) {
                packet.tracks.forEach(track => {
                    console.log(`🎵 트랙 처리: ${track.kind} (duration: ${track.dur}ms)`);
                    
                    if (track.kind === 'audio' && track.payload_ref) {
                        // 오디오 트랙 재생
                        console.log('🎵 오디오 재생:', track.payload_ref.substring(0, 50) + '...');
                        const audio = new Audio(track.payload_ref);
                        audio.play().catch(e => console.error('오디오 재생 실패:', e));
                    }
                    
                    if (track.kind === 'video' && track.payload_ref) {
                        // 비디오 트랙 전환
                        console.log('🎬 비디오 전환:', track.payload_ref);
                        if (videoTransitionRef.current) {
                            videoTransitionRef.current.changeVideo(track.payload_ref);
                        }
                    }
                    
                    if (track.kind === 'subtitle' && track.payload_ref) {
                        const subtitleData = JSON.parse(track.payload_ref);
                        console.log('💬 자막 데이터:', subtitleData);
                        
                        // 기존 자막 이벤트 발생 (MediaPacketSyncController와 동일하게)
                        window.dispatchEvent(new CustomEvent('subtitleTrackChange', {
                            detail: {
                                subtitleData,
                                duration: track.dur,
                                packet: packet
                            }
                        }));
                    }
                });
            }
        }
    };

    // 후원 오버레이 자동 숨김 처리
    useEffect(() => {
        if (donationOverlay.visible) {
            const timer = setTimeout(() => {
                setDonationOverlay({ visible: false, data: null });
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [donationOverlay.visible]);

    useEffect(() => {
        let websocketClient = null;

        const initializePage = async () => {
            try {
                // 1. 유효한 토큰부터 확인
                const token = await getValidToken();
                if (!token) {
                    alert("로그인이 필요한 페이지입니다.");
                    navigate('/login');
                    return;
                }

                // 2. 사용자 정보와 방 정보를 동시에 요청
                const userPromise = api.get('/api/users/me/');
                const roomPromise = api.get(`/api/chat/rooms/${roomId}/`);
                const [userResponse, roomResponse] = await Promise.all([userPromise, roomPromise]);
                
                const currentUser = userResponse.data;
                const currentRoom = roomResponse.data;
                
                console.log('🏠 Room 정보:', currentRoom);
                console.log('👤 Influencer 정보:', currentRoom?.influencer);
                
                setUser(currentUser);
                setRoom(currentRoom);

                // 인플루언서 좋아요 상태/카운트 조회
                if (currentRoom?.influencer?.id) {
                    try {
                        const infRes = await api.get(`/api/influencers/${currentRoom.influencer.id}/`);
                        setIsLiked(!!infRes.data.is_liked_by_user);
                        setLikeCount(infRes.data.like_count || 0);
                    } catch (e) {
                        console.warn('인플루언서 좋아요 정보 조회 실패:', e);
                        setIsLiked(false);
                        setLikeCount(currentRoom.like_count || 0);
                    }
                }

                // 3. 비디오는 나중에 useEffect에서 초기화
                

                // 4. 모든 정보가 준비된 후 웹소켓 연결
                websocketClient = new W3CWebSocket(`${websocketBaseUrl}/ws/stream/${roomId}/?token=${token}`);
                chatClientRef.current = websocketClient;

                websocketClient.onopen = () => {
                    console.log('WebSocket Client Connected');
                };

                websocketClient.onmessage = (message) => {
                    const dataFromServer = JSON.parse(message.data);
                    setChatMessages(prev => [...prev, dataFromServer]);
                    handleWebSocketMessage(dataFromServer);
                };

                websocketClient.onerror = (err) => {
                    console.error('WebSocket Error:', err);
                    setChatMessages(prev => [...prev, { type: 'system_message', message: '채팅 서버에 연결할 수 없습니다.' }]);
                };

                websocketClient.onclose = () => {
                    console.log('WebSocket Client Disconnected');
                };

            } catch (err) {
                console.error("페이지 초기화 실패:", err);
                setError('페이지를 불러오는 데 실패했습니다.');
            } finally {
                setLoading(false);
            }
        };

        initializePage();

        // 컴포넌트가 사라질 때 웹소켓 연결만 정리 (HLS 제거됨)
        return () => {
            websocketClient?.close();
        };
    }, [roomId, navigate, websocketBaseUrl]);

    // 비디오 초기화 useEffect (room과 DOM 준비 후)
    useEffect(() => {
        console.log('🎥 비디오 초기화 useEffect:', { 
            hasRoom: !!room, 
            hasInfluencer: !!room?.influencer,
            hasVideoRef: !!videoRef.current 
        });
        // 로딩 중에는 비디오 엘리먼트가 렌더되지 않아 ref가 null일 수 있음
        if (loading) return;

        if (room && room.influencer && videoRef.current) {
            const characterId = getCharacterIdFromName(room.influencer.name);
            
            // 캐릭터별 기본 비디오 파일 정의 (fallback 포함)
            const getDefaultVideoFile = (charId) => {
                const videoOptions = {
                    'hongseohyun': ['idle_2', 'idle_3', 'idle_4'], // idle_1이 없음
                    'kimchunki': ['idle_1', 'idle_2', 'idle_3'],
                    'ohyul': ['idle_1', 'idle_2', 'idle_3'],
                    'kangsihyun': ['idle_1', 'idle_2', 'idle_3']
                };
                
                const options = videoOptions[charId] || ['idle_1'];
                return `${charId}_${options[0]}.mp4`; // 첫 번째 옵션 사용
            };
            
            const videoFileName = getDefaultVideoFile(characterId);
            const defaultVideo = `/videos/${characterId}/${videoFileName}`;
            
            console.log('📹 비디오 경로 생성 (fallback 적용):', { 
                influencerName: room.influencer.name,
                characterId, 
                videoFileName,
                videoPath: defaultVideo 
            });
            
            console.log('🎬 비디오 요소에 설정 중...');
            const video = videoRef.current;
            video.src = defaultVideo;
            
            // 비디오 로드 및 재생 이벤트 확인
            video.addEventListener('loadstart', () => console.log('📼 비디오 로드 시작:', defaultVideo));
            video.addEventListener('loadeddata', () => console.log('✅ 비디오 데이터 로드됨'));
            video.addEventListener('canplay', () => console.log('▶️ 비디오 재생 가능'));
            video.addEventListener('play', () => console.log('🎬 비디오 재생 시작'));
            video.addEventListener('error', (e) => {
                console.error('❌ 비디오 에러:', e, video.error);
                console.log('🔄 폴백 시도...');
            });
            
            video.load();
            console.log('🔄 비디오 로드 호출됨');
        }
    }, [room, loading]); // 로딩 완료 시에도 재실행

    // 채팅 스크롤 자동 내리기
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatMessages]);

    // 채팅에 후원 메시지가 추가되면 오버레이 표시 (보강 로직)
    useEffect(() => {
        if (!chatMessages || chatMessages.length === 0) return;
        const lastMsg = chatMessages[chatMessages.length - 1];
        if (lastMsg?.type === 'donation_message') {
            const donationKey = `${lastMsg.user}-${lastMsg.amount}-${lastMsg.timestamp || chatMessages.length}`;
            if (lastDonationRef.current !== donationKey) {
                lastDonationRef.current = donationKey;
                setDonationOverlay({
                    visible: true,
                    data: {
                        message: lastMsg.message,
                        username: lastMsg.user,
                        amount: lastMsg.amount,
                        timestamp: lastMsg.timestamp
                    }
                });
            }
        }
    }, [chatMessages]);
    
    // 메시지 전송 로직
    const sendMessage = useCallback((type = 'chat_message', content = messageInput) => {
        if (!content.trim() || !chatClientRef.current || chatClientRef.current.readyState !== chatClientRef.current.OPEN) {
            return;
        }
        chatClientRef.current.send(JSON.stringify({
            type,
            message: content,
        }));
        if (type === 'chat_message') {
            setMessageInput('');
        }
    }, [messageInput]);

    const handleMessageSubmit = (e) => {
        e.preventDefault();
        sendMessage();
    };

    const handleLikeClick = async () => {
        if (!user || !room?.influencer?.id) {
            alert('로그인이 필요한 기능입니다.');
            return;
        }
        const influencerId = room.influencer.id;
        const prevLiked = isLiked;
        const prevCount = likeCount;
        setIsLiked(!prevLiked);
        setLikeCount(prev => Math.max(0, prev + (prevLiked ? -1 : 1)));
        try {
            const res = await api.post(`/api/influencers/${influencerId}/like/`);
            if (typeof res?.data?.like_count === 'number') {
                setLikeCount(res.data.like_count);
            }
            if (typeof res?.data?.liked === 'boolean') {
                setIsLiked(res.data.liked);
            }
        } catch (err) {
            console.error('좋아요 처리 실패:', err);
            setIsLiked(prevLiked);
            setLikeCount(prevCount);
            alert('좋아요 처리에 실패했습니다.');
        }
    };

    
    if (loading) return <div className={styles.pageContainer}><p>로딩 중...</p></div>;
    if (error) return <div className={styles.pageContainer}><p>{error}</p></div>;
    if (!room) return <div className={styles.pageContainer}><p>방 정보를 찾을 수 없습니다.</p></div>;

    const defaultProfileImage = "data:image/svg+xml,%3Csvg width='50' height='50' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='50' height='50' fill='%23ddd'/%3E%3Ctext x='50%25' y='50%25' font-size='14' fill='%23999' text-anchor='middle' dy='.3em'%3E👤%3C/text%3E%3C/svg%3E";
    
    const profileImageUrl = room.influencer?.profile_image 
        ? (room.influencer.profile_image.startsWith('http') ? room.influencer.profile_image : `${apiBaseUrl}${room.influencer.profile_image}`)
        : defaultProfileImage;

    return (
        <div className={styles.pageContainer}>
            {/* 왼쪽 메인 콘텐츠 영역 */}
            <div className={styles.streamMainContent}>
                <div className={styles.videoPlayerContainer}>
                    <video
                        ref={videoRef}
                        className={styles.videoPlayer}
                        autoPlay
                        loop
                        muted
                        playsInline
                    />
                    {donationOverlay?.visible && donationOverlay?.data && (
                        <div className={styles.donationOverlay}>
                            <div className={styles.donationOverlayTitle}>
                                <span className={styles.donationEmoji}>💰</span>
                                <strong>{donationOverlay.data.username}</strong>
                                <span>님이 </span>
                                <strong className={styles.donationOverlayAmount}>
                                    {Number(donationOverlay.data.amount).toLocaleString()}
                                </strong>
                                <span> 크레딧을 후원하셨습니다.</span>
                            </div>
                            {donationOverlay.data.message && (
                                <div className={styles.donationOverlayMessage}>
                                    {donationOverlay.data.message}
                                </div>
                            )}
                        </div>
                    )}
                    {room.status === 'live' && (
                        <div className={styles.liveIndicator}>
                            <span className={styles.liveDot}></span>LIVE
                        </div>
                    )}
                </div>

                <div className={styles.streamInfoContainer}>
                    <div className={styles.streamDetails}>
                        <h1 className={styles.streamTitle}>
                            <span>[실시간]</span> {room.name}
                        </h1>
                        <div className={styles.streamerInfo}>
                            <img src={profileImageUrl} alt={room.influencer?.name} className={styles.streamerProfilePic} />
                            <div className={styles.streamerText}>
                                <span className={styles.streamerName}>{room.influencer?.name}</span>
                                <span className={styles.likesCount}>좋아요 수 : {likeCount?.toLocaleString() || 0}</span>
                            </div>
                            <button 
                                className={`${styles.likeButton} ${isLiked ? styles.likeButtonActive : ''}`}
                                onClick={handleLikeClick}
                                title={isLiked ? '좋아요 취소' : '좋아요'}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                    <path fillRule="evenodd" d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
                
                <div className={styles.adBanner}>
                    <div className={styles.adText}>
                        <h2>[광고] AI 스트리머 특별 연애 상담 이벤트</h2>
                        <p>사연 보내고 맞춤형 조언 받아가세요!</p>
                    </div>
                    <button className={styles.adButton}>자세히 보기</button>
                </div>
            </div>

            {/* 오른쪽 라이브 채팅 사이드바 */}
            <div className={styles.chatSidebar}>
                <h2 className={styles.chatTitle}>라이브 채팅</h2>
                <div className={styles.chatMessages} ref={chatContainerRef}>
                    {chatMessages.map((msg, index) => {
                        if (msg.type === 'system_message') {
                            return (
                                <div key={index} className={styles.systemMessage}>
                                    {msg.message}
                                </div>
                            )
                        }
                        
                        if (msg.type === 'donation_message') {
                            return (
                                <div key={index} className={styles.donationMessage}>
                                    <div className={styles.donationHeader}>
                                        <span className={styles.donationEmoji}>💰</span>
                                        <span className={styles.donorName}>{msg.user}님이</span>
                                        <span className={styles.donationText}>
                                            <span className={styles.donationAmount}>{msg.amount.toLocaleString()}</span> 크레딧을 후원하셨습니다.
                                        </span>
                                    </div>
                                    {msg.message && (
                                        <div className={styles.messageContent}>{msg.message}</div>
                                    )}
                                </div>
                            )
                        }
                        
                        if(msg.type === 'chat_message') {
                            return (
                                <div key={index} className={styles.chatMessage}>
                                    <div className={styles.chatAvatar}>
                                        <img 
                                            src={msg.profile_image_url ? `${apiBaseUrl}${msg.profile_image_url}` : "data:image/svg+xml,%3Csvg width='36' height='36' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='36' height='36' fill='%23ddd'/%3E%3Ctext x='50%25' y='50%25' font-size='12' fill='%23999' text-anchor='middle' dy='.3em'%3E👤%3C/text%3E%3C/svg%3E"} 
                                            alt={`${msg.username} 프로필`} 
                                        />
                                    </div>
                                    <div className={styles.messageBody}>
                                        <div className={styles.messageAuthor}>{msg.sender}</div>
                                        <div className={styles.messageContent}>{msg.message}</div>
                                    </div>
                                </div>
                            )
                        }
                        return null;
                    })}
                </div>
                <div className={styles.chatInputSection}>
                    <div className={styles.inputActionWrapper}>
                        <form onSubmit={handleMessageSubmit} className={styles.chatInputForm}>
                            <input
                                type="text"
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                placeholder="메시지 입력..."
                                className={styles.messageInput}
                            />
                            <button type="submit" className={styles.sendButton}>
                                전송
                            </button>
                        </form>
                        <button className={styles.sponsorButton} onClick={() => setIsDonationIslandOpen(true)}>후원</button>
                    </div>
                </div>
            </div>
            {isDonationIslandOpen && (
                <DonationIsland 
                    roomId={roomId} 
                    streamerId={room?.influencer?.id} 
                    onClose={() => setIsDonationIslandOpen(false)} 
                />
            )}
        </div>
    );
}

export default StreamingPage;