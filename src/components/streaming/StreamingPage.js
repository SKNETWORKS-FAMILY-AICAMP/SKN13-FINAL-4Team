import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate  } from 'react-router-dom';
import { getValidToken } from '../../utils/tokenUtils'; 
import Hls from 'hls.js';
import api from '../../api';
import styles from './StreamingPage.module.css';
import { w3cwebsocket as W3CWebSocket } from 'websocket';

function StreamingPage() {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const videoRef = useRef(null);
    const hlsRef = useRef(null);
    const [room, setRoom] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const chatClientRef = useRef(null);
    const chatContainerRef = useRef(null);
    const [user, setUser] = useState(null);

    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || '';
    const websocketBaseUrl = process.env.REACT_APP_WEBSOCKET_BASE_URL || 'ws://localhost:8000';

    useEffect(() => {
        // 사용자 정보, 방 정보, HLS 스트림 로딩 로직
        const fetchData = async () => {
            try {
                // API 호출들을 동시에 시작
                const roomPromise = api.get(`/api/chat/rooms/${roomId}/`);
                const userPromise = api.get('/api/users/me/');
                
                // 모든 응답을 기다림
                const [roomResponse, userResponse] = await Promise.all([roomPromise, userPromise]);

                setRoom(roomResponse.data);
                setUser(userResponse.data);

                // HLS 스트림 설정
                const videoSrc = roomResponse.data.hls_url;
                if (videoSrc && Hls.isSupported()) {
                    if (hlsRef.current) {
                        hlsRef.current.destroy();
                    }
                    const hls = new Hls();
                    hlsRef.current = hls;
                    hls.loadSource(videoSrc);
                    hls.attachMedia(videoRef.current);
                    hls.on(Hls.Events.MANIFEST_PARSED, () => {
                        videoRef.current.play().catch(e => console.error("비디오 재생 오류:", e));
                    });
                } else if (videoRef.current) {
                    videoRef.current.src = videoSrc;
                }

            } catch (err) {
                setError('스트림 정보를 불러오는 데 실패했습니다.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
            }
        };
    }, [roomId]);

    // WebSocket 연결 로직
    useEffect(() => {
        // user state가 아직 없으면 아무것도 실행하지 않습니다.
        if (!roomId || !user) return;

        const connectWebSocket = async () => {
            // 🔽 localStorage 대신 안전한 유틸리티 함수를 사용합니다.
            const token = await getValidToken();

            if (!token) {
                console.error("인증 토큰을 찾을 수 없어 웹소켓 연결을 중단합니다.");
                alert("로그인이 필요한 페이지입니다.");
                navigate('/login');
                return;
            }

            const client = new W3CWebSocket(`${websocketBaseUrl}/ws/chat/${roomId}/?token=${token}`);
            chatClientRef.current = client;

            client.onopen = () => console.log('WebSocket Client Connected');
            client.onclose = () => console.log('WebSocket Client Disconnected');
            client.onerror = (err) => console.error('WebSocket Error:', err);

            client.onmessage = (message) => {
                const dataFromServer = JSON.parse(message.data);
                setChatMessages(prev => [...prev, dataFromServer]);
            };
        };
        
        // user 정보가 성공적으로 로드된 후에 웹소켓 연결을 시도합니다.
        connectWebSocket();

        // 컴포넌트가 사라질 때 웹소켓 연결을 정리합니다.
        return () => {
            if (chatClientRef.current) {
                chatClientRef.current.close();
            }
        };
        // 🔽 [수정] 의존성 배열에 user를 추가합니다.
    }, [roomId, user, navigate]); // user가 변경될 때마다 이 useEffect가 다시 실행됩니다.

    // 사용자 정보를 가져오는 useEffect는 분리하여 관리하는 것이 더 좋습니다.
    useEffect(() => {
        const initializePage = async () => {
            try {
                const response = await api.get('/api/users/me/');
                setUser(response.data);
            } catch (err) {
                console.error('사용자 정보 로딩 실패:', err);
                navigate('/login');
            }
        };
        initializePage();
    }, [navigate]); // 이 useEffect는 처음 마운트될 때만 실행됩니다.

    // 채팅 스크롤 자동 내리기
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatMessages]);
    
    // 메시지 전송 로직
    const sendMessage = useCallback((type = 'chat_message', content = messageInput, amount = 0) => {
        if (!content.trim() || !chatClientRef.current || chatClientRef.current.readyState !== chatClientRef.current.OPEN) {
            return;
        }
        chatClientRef.current.send(JSON.stringify({
            type,
            message: content,
            username: user.nickname || user.username,
            amount,
        }));
        if (type === 'chat_message') {
            setMessageInput('');
        }
    }, [messageInput, roomId, user]);

    const handleMessageSubmit = (e) => {
        e.preventDefault();
        sendMessage();
    };

    if (loading) return <div className={styles.pageContainer}><p>로딩 중...</p></div>;
    if (error) return <div className={styles.pageContainer}><p>{error}</p></div>;
    if (!room) return <div className={styles.pageContainer}><p>방 정보를 찾을 수 없습니다.</p></div>;

    const profileImageUrl = room.influencer?.profile_image 
        ? (room.influencer.profile_image.startsWith('http') ? room.influencer.profile_image : `${apiBaseUrl}${room.influencer.profile_image}`)
        : `https://via.placeholder.com/50`;

    return (
        <div className={styles.pageContainer}>
            {/* 왼쪽 메인 콘텐츠 영역 */}
            <div className={styles.streamMainContent}>
                <div className={styles.videoPlayerContainer}>
                    <video ref={videoRef} className={styles.videoPlayer} controls autoPlay muted></video>
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
                    {chatMessages.map((msg, index) => (
                        <div key={index} className={`${styles.chatMessage} ${msg.type === 'donation_message' ? styles.donationMessage : ''}`}>
                            {msg.type === 'donation_message' ? (
                                <>
                                    <span className={styles.donationAmount}>₩{msg.amount.toLocaleString()}</span>
                                    <span className={styles.donorName}>{msg.username}</span>
                                    <span className={styles.messageContent}>{msg.message}</span>
                                </>
                            ) : (
                                <>
                                    <span className={styles.messageAuthor}>{msg.username}</span>
                                    <span className={styles.messageContent}>{msg.message}</span>
                                </>
                            )}
                        </div>
                    ))}
                </div>
                <div className={styles.chatInputSection}>
                    <form onSubmit={handleMessageSubmit} className={styles.chatInputForm}>
                        <input
                            type="text"
                            value={messageInput}
                            onChange={(e) => setMessageInput(e.target.value)}
                            placeholder="메시지 입력..."
                            className={styles.messageInput}
                        />
                        <button type="submit" className={styles.sendButton}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M15.964.686a.5.5 0 0 0-.65-.65L.767 5.855H.766l-.452.18a.5.5 0 0 0-.082.887l.41.26.001.002 4.995 3.178 3.178 4.995.002.002.26.41a.5.5 0 0 0 .886-.083l6-15Zm-1.833 1.89L6.637 10.07l-4.995-3.178 11.03-6.142Z"/>
                            </svg>
                        </button>
                    </form>
                    <button className={styles.sponsorButton}>후원</button>
                </div>
            </div>
        </div>
    );
}

export default StreamingPage;