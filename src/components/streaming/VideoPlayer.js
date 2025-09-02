import React, { useState, useRef, useEffect } from 'react';
import { getDefaultIdleVideo } from '../../utils/videoConfig';
import styles from './VideoPlayer.module.css';

const VideoPlayer = React.forwardRef(({ 
    currentVideo, 
    onVideoLoaded,
    className = "",
    donationOverlay,
    characterId = "hongseohyun"  // DB 연동: characterId prop 추가
}, ref) => {
    const [isLoading, setIsLoading] = useState(false);
    const videoRef = useRef(null);

    // 비디오 경로 정리 함수 (DB 연동: characterId 기반 동적 경로)
    const cleanVideoPath = (videoPath) => {
        if (!videoPath) {
            const defaultVideo = getDefaultIdleVideo(characterId);
            return `${characterId}/${defaultVideo}`;
        }
        
        // Backend에서 온 경로 정리: /videos/hongseohyun/hongseohyun_talk_1.mp4 -> hongseohyun/hongseohyun_talk_1.mp4
        let cleanPath = videoPath.replace(/^\/videos\//, '');
        
        // characterId/ 경로가 없으면 추가 (하위 호환성)
        if (!cleanPath.includes('/')) {
            cleanPath = `${characterId}/${cleanPath}`;
        }
        
        console.log('🔧 비디오 경로 정리 (DB 연동):', {
            characterId,
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
            
            // 폴백: video_assets.json에서 캐릭터별 기본 idle 비디오로 복귀
            try {
                const fallbackVideo = getDefaultIdleVideo(characterId);
                const fallbackPath = `${characterId}/${fallbackVideo}`;
                console.log(`🔄 폴백 비디오로 복귀: ${fallbackPath}`);
                
                const video = videoRef.current;
                video.src = `/videos/${fallbackPath}`;
                await video.play();
                
                if (onVideoLoaded) {
                    onVideoLoaded(fallbackPath);
                }
            } catch (fallbackError) {
                console.error('❌ 폴백 비디오도 실패:', fallbackError);
            }
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

    // 초기 비디오 설정 (characterId 의존성 추가)
    useEffect(() => {
        if (videoRef.current) {
            const video = videoRef.current;
            const defaultVideo = getDefaultIdleVideo(characterId);
            const initialVideo = cleanVideoPath(currentVideo || defaultVideo);
            
            console.log('🎬 초기 비디오 설정 (DB 연동):', {
                characterId,
                initialVideo
            });
            
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
    }, [characterId]); // characterId 의존성 추가

    return (
        <div 
            className={`${styles.container} ${className}`}
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
                className={`${styles.streamingVideo} ${styles.videoLayer}`}
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

            {/* 후원 오버레이: 비디오 위에 표시 */}
            {donationOverlay?.visible && donationOverlay?.data && (
                <div 
                    className={styles.donationOverlay}
                    style={{
                        position: 'absolute',
                        top: '20px',
                        right: '0px',
                        zIndex: 20,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        color: 'white',
                        padding: '20px',
                        borderRadius: '10px',
                        textAlign: 'center',
                        maxWidth: '350px',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
                    }}
                >
                    <div className="donation-overlay-content">
                        <div 
                            className="donation-title"
                            style={{
                                fontSize: '1.2rem',
                                fontWeight: 'bold',
                                marginBottom: '10px'
                            }}
                        >
                            <strong>{donationOverlay.data.username}</strong> 님이{' '}
                            <strong style={{ color: '#ffd700' }}>
                                {Number(donationOverlay.data.amount).toLocaleString()}
                            </strong>{' '}
                            크레딧을 후원하셨습니다!! 💰
                        </div>
                        {donationOverlay.data.message && (
                            <div 
                                className="donation-message"
                                style={{
                                    fontSize: '1rem',
                                    fontStyle: 'italic',
                                    color: '#e0e0e0'
                                }}
                            >
                                "{donationOverlay.data.message}"
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;