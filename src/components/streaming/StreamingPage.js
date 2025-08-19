import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios'; 
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Image, Button, Badge, Spinner, Alert } from 'react-bootstrap';
import StreamingChatWithTTS from './StreamingChatWithTTS';
import { AITextSyncService } from '../../services/aiTextSyncService';
import { DEFAULT_SETTINGS } from '../../config/aiChatSettings';
import { TTSServiceManager } from '../../services/ttsServiceManager';
import AITTSEngineSelector from '../ai/AITTSEngineSelector';
import TTSSettingsManager from '../ai/TTSSettingsManager';
import './StreamingPage.css';

function StreamingPage({ isLoggedIn, username }) {
    const { roomId } = useParams();
    const navigate = useNavigate();

    const [chatRoom, setChatRoom] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const audioRef = useRef(null);
    const videoContainerRef = useRef(null);
    
    const [currentSubtitle, setCurrentSubtitle] = useState('');
    const [revealedSubtitle, setRevealedSubtitle] = useState('');
    const [showSubtitle, setShowSubtitle] = useState(false);
    const subtitleTimeoutRef = useRef(null);
    const textSyncServiceRef = useRef(null);
    
    const [debugInfo, setDebugInfo] = useState({});
    const [showDebug, setShowDebug] = useState(false);
    
    const [ttsSettings, setTtsSettings] = useState({
        ...DEFAULT_SETTINGS,
        autoPlay: true,
        ttsEngine: 'elevenlabs',
        elevenLabsVoice: 'aneunjin'
    });
    const [showTtsSettings, setShowTtsSettings] = useState(false);
    const [showSettingsManager, setShowSettingsManager] = useState(false);
    const ttsManagerRef = useRef(null);
    
    const [serverTtsSettings, setServerTtsSettings] = useState(null);
    const [isServerSettingsLoaded, setIsServerSettingsLoaded] = useState(false);

    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(0.8);


    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

    useEffect(() => {
        const fetchChatRoomData = async () => {
            if (!roomId) {
                setError('잘못된 접근입니다.');
                setLoading(false);
                return;
            }
            try {
                const response = await axios.get(`${apiBaseUrl}/api/chat/rooms/${roomId}/`);
                setChatRoom(response.data);
            } catch (err) {
                setError('채팅방 정보를 불러오는 데 실패했습니다.');
                console.error("채팅방 정보 로딩 실패:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchChatRoomData();
    }, [roomId]);

    useEffect(() => {
        if (!isLoggedIn) {
            alert('로그인이 필요한 서비스입니다.');
            navigate('/login');
        }
    }, [isLoggedIn, navigate]);

    const streamerId = chatRoom?.influencer?.username || chatRoom?.host?.username;

    useEffect(() => {
        if (isLoggedIn && streamerId) {
            const fetchServerTtsSettings = async () => {
                try {
                    const token = localStorage.getItem('accessToken');
                    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
                    const response = await fetch(`${apiBaseUrl}/api/streamer/${streamerId}/tts/settings/`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const result = await response.json();
                    if (result.success) {
                        setServerTtsSettings(result.settings);
                        setIsServerSettingsLoaded(true);
                        setTtsSettings(prev => ({ ...prev, ...result.settings }));
                    }
                } catch (error) {
                    console.error('❌ 서버 TTS 설정 로드 오류:', error);
                }
            };
            fetchServerTtsSettings();
        }
    }, [isLoggedIn, streamerId]);

    useEffect(() => {
        if (!ttsManagerRef.current) {
            ttsManagerRef.current = new TTSServiceManager(ttsSettings);
        } else {
            ttsManagerRef.current.updateSettings(ttsSettings);
        }
    }, [ttsSettings]);

    useEffect(() => {
        if (!textSyncServiceRef.current) {
            textSyncServiceRef.current = new AITextSyncService({});
            textSyncServiceRef.current.setCallbacks(
                (revealed) => setRevealedSubtitle(revealed),
                () => {
                    subtitleTimeoutRef.current = setTimeout(() => setShowSubtitle(false), 3000);
                }
            );
        }
    }, []);

    const handleTtsSettingChange = (key, value) => {
        setTtsSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleMuteToggle = () => {
        if (!audioRef.current) return;
        const nextMuted = !audioRef.current.muted;
        audioRef.current.muted = nextMuted;
        setIsMuted(nextMuted);
    };

    const handleVolumeChange = (e) => {
        if (!audioRef.current) return;
        const newVolume = parseFloat(e.target.value);
        audioRef.current.volume = newVolume;
        setVolume(newVolume);
        if (newVolume > 0 && audioRef.current.muted) {
            audioRef.current.muted = false;
            setIsMuted(false);
        }
    };

    const handleFullscreen = () => {
        if (videoContainerRef.current?.requestFullscreen) {
            videoContainerRef.current.requestFullscreen();
        }
    };

    const handleWebSocketMessage = (data) => {
        if (data.type === 'tts_settings_changed' && data.settings) {
            setServerTtsSettings(data.settings);
            setTtsSettings(prev => ({ ...prev, ...data.settings }));
        }
    };

    const handleAIMessage = (message, audioDuration, audioElement, ttsInfo = {}) => {
        setCurrentSubtitle(message);
        setRevealedSubtitle('');
        setShowSubtitle(true);
        if (ttsInfo.serverSettings) setServerTtsSettings(ttsInfo.serverSettings);
        
        if (subtitleTimeoutRef.current) clearTimeout(subtitleTimeoutRef.current);
        if (textSyncServiceRef.current) textSyncServiceRef.current.stopReveal();
        
        if (audioDuration > 0) {
            textSyncServiceRef.current.startSynchronizedReveal(message, audioDuration);
        } else {
            textSyncServiceRef.current.startDelayedReveal(message);
        }
    };

    if (loading) return <Container className="d-flex justify-content-center mt-5"><Spinner animation="border" /></Container>;
    if (error) return <Container className="mt-5"><Alert variant="danger">{error}</Alert></Container>;
    if (!chatRoom) return <Container className="mt-5"><Alert variant="warning">채팅방 정보가 없습니다.</Alert></Container>;

    return (
        <Container fluid className="streaming-container mt-4">
            <Row>
                <Col md={8}>
                    <div className="video-player-wrapper" ref={videoContainerRef}>
                        <video className="streaming-video" autoPlay loop muted playsInline>
                            <source src="/videos/a_idle.mp4" type="video/mp4" />
                            Your browser does not support the video tag.
                        </video>
                        {showSubtitle && revealedSubtitle && (
                            <div className="ai-subtitle">
                                <div className="subtitle-background">
                                    <span className="subtitle-text">{revealedSubtitle}</span>
                                </div>
                            </div>
                        )}
                        <div className="video-controls">
                            <Button variant="secondary" size="sm" onClick={handleMuteToggle}>{isMuted ? 'Unmute' : 'Mute'}</Button>
                            <input type="range" min="0" max="1" step="0.01" value={volume} onChange={handleVolumeChange} className="volume-slider" />
                            <Button variant="secondary" size="sm" onClick={handleFullscreen}>Fullscreen</Button>
                        </div>
                    </div>
                    <div className="stream-info mt-3">
                        <h3>{chatRoom.name}</h3>
                        <div className="d-flex justify-content-between align-items-center text-muted">
                            <span>시청자 수: 0명</span>
                            <span>방송 시작: {new Date(chatRoom.created_at).toLocaleString('ko-KR')}</span>
                        </div>
                        <hr />
                        <div className="d-flex align-items-center my-3">
                            <Image src={chatRoom.influencer?.profile_image ? `${apiBaseUrl}${chatRoom.influencer.profile_image}` : 'https://via.placeholder.com/50'} roundedCircle />
                            <div className="ms-3">
                                <h5 className="mb-0">{chatRoom.influencer?.nickname || chatRoom.host.username}</h5>
                                <p className="mb-0">{chatRoom.description}</p>
                            </div>
                        </div>
                    </div>
                </Col>
                <Col md={4}>
                    <div className="chat-section-wrapper d-flex flex-column h-100">
                        <div className="chat-container-with-input flex-grow-1 d-flex flex-column">
                            <StreamingChatWithTTS 
                                streamerId={streamerId}
                                roomId={roomId}
                                isLoggedIn={isLoggedIn}
                                username={username}
                                onAIMessage={handleAIMessage}
                                onWebSocketMessage={handleWebSocketMessage}
                            />
                        </div>
                    </div>
                </Col>
            </Row>
        </Container>
    );
}

export default StreamingPage;