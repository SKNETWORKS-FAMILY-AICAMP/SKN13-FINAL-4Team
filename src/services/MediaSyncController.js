/**
 * MediaPacket 기반 동기화 컨트롤러
 * 지터버퍼 300ms 적용 + seq 기반 순차 재생
 * DDD StreamSession과 연계된 큐 시스템
 */

export class MediaSyncController {
    constructor(videoTransitionManager, audioRef, options = {}) {
        this.videoTransitionManager = videoTransitionManager;
        this.audioRef = audioRef;
        
        this.options = {
            autoReturnToIdle: true,
            debugLogging: true,
            ...options
        };
        
        // 현재 재생 상태
        this.currentPlayback = null;
        this.syncTimeouts = new Map();
        
        console.log('🎬 간단한 MediaSyncController 초기화:', this.options);
    }
    
    /**
     * 간단한 미디어 처리 - 즉시 실행
     */
    handleSynchronizedMedia(syncData) {
        try {
            const { sync_id, content } = syncData;
            
            if (this.options.debugLogging) {
                console.log('📡 간단한 미디어 수신:', {
                    sync_id: sync_id ? sync_id.substring(0, 8) : 'undefined',
                    text_length: content.text?.length || 0,
                    audio_duration: content.audio_duration,
                    talk_video: content.talk_video,
                    idle_video: content.idle_video
                });
            }
            
            // 이전 재생 정리
            this._clearCurrentPlayback();
            
            // 즉시 실행 (타이밍 계산 생략)
            this._executeSimplePlay(sync_id, content);
            
        } catch (error) {
            console.error('❌ 간단한 미디어 처리 실패:', error);
        }
    }
    
    /**
     * 간단한 재생 실행
     */
    async _executeSimplePlay(sync_id, content) {
        try {
            console.log(`🎬 간단한 재생 시작: ${sync_id ? sync_id.substring(0, 8) : 'undefined'}`);
            
            this.currentPlayback = {
                sync_id,
                content,
                start_time: Date.now(),
                state: 'playing'
            };
            
            // 1. Talk 비디오로 즉시 전환
            if (content.talk_video && this.videoTransitionManager?.current?.changeVideo) {
                const talkVideoPath = content.talk_video.replace(/^\/videos\//, '').replace(/^jammin-i\//, '');
                const audioDuration = (content.audio_duration || 5) * 1000; // ms 변환
                
                console.log(`🗣️ Talk 시작: ${talkVideoPath} (${audioDuration}ms)`);
                
                // 비디오 전환
                await this.videoTransitionManager.current.changeVideo(talkVideoPath);
                
                // Talk 시작 콜백
                if (this.options.onTalkStart) {
                    this.options.onTalkStart(content.talk_video, sync_id);
                }
                
                // 오디오 재생
                if (content.audio_url && this.audioRef?.current) {
                    await this._playAudio(content.audio_url);
                }
                
                // Idle 복귀 스케줄링
                if (content.idle_video) {
                    const idleVideoPath = content.idle_video.replace(/^\/videos\//, '').replace(/^jammin-i\//, '');
                    
                    const idleTimeout = setTimeout(() => {
                        console.log(`🏠 Idle 복귀: ${idleVideoPath}`);
                        if (this.videoTransitionManager?.current?.changeVideo) {
                            this.videoTransitionManager.current.changeVideo(idleVideoPath);
                        }
                        
                        // 재생 상태 정리
                        if (this.currentPlayback?.sync_id === sync_id) {
                            this.currentPlayback.state = 'idle';
                            
                            // Idle 복귀 콜백
                            if (this.options.onIdleReturn) {
                                this.options.onIdleReturn(content.idle_video, sync_id);
                            }
                        }
                    }, audioDuration + 1500); // 오디오 + 1.5초 여유
                    
                    this.syncTimeouts.set(`${sync_id}_idle`, idleTimeout);
                }
            }
            
            console.log(`✅ 간단한 재생 설정 완료: ${sync_id ? sync_id.substring(0, 8) : 'undefined'}`);
            
        } catch (error) {
            console.error('❌ 간단한 재생 실행 실패:', error);
        }
    }
    
    /**
     * 오디오 재생
     */
    async _playAudio(audioUrl) {
        return new Promise((resolve) => {
            if (!this.audioRef?.current) {
                resolve();
                return;
            }
            
            const audio = this.audioRef.current;
            audio.src = audioUrl;
            
            const handleCanPlay = () => {
                audio.removeEventListener('canplay', handleCanPlay);
                audio.removeEventListener('error', handleError);
                
                audio.play()
                    .then(() => {
                        console.log('▶️ 간단한 오디오 재생 시작');
                        resolve();
                    })
                    .catch((error) => {
                        console.warn('⚠️ 오디오 재생 실패:', error);
                        resolve();
                    });
            };
            
            const handleError = (error) => {
                audio.removeEventListener('canplay', handleCanPlay);
                audio.removeEventListener('error', handleError);
                console.warn('⚠️ 오디오 로딩 실패:', error);
                resolve();
            };
            
            audio.addEventListener('canplay', handleCanPlay);
            audio.addEventListener('error', handleError);
            
            audio.load();
            
            // 3초 타임아웃
            setTimeout(() => {
                audio.removeEventListener('canplay', handleCanPlay);
                audio.removeEventListener('error', handleError);
                resolve();
            }, 3000);
        });
    }
    
    /**
     * 현재 재생 정리
     */
    _clearCurrentPlayback() {
        // 기존 타임아웃들 정리
        for (const [sync_id, timeout] of this.syncTimeouts) {
            clearTimeout(timeout);
        }
        this.syncTimeouts.clear();
        
        // 오디오 정지
        if (this.audioRef?.current) {
            this.audioRef.current.pause();
            this.audioRef.current.currentTime = 0;
        }
        
        if (this.currentPlayback) {
            console.log(`🛑 간단한 재생 정리: ${this.currentPlayback.sync_id ? this.currentPlayback.sync_id.substring(0, 8) : 'undefined'}`);
            this.currentPlayback = null;
        }
    }
    
    /**
     * 강제 정지
     */
    stop() {
        console.log('⏹️ 간단한 재생 강제 정지');
        this._clearCurrentPlayback();
        
        // 비디오를 idle로 복귀
        if (this.videoTransitionManager?.current?.changeVideo) {
            this.videoTransitionManager.current.changeVideo('a_idle_0.mp4');
        }
    }
    
    /**
     * 현재 재생 상태 반환
     */
    getPlaybackStatus() {
        return {
            isPlaying: this.currentPlayback?.state === 'playing',
            sync_id: this.currentPlayback?.sync_id,
            start_time: this.currentPlayback?.start_time,
            active_timeouts: this.syncTimeouts.size
        };
    }
    
    /**
     * 오디오 재생 (누락된 메서드 구현)
     */
    async _playAudio(audioUrl) {
        try {
            if (!this.audioRef?.current) {
                console.warn('⚠️ audioRef가 없어 오디오 재생 불가');
                return;
            }

            console.log('🎵 오디오 재생 시작:', audioUrl.substring(0, 50) + '...');
            
            // 오디오 소스 설정 및 재생
            this.audioRef.current.src = audioUrl;
            this.audioRef.current.currentTime = 0;
            
            // 재생 시도
            await this.audioRef.current.play();
            console.log('✅ 오디오 재생 시작됨');
            
        } catch (error) {
            console.error('❌ 오디오 재생 실패:', error);
        }
    }
    
    /**
     * 설정 업데이트
     */
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        console.log('⚙️ MediaSyncController 설정 업데이트:', newOptions);
    }
}