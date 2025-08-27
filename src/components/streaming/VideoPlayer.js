import React, { useState, useRef, useEffect } from 'react';
import './VideoPlayer.css';

const VideoPlayer = React.forwardRef(({ 
    currentVideo, 
    onVideoLoaded,
    className = ""
}, ref) => {
    const [isLoading, setIsLoading] = useState(false);
    const videoRef = useRef(null);

    // 비디오 경로 정리 함수
    const cleanVideoPath = (videoPath) => {
        if (!videoPath) return 'jammin-i/a_idle_0.mp4';
        
        // Backend에서 온 경로 정리: /videos/jammin-i/a_talk_0.mp4 -> jammin-i/a_talk_0.mp4
        let cleanPath = videoPath.replace(/^\/videos\//, '');
        
        // jammin-i/ 경로가 없으면 추가
        if (!cleanPath.startsWith('jammin-i/')) {
            cleanPath = `jammin-i/${cleanPath}`;
        }
        
        console.log('🔧 비디오 경로 정리:', {
            original: videoPath,
            cleaned: cleanPath
        });
        
        return cleanPath;
    };

    // 비디오 변경 함수 (즉시 전환)
    const changeVideo = async (videoPath) => {
        if (!videoRef.current) return;

        const cleanPath = cleanVideoPath(videoPath);
        console.log(`🎥 비디오 즉시 전환: ${cleanPath}`);
        
        setIsLoading(true);

        try {
            const video = videoRef.current;
            video.pause();
            video.src = `/videos/${cleanPath}`;
            
            // 비디오 로딩 대기
            await new Promise((resolve, reject) => {
                const handleCanPlay = () => {
                    video.removeEventListener('canplay', handleCanPlay);
                    video.removeEventListener('error', handleError);
                    resolve();
                };
                
                const handleError = () => {
                    video.removeEventListener('canplay', handleCanPlay);
                    video.removeEventListener('error', handleError);
                    reject(new Error(`비디오 로딩 실패: ${cleanPath}`));
                };
                
                video.addEventListener('canplay', handleCanPlay);
                video.addEventListener('error', handleError);
                video.load();
                
                // 5초 타임아웃
                setTimeout(() => {
                    video.removeEventListener('canplay', handleCanPlay);
                    video.removeEventListener('error', handleError);
                    reject(new Error('비디오 로딩 타임아웃'));
                }, 5000);
            });

            // 자동 재생
            await video.play();
            console.log(`✅ 비디오 전환 완료: ${cleanPath}`);
            
            if (onVideoLoaded) {
                onVideoLoaded(cleanPath);
            }
            
        } catch (error) {
            console.error('❌ 비디오 전환 실패:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // ref 메서드 노출
    React.useImperativeHandle(ref, () => ({
        changeVideo,
        getCurrentVideo: () => currentVideo,
        isLoading: () => isLoading
    }));

    // currentVideo 변경 감지
    useEffect(() => {
        if (currentVideo && videoRef.current) {
            console.log('🔄 currentVideo 변경 감지:', currentVideo);
            changeVideo(currentVideo);
        }
    }, [currentVideo]);

    // 초기 비디오 설정
    useEffect(() => {
        if (videoRef.current) {
            const video = videoRef.current;
            const initialVideo = cleanVideoPath(currentVideo || 'a_idle_0.mp4');
            
            console.log('🎬 초기 비디오 설정:', initialVideo);
            
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            video.preload = 'auto';
            video.src = `/videos/${initialVideo}`;
            
            video.addEventListener('loadeddata', () => {
                console.log('✅ 초기 비디오 로딩 완료:', initialVideo);
                video.play().then(() => {
                    console.log('▶️ 초기 비디오 재생 시작');
                }).catch(error => {
                    console.warn('⚠️ 초기 재생 실패:', error);
                });
            });
            
            video.load();
        }
    }, []);

    return (
        <div 
            className={`video-player-container ${className}`}
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                backgroundColor: '#000',
                overflow: 'hidden'
            }}
        >
            <video
                ref={videoRef}
                className="streaming-video video-layer"
                style={{
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    zIndex: 1
                }}
                muted
                playsInline
                preload="auto"
            />
            
            {/* 로딩 표시 */}
            {isLoading && (
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        color: 'white',
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        padding: '10px 20px',
                        borderRadius: '5px',
                        zIndex: 10
                    }}
                >
                    🔄 비디오 전환 중...
                </div>
            )}
        </div>
    );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;