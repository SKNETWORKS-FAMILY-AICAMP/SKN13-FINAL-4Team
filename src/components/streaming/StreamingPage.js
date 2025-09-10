import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate  } from 'react-router-dom';
import { getValidToken } from '../../utils/tokenUtils'; 
// HLS.js 완전 제거
import api from '../../api';
// import { getDefaultIdleVideo, getRandomIdleVideo } from '../../utils/videoConfig';

// import VideoPlayer from './VideoPlayer';

import styles from './StreamingPage.module.css';
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
    const [user, setUser] = useState(null);

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
        }
    };

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

    // 비디오 초기화 useEffect (room이 설정된 후)
    useEffect(() => {
        console.log('🎥 비디오 초기화 useEffect:', { 
            hasRoom: !!room, 
            hasInfluencer: !!room?.influencer,
            hasVideoRef: !!videoRef.current 
        });
        
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
            const defaultVideo = `${apiBaseUrl}/videos/${characterId}/${videoFileName}`;
            
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
    }, [room]); // room이 변경될 때마다 실행

    // 채팅 스크롤 자동 내리기
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
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
                                <span className={styles.likesCount}>좋아요 수 : {room.like_count?.toLocaleString() || 0}</span>
                            </div>
                            <button className={styles.likeButton}>
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
                                        <span className={styles.donationAmount}>₩{msg.amount.toLocaleString()}</span>
                                        <span className={styles.donorName}>• {msg.sender}</span>
                                    </div>
                                    <span className={styles.messageContent}>{msg.message}</span>
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
                        <button className={styles.sponsorButton}>후원</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default StreamingPage;