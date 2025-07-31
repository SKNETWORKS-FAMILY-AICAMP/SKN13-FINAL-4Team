import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Row, Col, Image, Button, Form, Badge } from 'react-bootstrap';
import './StreamingPage.css';

function StreamingPage({ isLoggedIn, username }) {
    const { streamerId } = useParams();
    const [message, setMessage] = useState('');
    const [chatHistory, setChatHistory] = useState([
        { nickname: '팬1', text: '안녕하세요! 기대하고 있었어요.' },
        { nickname: '열혈팬', text: '오늘 방송도 화이팅!' },
        { nickname: '잼민이', text: '여러분 안녕하세요! 오늘 방송을 시작하겠습니다.' },
    ]);
    
    const chatContainerRef = useRef(null);
    const audioRef = useRef(null);
    const videoContainerRef = useRef(null);

    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(0.8);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory]);

    const handleAction = (action) => {
        if (!isLoggedIn) {
            alert('로그인이 필요한 기능입니다.');
            return;
        }
        action();
    };

    const handleSendMessage = () => {
        handleAction(() => {
            if (message.trim() === '') return;
            const newMessage = { nickname: username, text: message };
            setChatHistory(prev => [...prev.slice(-99), newMessage]);
            setMessage('');
        });
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleDonation = () => handleAction(() => alert('준비중입니다.'));
    const handleEmoji = () => handleAction(() => alert('준비중입니다.'));

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
        if (videoContainerRef.current && videoContainerRef.current.requestFullscreen) {
            videoContainerRef.current.requestFullscreen();
        }
    };

    const streamInfo = {
        title: 'AI 스트리머 잼민이의 첫 방송!',
        viewers: 1234,
        streamer: { name: '잼민이', profilePic: 'https://via.placeholder.com/50', bio: 'sLLM 기반 AI 스트리머입니다. 여러분과 소통하고 싶어요!' },
        keywords: ['AI', 'sLLM', '소통', 'Q&A', '첫방송'],
    };

    return (
        <Container fluid className="streaming-container mt-4">
            <Row>
                <Col md={8}>
                    <div className="video-player-wrapper" ref={videoContainerRef}>
                        <Image src="https://via.placeholder.com/800x450/000000?text=AI+Streamer+Image" fluid />
                        <audio ref={audioRef} autoPlay style={{ display: 'none' }} />
                        <div className="video-controls">
                            <Button variant="secondary" size="sm" onClick={handleMuteToggle}>
                                {isMuted ? 'Unmute' : 'Mute'}
                            </Button>
                            <input 
                                type="range" 
                                min="0" 
                                max="1" 
                                step="0.01" 
                                value={volume} 
                                onChange={handleVolumeChange} 
                                className="volume-slider" 
                            />
                            <Button variant="secondary" size="sm" onClick={handleFullscreen}>Fullscreen</Button>
                        </div>
                    </div>
                    <div className="stream-info mt-3">
                        <h3>{streamInfo.title}</h3>
                        <div className="d-flex justify-content-between align-items-center text-muted">
                            <span>시청자 수: {streamInfo.viewers}명</span>
                            <span>방송 시간: 00:12:34</span>
                        </div>
                        <hr />
                        <div className="d-flex align-items-center my-3">
                            <Image src={streamInfo.streamer.profilePic} roundedCircle />
                            <div className="ms-3">
                                <h5 className="mb-0">{streamInfo.streamer.name}</h5>
                                <p className="mb-0">{streamInfo.streamer.bio}</p>
                            </div>
                        </div>
                        <div className="keywords">
                            {streamInfo.keywords.map(k => <Badge pill bg="info" className="me-2" key={k}>#{k}</Badge>)}
                        </div>
                    </div>
                </Col>
                <Col md={4}>
                    <div className="chat-wrapper">
                        <div className="chat-box" ref={chatContainerRef}>
                            {chatHistory.map((chat, index) => (
                                <div key={index} className="chat-message">
                                    <strong>{chat.nickname}:</strong> <span>{chat.text}</span>
                                </div>
                            ))}
                        </div>
                        <div className="chat-input-section">
                            <div className="d-flex justify-content-between mb-2">
                                <Button variant="warning" onClick={handleDonation}>후원</Button>
                                <div>
                                    <Button variant="light" className="me-2" onClick={handleEmoji}>😊</Button>
                                    <Button variant="primary" onClick={handleSendMessage} disabled={!isLoggedIn || !message.trim()}>전송</Button>
                                </div>
                            </div>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                placeholder={isLoggedIn ? "메시지를 입력하세요..." : "로그인 후 채팅에 참여할 수 있습니다."}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyPress={handleKeyPress}
                                disabled={!isLoggedIn}
                            />
                        </div>
                    </div>
                </Col>
            </Row>
        </Container>
    );
}

export default StreamingPage;