import React, { useState, useEffect } from 'react';
import { Card, Button, Form, ButtonGroup, Badge } from 'react-bootstrap';

function VideoControlPanel({ onVideoChange }) {
    const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    
    // 비디오 목록 정의 (실제 존재하는 파일들)
    const videoFiles = [
        { name: 'a_idle_0.mp4', label: 'Idle 기본', category: 'idle' },
        { name: 'a_idle_1.mp4', label: 'Idle 1', category: 'idle' },
        { name: 'a_idle_3.mp4', label: 'Idle 3', category: 'idle' },
        { name: 'a_idle_4.mp4', label: 'Idle 4', category: 'idle' },
        { name: 'a_talk_0.mp4', label: 'Talk 0', category: 'talk' },
        { name: 'a_talk_1.mp4', label: 'Talk 1', category: 'talk' },
        { name: 'a_nod_0.mp4', label: 'Nod', category: 'gesture' },
        { name: 'a_laugh_0.mp4', label: 'Laugh', category: 'emotion' },
        { name: 'a_angry_0.mp4', label: 'Angry', category: 'emotion' }
    ];

    // 비디오 변경
    const changeVideo = (index) => {
        if (index >= 0 && index < videoFiles.length) {
            const video = videoFiles[index];
            console.log('🎬 VideoControlPanel: 비디오 변경 요청', {
                index,
                video: video.name,
                currentIndex: currentVideoIndex
            });
            
            setCurrentVideoIndex(index);
            
            // 부모 컴포넌트에 변경 알림
            if (onVideoChange) {
                console.log('📡 부모 컴포넌트에 비디오 변경 알림 전송');
                onVideoChange(video, index);
            } else {
                console.warn('⚠️ onVideoChange 콜백이 없습니다');
            }
        }
    };

    // 이전 비디오
    const previousVideo = () => {
        const newIndex = currentVideoIndex > 0 ? currentVideoIndex - 1 : videoFiles.length - 1;
        changeVideo(newIndex);
    };

    // 다음 비디오
    const nextVideo = () => {
        const newIndex = currentVideoIndex < videoFiles.length - 1 ? currentVideoIndex + 1 : 0;
        changeVideo(newIndex);
    };

    // 카테고리별 색상
    const getCategoryColor = (category) => {
        const colors = {
            idle: 'primary',
            talk: 'success',
            gesture: 'info',
            emotion: 'warning'
        };
        return colors[category] || 'secondary';
    };

    // 컴포넌트 마운트 시 기본 비디오 설정
    useEffect(() => {
        if (onVideoChange && videoFiles.length > 0) {
            onVideoChange(videoFiles[0], 0);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!isVisible) {
        return (
            <Button 
                variant="outline-light" 
                size="sm" 
                onClick={() => setIsVisible(true)}
                style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    zIndex: 1000
                }}
            >
                🎬 비디오 제어
            </Button>
        );
    }

    return (
        <div style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            zIndex: 1000,
            width: '320px'
        }}>
            <Card bg="dark" text="white" className="shadow">
                <Card.Header className="d-flex justify-content-between align-items-center">
                    <span>🎬 비디오 제어</span>
                    <Button 
                        variant="outline-light" 
                        size="sm" 
                        onClick={() => setIsVisible(false)}
                    >
                        ✕
                    </Button>
                </Card.Header>
                <Card.Body>
                    {/* 현재 재생 중인 비디오 정보 */}
                    <div className="mb-3">
                        <h6 className="mb-2">현재 비디오</h6>
                        <div className="d-flex justify-content-between align-items-center">
                            <span>{videoFiles[currentVideoIndex]?.label}</span>
                            <Badge bg={getCategoryColor(videoFiles[currentVideoIndex]?.category)}>
                                {videoFiles[currentVideoIndex]?.category}
                            </Badge>
                        </div>
                        <small className="text-muted">{videoFiles[currentVideoIndex]?.name}</small>
                    </div>

                    {/* 비디오 네비게이션 버튼 */}
                    <ButtonGroup className="w-100 mb-3">
                        <Button variant="outline-light" size="sm" onClick={previousVideo}>
                            ⏮️ 이전
                        </Button>
                        <Button 
                            variant="warning" 
                            size="sm" 
                            onClick={() => {
                                console.log('🧪 테스트: Talk 비디오로 강제 전환');
                                changeVideo(4); // a_talk_0.mp4
                            }}
                        >
                            🧪 테스트
                        </Button>
                        <Button variant="outline-light" size="sm" onClick={nextVideo}>
                            ⏭️ 다음
                        </Button>
                    </ButtonGroup>

                    {/* 비디오 선택 드롭다운 */}
                    <div className="mb-3">
                        <Form.Label>비디오 선택</Form.Label>
                        <Form.Select 
                            value={currentVideoIndex} 
                            onChange={(e) => changeVideo(parseInt(e.target.value))}
                            size="sm"
                        >
                            {videoFiles.map((video, index) => (
                                <option key={index} value={index}>
                                    {video.label} - {video.category}
                                </option>
                            ))}
                        </Form.Select>
                    </div>

                    {/* 카테고리별 빠른 선택 */}
                    <div>
                        <Form.Label className="mb-2">카테고리별 선택</Form.Label>
                        {['idle', 'talk', 'gesture', 'emotion'].map(category => {
                            const categoryVideos = videoFiles.map((video, index) => ({ ...video, index }))
                                .filter(video => video.category === category);
                            
                            return (
                                <div key={category} className="mb-2">
                                    <Badge bg={getCategoryColor(category)} className="me-2 mb-1">
                                        {category}
                                    </Badge>
                                    <div className="d-flex flex-wrap gap-1">
                                        {categoryVideos.map((video) => (
                                            <Button
                                                key={video.index}
                                                variant={currentVideoIndex === video.index ? "light" : "outline-light"}
                                                size="sm"
                                                onClick={() => changeVideo(video.index)}
                                                style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                                            >
                                                {video.label.split(' ')[1] || video.label}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card.Body>
            </Card>
        </div>
    );
}

export default VideoControlPanel;