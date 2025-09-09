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
        let hlsInstance = null;
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
                
                setUser(currentUser);
                setRoom(currentRoom);

                // 3. HLS 비디오 스트림 설정
                const videoSrc = currentRoom.hls_url;
                if (videoSrc && Hls.isSupported() && videoRef.current) {
                    hlsInstance = new Hls();
                    hlsInstance.loadSource(videoSrc);
                    hlsInstance.attachMedia(videoRef.current);
                    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
                        videoRef.current?.play().catch(e => console.error("비디오 자동 재생 실패:", e));
                    });
                    hlsRef.current = hlsInstance;
                }

                // 4. 모든 정보가 준비된 후 웹소켓 연결
                websocketClient = new W3CWebSocket(`${websocketBaseUrl}/ws/chat/${roomId}/?token=${token}`);
                chatClientRef.current = websocketClient;

                websocketClient.onopen = () => {
                    console.log('WebSocket Client Connected');
                    //setChatMessages(prev => [...prev, { type: 'system_message', message: `${currentUser.nickname || currentUser.username}님이 채팅에 참여했습니다.` }]);
                };

                websocketClient.onmessage = (message) => {
                    const dataFromServer = JSON.parse(message.data);
                    setChatMessages(prev => [...prev, dataFromServer]);
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

        // 컴포넌트가 사라질 때 모든 연결을 정리
        return () => {
            hlsInstance?.destroy();
            websocketClient?.close();
        };
    }, [roomId, navigate, websocketBaseUrl]); // roomId 변경 시에만 전체 로직 재실행

    // 채팅 스크롤 자동 내리기
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
        console.log("Current Chat Messages:", chatMessages);
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
                                                <span className={styles.donorName}>• {msg.sender}</span> {/* 닉네임 표시 */}
                                            </div>
                                            <span className={styles.messageContent}>{msg.message}</span>
                                        </div>
                                    )
                                }
                                if(msg.type === 'chat_message')
                                {
                                    return (
                                        <div key={index} className={styles.chatMessage}>
                                            <div className={styles.chatAvatar}>
                                                <img 
                                                    src={msg.profile_image_url ? `${apiBaseUrl}${msg.profile_image_url}` : `https://via.placeholder.com/36`} 
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
                                        {/* SVG 아이콘 */}
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