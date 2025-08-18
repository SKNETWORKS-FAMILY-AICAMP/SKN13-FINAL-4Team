import React, { useState, useRef, useEffect, useCallback } from 'react';
import './VideoTransitionManager.css';

const VideoTransitionManager = React.forwardRef(({ 
    currentVideo, 
    onVideoLoaded,
    className = ""
}, ref) => {
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [activeVideoIndex, setActiveVideoIndex] = useState(0); // 0 또는 1
    
    const containerRef = useRef(null);
    const video1Ref = useRef(null);
    const video2Ref = useRef(null);
    const transitionTimeoutRef = useRef(null);

    // 현재 활성 비디오와 대기 비디오 참조 가져오기
    const getVideoRefs = useCallback(() => {
        return {
            activeVideo: activeVideoIndex === 0 ? video1Ref.current : video2Ref.current,
            standbyVideo: activeVideoIndex === 0 ? video2Ref.current : video1Ref.current,
            activeRef: activeVideoIndex === 0 ? video1Ref : video2Ref,
            standbyRef: activeVideoIndex === 0 ? video2Ref : video1Ref
        };
    }, [activeVideoIndex]);

    // 비디오 설정 함수
    const setupVideo = useCallback((videoElement, videoSrc, isActive = false) => {
        if (!videoElement) return;

        videoElement.src = `/videos/${videoSrc}`;
        videoElement.muted = true;
        videoElement.loop = true;
        videoElement.playsInline = true;
        videoElement.preload = 'auto';
        
        // 스타일 설정
        videoElement.style.position = 'absolute';
        videoElement.style.top = '0';
        videoElement.style.left = '0';
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        videoElement.style.objectFit = 'contain';
        videoElement.style.transition = 'opacity 1500ms ease-in-out';
        videoElement.style.opacity = isActive ? '1' : '0';
        videoElement.style.zIndex = isActive ? '2' : '1';

        // 이벤트 리스너
        const handleLoadedData = () => {
            console.log('✅ 비디오 로딩 완료:', videoSrc);
            if (onVideoLoaded) {
                onVideoLoaded(videoSrc);
            }
        };

        const handleError = (e) => {
            console.error('❌ 비디오 로딩 오류:', videoSrc, e);
        };

        videoElement.addEventListener('loadeddata', handleLoadedData);
        videoElement.addEventListener('error', handleError);

        // 비디오 로드 시작
        videoElement.load();

        return () => {
            videoElement.removeEventListener('loadeddata', handleLoadedData);
            videoElement.removeEventListener('error', handleError);
        };
    }, [onVideoLoaded]);

    // crossfade 전환 실행
    const executeTransition = useCallback(async (newVideoSrc) => {
        if (isTransitioning) {
            console.log('⏳ 이미 전환 중이므로 새 요청 무시');
            return;
        }

        const { activeVideo, standbyVideo } = getVideoRefs();
        
        if (!activeVideo || !standbyVideo) {
            console.error('❌ 비디오 엘리먼트가 준비되지 않음');
            return;
        }

        console.log('🔄 Crossfade 전환 시작:', newVideoSrc);
        setIsTransitioning(true);

        try {
            // 대기 비디오에 새 소스 설정
            setupVideo(standbyVideo, newVideoSrc, false);
            
            // 대기 비디오가 로딩될 때까지 대기
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('비디오 로딩 타임아웃'));
                }, 10000);

                const handleCanPlay = () => {
                    clearTimeout(timeout);
                    standbyVideo.removeEventListener('canplay', handleCanPlay);
                    resolve();
                };

                if (standbyVideo.readyState >= 3) {
                    // 이미 로딩됨
                    clearTimeout(timeout);
                    resolve();
                } else {
                    standbyVideo.addEventListener('canplay', handleCanPlay);
                }
            });

            // 대기 비디오 재생 시작 (숨김 상태에서)
            await standbyVideo.play();
            console.log('▶️ 대기 비디오 재생 시작');

            // Crossfade 애니메이션
            standbyVideo.style.zIndex = '2';
            activeVideo.style.zIndex = '1';
            
            // 대기 비디오 페이드 인
            await new Promise(resolve => {
                console.log('🎭 Crossfade 시작: 대기 비디오 페이드 인');
                standbyVideo.style.opacity = '1';
                
                transitionTimeoutRef.current = setTimeout(() => {
                    console.log('🎭 활성 비디오 페이드 아웃 시작');
                    // 활성 비디오 페이드 아웃
                    activeVideo.style.opacity = '0';
                    
                    setTimeout(() => {
                        console.log('🎭 전환 완료, 정리 시작');
                        // 전환 완료 후 정리
                        activeVideo.pause();
                        setActiveVideoIndex(prev => prev === 0 ? 1 : 0);
                        resolve();
                    }, 800); // 페이드 아웃 완료까지 대기 (더 길게)
                }, 200); // 페이드 인 후 바로 페이드 아웃 시작
            });

            console.log('✅ Crossfade 전환 완료:', newVideoSrc);

        } catch (error) {
            console.error('❌ 비디오 전환 중 오류:', error);
            
            // 오류 발생 시 대기 비디오 정리
            if (standbyVideo) {
                standbyVideo.pause();
                standbyVideo.style.opacity = '0';
                standbyVideo.style.zIndex = '1';
            }
        } finally {
            setIsTransitioning(false);
        }
    }, [isTransitioning, getVideoRefs, setupVideo]);

    // 초기 비디오 설정
    useEffect(() => {
        if (currentVideo && video1Ref.current) {
            console.log('🎬 초기 비디오 설정:', currentVideo);
            setupVideo(video1Ref.current, currentVideo, true);
            
            // 초기 비디오 재생
            const playVideo = async () => {
                try {
                    await video1Ref.current.play();
                    console.log('▶️ 초기 비디오 재생 시작');
                } catch (error) {
                    console.error('❌ 초기 비디오 재생 오류:', error);
                }
            };

            if (video1Ref.current.readyState >= 3) {
                playVideo();
            } else {
                video1Ref.current.addEventListener('canplay', playVideo, { once: true });
            }
        }
    }, [currentVideo, setupVideo]);

    // currentVideo가 변경될 때 전환 실행
    useEffect(() => {
        console.log('🔄 currentVideo 변경 감지:', currentVideo);
        
        if (currentVideo && containerRef.current) {
            const { activeVideo } = getVideoRefs();
            console.log('📺 현재 활성 비디오:', activeVideo ? activeVideo.src : 'null');
            
            // 현재 재생 중인 비디오와 다른 경우에만 전환
            if (activeVideo && !activeVideo.src.includes(currentVideo)) {
                console.log('🚀 전환 실행 결정:', currentVideo);
                executeTransition(currentVideo);
            } else {
                console.log('⏭️ 전환 스킵 (동일한 비디오 또는 미준비)');
            }
        }
    }, [currentVideo, executeTransition, getVideoRefs]);

    // 컴포넌트 언마운트 시 정리
    useEffect(() => {
        return () => {
            if (transitionTimeoutRef.current) {
                clearTimeout(transitionTimeoutRef.current);
            }
        };
    }, []);

    // 외부에서 사용할 수 있는 메서드들 노출
    React.useImperativeHandle(ref, () => ({
        executeTransition,
        isTransitioning: () => isTransitioning,
        getCurrentVideoSrc: () => {
            const { activeVideo } = getVideoRefs();
            return activeVideo ? activeVideo.src : null;
        }
    }));

    return (
        <div 
            ref={containerRef}
            className={`video-transition-container ${className}`}
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                backgroundColor: '#000',
                overflow: 'hidden'
            }}
        >
            {/* 첫 번째 비디오 엘리먼트 */}
            <video
                ref={video1Ref}
                className="streaming-video video-layer"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    opacity: 1,
                    zIndex: 2,
                    transition: 'opacity 1500ms ease-in-out'
                }}
            />
            
            {/* 두 번째 비디오 엘리먼트 */}
            <video
                ref={video2Ref}
                className="streaming-video video-layer"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    opacity: 0,
                    zIndex: 1,
                    transition: 'opacity 1500ms ease-in-out'
                }}
            />

            {/* 로딩 인디케이터 */}
            {isTransitioning && (
                <div className="transition-loading" style={{
                    position: 'absolute',
                    bottom: '20px',
                    right: '20px',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    zIndex: 10
                }}>
                    🔄 전환 중...
                </div>
            )}
        </div>
    );
});

VideoTransitionManager.displayName = 'VideoTransitionManager';

export default VideoTransitionManager;