/**
 * MediaPacket 기반 동기화 컨트롤러
 * 지터버퍼 300ms 적용 + seq 기반 순차 재생
 * DDD StreamSession과 연계된 큐 시스템
 */
import { getDefaultIdleVideo, getRandomIdleVideo, idleRotationManager } from '../utils/videoConfig';

export class MediaSyncController {
    constructor(videoTransitionManager, audioRef, options = {}) {
        this.videoTransitionManager = videoTransitionManager;
        this.audioRef = audioRef;
        
        this.options = {
            autoReturnToIdle: true,
            debugLogging: true,
            characterId: 'hongseohyun', // DB 연동: 기본 characterId 추가
            useRandomIdle: true, // 랜덤 idle 비디오 사용
            idleRotationInterval: 0, // idle 순환 비활성화 (문제 해결을 위해 일시적으로)
            ...options
        };
        
        // 오디오 진행률 업데이트용 인터벌
        this.audioProgressInterval = null;
        
        // 현재 재생 상태
        this.currentPlayback = null;
        this.syncTimeouts = new Map();
        
        console.log('🎬 DB 연동 MediaSyncController 초기화:', this.options);
        
        // Idle 순환 시작
        this._startIdleRotation();
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
            
            // 에러 발생 시 폴백: idle 비디오로 복귀
            this._handlePlaybackError(error, syncData?.sync_id);
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
            
            // 1. Talk 비디오로 즉시 전환 (DB 연동: 동적 경로 처리)
            if (content.talk_video && this.videoTransitionManager?.current?.changeVideo) {
                const talkVideoPath = this._cleanVideoPath(content.talk_video);
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
                    this._startAudioProgressTracking();
                }
                
                // Idle 복귀 스케줄링 (DB 연동: 랜덤/순환 idle 비디오 사용)
                const idleTimeout = setTimeout(() => {
                    // 랜덤 또는 순환 idle 비디오 선택
                    let selectedIdleVideo;
                    if (this.options.useRandomIdle) {
                        selectedIdleVideo = getRandomIdleVideo(this.options.characterId);
                    } else {
                        selectedIdleVideo = getDefaultIdleVideo(this.options.characterId);
                    }
                    
                    const idleVideoPath = this._cleanVideoPath(selectedIdleVideo);
                    
                    console.log(`🏠 랜덤 Idle 복귀: ${idleVideoPath}`);
                    if (this.videoTransitionManager?.current?.changeVideo) {
                        this.videoTransitionManager.current.changeVideo(idleVideoPath);
                    }
                    
                    // 재생 상태 정리
                    if (this.currentPlayback?.sync_id === sync_id) {
                        this.currentPlayback.state = 'idle';
                        
                        // Idle 복귀 콜백
                        if (this.options.onIdleReturn) {
                            this.options.onIdleReturn(`/videos/${this.options.characterId}/${selectedIdleVideo}`, sync_id);
                        }
                    }
                }, audioDuration + 1500); // 오디오 + 1.5초 여유
                
                this.syncTimeouts.set(`${sync_id}_idle`, idleTimeout);
            }
            
            console.log(`✅ 간단한 재생 설정 완료: ${sync_id ? sync_id.substring(0, 8) : 'undefined'}`);
            
        } catch (error) {
            console.error('❌ 간단한 재생 실행 실패:', error);
            this._handlePlaybackError(error, sync_id);
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
        });
    }
    
    /**
     * DB 연동: 비디오 경로 정리 함수
     */
    _cleanVideoPath(videoPath) {
        if (!videoPath) {
            const defaultVideo = getDefaultIdleVideo(this.options.characterId);
            return `${this.options.characterId}/${defaultVideo}`;
        }
        
        // Backend에서 온 경로 정리: /videos/hongseohyun/hongseohyun_talk_1.mp4 -> hongseohyun/hongseohyun_talk_1.mp4
        let cleanPath = videoPath.replace(/^\/videos\//, '');
        
        // characterId가 포함되지 않은 경우 추가 (하위 호환성)
        if (!cleanPath.includes('/')) {
            cleanPath = `${this.options.characterId}/${cleanPath}`;
        }
        
        if (this.options.debugLogging) {
            console.log('🔧 MediaSyncController 비디오 경로 정리:', {
                characterId: this.options.characterId,
                original: videoPath,
                cleaned: cleanPath
            });
        }
        
        return cleanPath;
    }
    
    /**
     * characterId 업데이트
     */
    updateCharacterId(characterId) {
        // 기존 idle 순환 중지
        this._stopIdleRotation();
        
        this.options.characterId = characterId;
        if (this.options.debugLogging) {
            console.log('🔄 MediaSyncController characterId 업데이트:', characterId);
        }
        
        // 새 캐릭터로 idle 순환 재시작
        this._startIdleRotation();
    }
    
    /**
     * Idle 순환 시스템 시작
     */
    _startIdleRotation() {
        if (!this.options.idleRotationInterval || this.options.idleRotationInterval <= 0) {
            return;
        }
        
        // 기존 순환 중지
        this._stopIdleRotation();
        
        // 자동 idle 순환 시작
        idleRotationManager.startAutoRotation(
            this.options.characterId,
            this.options.idleRotationInterval,
            (nextIdleVideo) => {
                // TTS 재생 중이거나 오디오가 재생 중일 때는 순환하지 않음
                const isAudioPlaying = this.audioRef?.current && !this.audioRef.current.paused;
                const isTTSPlaying = this.currentPlayback && this.currentPlayback.state !== 'idle';
                
                if (!isAudioPlaying && !isTTSPlaying) {
                    const idleVideoPath = this._cleanVideoPath(nextIdleVideo);
                    
                    if (this.videoTransitionManager?.current?.changeVideo) {
                        console.log(`⏰ 자동 idle 순환: ${idleVideoPath} (다음 순환까지 ${this.options.idleRotationInterval/1000}초)`);
                        this.videoTransitionManager.current.changeVideo(idleVideoPath);
                        
                        // 콜백 호출
                        if (this.options.onIdleReturn) {
                            this.options.onIdleReturn(`/videos/${this.options.characterId}/${nextIdleVideo}`, 'auto_rotation');
                        }
                    }
                } else {
                    if (this.options.debugLogging) {
                        console.log('⏸️ TTS/오디오 재생 중이므로 idle 순환 건너뜀');
                    }
                }
            }
        );
    }
    
    /**
     * Idle 순환 시스템 중지
     */
    _stopIdleRotation() {
        idleRotationManager.stopAutoRotation(this.options.characterId);
    }
    
    /**
     * 재생 에러 처리 및 폴백
     */
    _handlePlaybackError(error, sync_id) {
        console.error('🚨 재생 에러 발생:', error);
        
        // 현재 재생 정리
        this._clearCurrentPlayback();
        
        try {
            // 폴백: 기본 idle 비디오로 복귀
            if (this.videoTransitionManager?.current?.changeVideo) {
                const fallbackVideo = getDefaultIdleVideo(this.options.characterId);
                const fallbackPath = fallbackVideo;
                console.log(`🔄 에러 복구: 폴백 비디오로 전환 - ${fallbackPath}`);
                
                this.videoTransitionManager.current.changeVideo(fallbackPath)
                    .catch(fallbackError => {
                        console.error('❌ 폴백 비디오 전환도 실패:', fallbackError);
                    });
            }
            
            // 에러 콜백 호출
            if (this.options.onPlaybackError) {
                this.options.onPlaybackError(sync_id, error);
            }
            
        } catch (fallbackError) {
            console.error('❌ 에러 처리 중 추가 에러 발생:', fallbackError);
        }
    }
    
    /**
     * 오디오 진행률 추적 시작
     */
    _startAudioProgressTracking() {
        this._stopAudioProgressTracking();
        
        if (!this.audioRef?.current) return;
        
        const audio = this.audioRef.current;
        
        this.audioProgressInterval = setInterval(() => {
            if (!audio.paused && !audio.ended && audio.duration) {
                const currentTime = audio.currentTime;
                const duration = audio.duration;
                const progress = (currentTime / duration) * 100;
                
                // 진행률 콜백 호출
                if (this.options.onAudioProgress) {
                    this.options.onAudioProgress(currentTime, duration, progress);
                }
                
                if (this.options.debugLogging) {
                    // 5초마다만 로깅 (스팸 방지)
                    if (Math.floor(currentTime) % 5 === 0 && Math.floor(currentTime * 10) % 10 === 0) {
                        console.log(`🎵 오디오 진행률: ${currentTime.toFixed(1)}s / ${duration.toFixed(1)}s (${progress.toFixed(1)}%)`);
                    }
                }
            }
        }, 100);
        
        // 오디오 종료 시 정리
        const handleAudioEnded = () => {
            if (this.options.onAudioProgress) {
                this.options.onAudioProgress(audio.duration, audio.duration, 100);
            }
            this._stopAudioProgressTracking();
            audio.removeEventListener('ended', handleAudioEnded);
        };
        
        audio.addEventListener('ended', handleAudioEnded);
    }
    
    /**
     * 오디오 진행률 추적 중지
     */
    _stopAudioProgressTracking() {
        if (this.audioProgressInterval) {
            clearInterval(this.audioProgressInterval);
            this.audioProgressInterval = null;
        }
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
        
        // 오디오 진행률 추적 중지
        this._stopAudioProgressTracking();
        
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
        
        // 비디오를 idle로 복귀 (DB 연동: characterId 기반)
        if (this.videoTransitionManager?.current?.changeVideo) {
            const idleVideo = getDefaultIdleVideo(this.options.characterId);
            this.videoTransitionManager.current.changeVideo(idleVideo);
        }
    }
    
    /**
     * 🆕 즉시 재생 중단 (새 요청으로 인한 취소)
     */
    abort() {
        console.log('🚫 MediaSyncController 즉시 중단 (새 요청으로 인해)');
        
        // 현재 재생 중인 모든 항목 정리
        this._clearCurrentPlayback();
        
        // 현재 재생 중인 오디오 즉시 중단
        if (this.audioRef?.current && !this.audioRef.current.paused) {
            this.audioRef.current.pause();
            this.audioRef.current.currentTime = 0;
            console.log('🔇 오디오 재생 즉시 중단됨');
        }
        
        // 상태를 중단됨으로 표시
        if (this.currentPlayback) {
            this.currentPlayback.state = 'aborted';
            console.log(`🚫 재생 중단됨: ${this.currentPlayback.sync_id ? this.currentPlayback.sync_id.substring(0, 8) : 'undefined'}`);
        }
        
        // 에러 콜백 호출 (중단됨을 알림)
        if (this.options.onPlaybackError) {
            this.options.onPlaybackError(this.currentPlayback?.sync_id, 'aborted_by_new_request');
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
     * 설정 업데이트
     */
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        console.log('⚙️ MediaSyncController 설정 업데이트:', newOptions);
    }
}