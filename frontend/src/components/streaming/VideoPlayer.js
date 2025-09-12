import React, { useState, useRef, useEffect } from 'react';
import { getDefaultIdleVideo, getVideoAssetsConfig } from '../../utils/videoConfig';
import styles from './VideoPlayer.module.css';

const VideoPlayer = React.forwardRef(({ 
    currentVideo, 
    onVideoLoaded,
    className = "",
    donationOverlay,
    characterId  // DB 연동: characterId prop (필수)
}, ref) => {
    console.log('🚨 VideoPlayer 컴포넌트 시작:', { characterId, currentVideo, className });
    
    const [isLoading, setIsLoading] = useState(false);
    const videoRef = useRef(null);

    // 비디오 경로 정리 함수 (DB 연동: characterId 기반 동적 경로)
    const cleanVideoPath = (videoPath) => {
        console.log('🔧 cleanVideoPath 호출됨:', { videoPath, characterId });
        
        if (!videoPath) {
            console.log('🔍 비디오 경로가 없음, 기본 idle 비디오 가져오기:', characterId);
            const defaultVideo = getDefaultIdleVideo(characterId);
            console.log('📹 기본 비디오 결과:', defaultVideo);
            const result = `/videos/${characterId}/${defaultVideo}`;
            console.log('🎯 최종 경로:', result);
            return result;
        }
        
        // 경로 정리: 중복 제거 및 정규화
        let cleanPath = videoPath;
        console.log('🔧 정리 전 경로:', cleanPath);
        
        // 이미 올바른 /videos/ 경로로 시작하는 경우 그대로 반환 (중복 방지)
        if (cleanPath.startsWith('/videos/') && !cleanPath.includes('//')) {
            console.log('🔧 이미 올바른 경로임, 그대로 반환:', cleanPath);
            return cleanPath;
        }
        
        // 중복된 /videos/ 제거 및 정규화
        cleanPath = cleanPath.replace(/\/videos\/+/g, '/videos/');
        cleanPath = cleanPath.replace(/\/videos\/\/videos\//g, '/videos/');
        console.log('🔧 중복 제거 후:', cleanPath);
        
        // /videos/로 시작하지 않으면 추가
        if (!cleanPath.startsWith('/videos/')) {
            if (!cleanPath.includes('/')) {
                // 파일명만 있는 경우
                console.log('🔧 파일명만 있는 경우:', cleanPath);
                cleanPath = `/videos/${characterId}/${cleanPath}`;
            } else {
                // 경로가 있지만 /videos/로 시작하지 않는 경우
                // 절대 경로가 아닌 경우에만 /videos/ 추가
                if (!cleanPath.startsWith('/')) {
                    console.log('🔧 상대 경로인 경우:', cleanPath);
                    cleanPath = `/videos/${cleanPath}`;
                } else {
                    // 이미 절대 경로인 경우는 그대로 유지
                    console.log('🔧 이미 절대 경로인 경우:', cleanPath);
                    cleanPath = cleanPath;
                }
            }
        }
        
        // 최종 중복 제거 및 정규화
        cleanPath = cleanPath.replace(/\/+/g, '/');
        cleanPath = cleanPath.replace(/\/videos\/\/videos\//g, '/videos/');
        console.log('🔧 최종 정리 후:', cleanPath);
        
        console.log('🔧 비디오 경로 정리 (DB 연동):', {
            characterId,
            original: videoPath,
            cleaned: cleanPath
        });
        
        return cleanPath;
    };

    // 비디오 변경 함수 (즉시 전환)
    const changeVideo = async (videoPath) => {
        console.log(`🎥 VideoPlayer.changeVideo 호출됨:`, {
            videoPath,
            hasVideoRef: !!videoRef.current,
            characterId
        });
        
        if (!videoRef.current) {
            console.error('❌ VideoPlayer.changeVideo: videoRef가 없음');
            return;
        }

        const cleanPath = cleanVideoPath(videoPath);
        console.log(`🎥 비디오 즉시 전환: ${videoPath} -> ${cleanPath}`);
        
        setIsLoading(true);

        try {
            const video = videoRef.current;
            video.pause();
            video.src = cleanPath;
            
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
                console.log('🔄 폴백 시도 - characterId:', characterId);
                const fallbackVideo = getDefaultIdleVideo(characterId);
                console.log('🔄 폴백 비디오 결과:', fallbackVideo);
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
    React.useImperativeHandle(ref, () => {
        console.log('🔗 VideoPlayer ref 메서드 노출됨', { characterId });
        return {
            changeVideo,
            getCurrentVideo: () => currentVideo,
            isLoading: () => isLoading
        };
    });

    // currentVideo 변경 감지
    useEffect(() => {
        if (currentVideo && videoRef.current) {
            console.log('🔄 currentVideo 변경 감지:', currentVideo);
            changeVideo(currentVideo);
        }
    }, [currentVideo]);

    // 초기 비디오 설정 - characterId 필수, 없으면 렌더링 방지
    useEffect(() => {
        console.log('🔍 VideoPlayer useEffect 호출됨:', { characterId, videoRefReady: !!videoRef.current });
        if (!characterId || !videoRef.current) {
            console.warn('⚠️ VideoPlayer: characterId가 없거나 videoRef가 준비되지 않음', { characterId, videoRef: !!videoRef.current });
            return;
        }
        
        const initializeVideo = async () => {
            try {
                const video = videoRef.current;
                
                // 즉시 기본 비디오 설정 - video_assets.json 설정 우선, 없으면 _idle_1.mp4 fallback
                let defaultVideo;
                try {
                    // 비디오 설정에서 해당 캐릭터의 기본 idle 비디오 가져오기
                    const config = getVideoAssetsConfig();
                    const characterConfig = config.characters && config.characters[characterId];
                    
                    if (characterConfig && characterConfig.videoCategories && characterConfig.videoCategories.idle) {
                        const videoBasePath = characterConfig.videoBasePath || `/videos/${characterId}/`;
                        const fileName = characterConfig.videoCategories.idle.defaultFile;
                        defaultVideo = `${videoBasePath}${fileName}`;
                        console.log(`🎯 video_assets.json에서 기본 비디오 조합: ${videoBasePath} + ${fileName} = ${defaultVideo}`);
                    } else {
                        // 일반적인 fallback: _idle_1.mp4
                        defaultVideo = `/videos/${characterId}/${characterId}_idle_2.mp4`;
                        console.log(`📋 fallback 기본 비디오 사용: ${defaultVideo}`);
                    }
                } catch (error) {
                    // 최종 fallback
                    defaultVideo = `/videos/${characterId}/${characterId}_idle_2.mp4`;
                    console.log(`⚠️ 설정 로드 실패, 최종 fallback: ${defaultVideo}`);
                }
                
                const initialVideo = currentVideo || defaultVideo;
                
                console.log('🎬 즉시 비디오 설정 (race condition 방지):', {
                    characterId,
                    initialVideo,
                    currentVideo
                });
                
                video.muted = true;
                video.loop = true;
                video.playsInline = true;
                video.preload = 'auto';
                console.log('🎬 video.src 설정 직전:', initialVideo);
                video.src = initialVideo;
                console.log('🎬 video.src 설정 완료:', video.src);
                
                const handleLoadedData = () => {
                    console.log('✅ 즉시 비디오 로딩 완료:', initialVideo);
                    console.log('🎬 비디오 상태:', {
                        readyState: video.readyState,
                        networkState: video.networkState,
                        paused: video.paused,
                        ended: video.ended,
                        currentSrc: video.currentSrc
                    });
                    
                    video.play().then(() => {
                        console.log('▶️ 즉시 비디오 재생 시작 성공');
                        console.log('🎬 재생 후 비디오 상태:', {
                            paused: video.paused,
                            currentTime: video.currentTime,
                            duration: video.duration
                        });
                        
                        // 백그라운드에서 설정 기반 최적 비디오로 교체 시도
                        setTimeout(() => {
                            const config = getVideoAssetsConfig();
                            if (config.characters && config.characters[characterId]) {
                                const optimalVideo = getDefaultIdleVideo(characterId);
                                const optimalPath = cleanVideoPath(optimalVideo);
                                
                                // 현재와 다른 비디오면 교체
                                if (optimalPath !== initialVideo) {
                                    console.log('🔄 최적 비디오로 백그라운드 교체:', optimalPath);
                                    changeVideo(optimalPath);
                                }
                            }
                        }, 1000);
                        
                    }).catch(error => {
                        console.error('❌ 즉시 재생 실패 상세:', error);
                        console.log('🎬 재생 실패 시 비디오 상태:', {
                            readyState: video.readyState,
                            networkState: video.networkState,
                            error: video.error ? {
                                code: video.error.code,
                                message: video.error.message
                            } : null
                        });
                    });
                };
                
                const handleError = (error) => {
                    console.error('❌ 비디오 로드 실패, 폴백 시도:', error);
                    // 폴백: 캐릭터별 기본 파일
                    const fallbackVideo = getDefaultIdleVideo(characterId);
                    const fallbackPath = `/videos/${characterId}/${fallbackVideo}`;
                    video.src = fallbackPath;
                    video.load();
                };
                
                video.addEventListener('loadeddata', handleLoadedData, { once: true });
                video.addEventListener('error', handleError, { once: true });
                
                video.load();
                
            } catch (error) {
                console.error('❌ 초기 비디오 설정 오류:', error);
                // 최종 폴백
                const video = videoRef.current;
                video.src = `/videos/${characterId}/hongseohyun_idle_2.mp4`;
                video.load();
            }
        };
        
        initializeVideo();
    }, [characterId]); // characterId 의존성만 유지

    console.log('🎬 VideoPlayer 렌더링 도달:', { characterId, isLoading, currentVideo });

    // characterId가 없으면 null 반환
    if (!characterId) {
        console.log('❌ characterId가 없어서 컴포넌트 렌더링 안함');
        return null;
    }

    return (
        <div className={`${styles.container} ${className}`}>
            <video
                ref={videoRef}
                className={`${styles.streamingVideo} ${styles.videoLayer}`}
                style={{
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    zIndex: 1
                }}
                autoPlay
                loop
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