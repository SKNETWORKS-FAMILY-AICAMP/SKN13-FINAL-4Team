import React, { useState, useEffect } from 'react';
import { Card, Button, Form, ButtonGroup, Badge } from 'react-bootstrap';

// 비디오 설정 유틸리티 임포트
import { getVideoAssetsConfig } from '../../utils/videoConfig';

function VideoControlPanel({ onVideoChange, characterId }) {
    const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const [videoFiles, setVideoFiles] = useState([]);
    const [isConfigLoaded, setIsConfigLoaded] = useState(false);
    
    // Backend API에서 가져온 설정으로 characterId에 따른 비디오 목록 생성
    const loadVideoFiles = async (characterId) => {
        try {
            const videoAssetsConfig = getVideoAssetsConfig();
            
            // 설정이 아직 로드되지 않았으면 기다림
            if (!videoAssetsConfig || !videoAssetsConfig.characters) {
                console.warn('⚠️ 비디오 설정이 아직 로드되지 않았습니다. 로딩 대기...');
                return [];
            }
            
            const characterConfig = videoAssetsConfig.characters[characterId];
            if (!characterConfig) {
                console.warn(`⚠️ 캐릭터 '${characterId}' 설정을 찾을 수 없습니다.`);
                return [];
            }
            
            const videoFiles = [];
            const videoCategories = characterConfig.videoCategories;
            
            // 각 카테고리별로 비디오 파일들을 수집
            Object.entries(videoCategories).forEach(([category, categoryConfig]) => {
                const files = categoryConfig.files || [];
                files.forEach(filename => {
                    // 카테고리별 라벨 매핑
                    const categoryLabels = {
                        'idle': '대기',
                        'talk': '대화',
                        'laugh': '웃음',
                        'smile': '미소',
                        'happy': '기쁨',
                        'angry': '화남',
                        'nod': '끄덕임',
                        'thanks': '감사',
                        'wondering': '궁금'
                    };
                    
                    // 파일명에서 번호 추출 (예: hongseohyun_idle_2.mp4 → 2)
                    const numberMatch = filename.match(/_(\d+)\.mp4$/);
                    const number = numberMatch ? numberMatch[1] : '';
                    
                    const label = categoryLabels[category] || category;
                    const displayLabel = number ? `${label} ${number}` : label;
                    
                    videoFiles.push({
                        name: filename,
                        label: displayLabel,
                        category: category
                    });
                });
            });
            
            console.log(`✅ 비디오 파일 로딩 완료: ${characterId} (${videoFiles.length}개)`);
            return videoFiles;
        } catch (error) {
            console.error('❌ 비디오 파일 로딩 실패:', error);
            return [];
        }
    };

    // 비디오 설정 로딩
    useEffect(() => {
        const initVideoFiles = async () => {
            const effectiveCharacterId = characterId || getVideoAssetsConfig().systemSettings?.defaultCharacter || "hongseohyun";
            const files = await loadVideoFiles(effectiveCharacterId);
            setVideoFiles(files);
            setIsConfigLoaded(true);
            
            // 첫 번째 비디오를 부모에게 알림 (비활성화 - 무한루프 방지)
            // if (onVideoChange && files.length > 0) {
            //     const firstVideo = files[0];
            //     console.log('🎬 VideoControlPanel: 초기 비디오 설정', firstVideo.name);
            //     onVideoChange(firstVideo, 0);
            // }
        };
        
        initVideoFiles();
    }, [characterId, onVideoChange]);

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

    // 설정이 로드되지 않았으면 로딩 표시
    if (!isConfigLoaded) {
        return (
            <div style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                zIndex: 1000,
                backgroundColor: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '10px',
                borderRadius: '5px'
            }}>
                🔄 비디오 설정 로딩 중...
            </div>
        );
    }

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