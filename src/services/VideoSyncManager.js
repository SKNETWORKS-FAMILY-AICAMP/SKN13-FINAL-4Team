/**
 * 비디오 클립 동기화 관리 시스템
 * TTS 길이 기반 비디오 매칭 및 립싱크 효과를 담당
 */
export class VideoSyncManager {
    constructor(videoTransitionManager, options = {}) {
        this.videoTransitionManager = videoTransitionManager;
        this.options = {
            // 비디오 매핑 설정
            defaultIdleVideo: options.defaultIdleVideo || 'a_idle_0.mp4',
            talkingVideos: options.talkingVideos || ['a_talk_0.mp4', 'a_talk_1.mp4'],
            emotionVideos: options.emotionVideos || {
                happy: ['a_laugh_0.mp4'],
                angry: ['a_angry_0.mp4'],
                nod: ['a_nod_0.mp4'],
                idle: ['a_idle_0.mp4', 'a_idle_1.mp4', 'a_idle_3.mp4', 'a_idle_4.mp4']
            },
            
            // 동기화 설정
            minTalkingDuration: options.minTalkingDuration || 1.0,    // 최소 talking 비디오 재생 시간 (초)
            maxTalkingDuration: options.maxTalkingDuration || 8.0,    // 최대 talking 비디오 재생 시간 (초)
            transitionBuffer: options.transitionBuffer || 200,        // 비디오 전환 버퍼 시간 (ms)
            emotionKeywords: options.emotionKeywords || {
                happy: ['웃음', '기쁘', '행복', '좋아', '재미', '하하', 'ㅋㅋ', '😊', '😄', '😂'],
                angry: ['화나', '짜증', '싫어', '아니', '안돼', '에이', '아이고'],
                nod: ['맞아', '그래', '좋아', '네', '예', '응', '오케이', 'OK', '알겠']
            },
            
            // 립싱크 설정
            enableLipSync: options.enableLipSync !== false,
            lipSyncAccuracy: options.lipSyncAccuracy || 'medium',     // low, medium, high
            videoLoopStrategy: options.videoLoopStrategy || 'smart',   // simple, smart, seamless
            
            ...options
        };

        // 상태 관리
        this.currentSyncState = 'idle';              // idle, talking, emotion, transitioning
        this.currentVideoClip = this.options.defaultIdleVideo;
        this.activeSyncJob = null;
        this.videoQueue = [];                        // 예약된 비디오 변경들
        this.syncTimeouts = [];
        
        // 감정 분석 캐시
        this.emotionCache = new Map();
        
        // 성능 통계
        this.stats = {
            totalSyncs: 0,
            successfulSyncs: 0,
            failedSyncs: 0,
            averageSyncAccuracy: 0,
            emotionDetections: 0
        };

        // 콜백 함수들
        this.onVideoChange = null;
        this.onSyncStart = null;
        this.onSyncComplete = null;
        this.onEmotionDetected = null;
    }

    /**
     * 콜백 함수들 설정
     */
    setCallbacks({ onVideoChange, onSyncStart, onSyncComplete, onEmotionDetected }) {
        this.onVideoChange = onVideoChange;
        this.onSyncStart = onSyncStart;
        this.onSyncComplete = onSyncComplete;
        this.onEmotionDetected = onEmotionDetected;
    }

    /**
     * TTS 오디오와 비디오 동기화 시작
     * @param {string} text - 발화 텍스트
     * @param {number} audioDuration - 오디오 재생 시간 (초)
     * @param {string} chunkId - 청크 고유 식별자
     * @param {Object} options - 동기화 옵션
     */
    async syncVideoWithTTS(text, audioDuration, chunkId, options = {}) {
        try {
            this.stats.totalSyncs++;
            
            console.log(`🎬 VideoSyncManager: 동기화 시작`, {
                chunkId,
                text: text.substring(0, 50) + '...',
                audioDuration,
                currentState: this.currentSyncState
            });

            // 감정 분석
            const detectedEmotion = this._analyzeEmotion(text);
            
            // 적절한 비디오 클립 선택
            const selectedVideo = this._selectVideoClip(text, audioDuration, detectedEmotion);
            
            // 동기화 작업 생성
            const syncJob = {
                id: chunkId,
                text,
                audioDuration,
                selectedVideo,
                detectedEmotion,
                startTime: Date.now(),
                status: 'preparing'
            };

            this.activeSyncJob = syncJob;
            this.currentSyncState = detectedEmotion || 'talking';

            if (this.onSyncStart) {
                this.onSyncStart(syncJob);
            }

            // 감정 감지 콜백
            if (detectedEmotion && this.onEmotionDetected) {
                this.stats.emotionDetections++;
                this.onEmotionDetected({
                    emotion: detectedEmotion,
                    text,
                    confidence: this._getEmotionConfidence(text, detectedEmotion)
                });
            }

            // 비디오 전환 실행
            await this._executeVideoTransition(selectedVideo, audioDuration, syncJob);

            // 동기화 완료 처리
            this._completeSyncJob(syncJob, true);

        } catch (error) {
            console.error(`❌ VideoSyncManager: 동기화 실패`, error);
            this.stats.failedSyncs++;
            
            if (this.activeSyncJob) {
                this._completeSyncJob(this.activeSyncJob, false, error.message);
            }
        }
    }

    /**
     * 텍스트에서 감정 분석
     */
    _analyzeEmotion(text) {
        // 캐시 확인
        if (this.emotionCache.has(text)) {
            return this.emotionCache.get(text);
        }

        let detectedEmotion = null;
        let maxScore = 0;

        // 키워드 기반 감정 분석
        for (const [emotion, keywords] of Object.entries(this.options.emotionKeywords)) {
            let score = 0;
            
            for (const keyword of keywords) {
                const regex = new RegExp(keyword, 'gi');
                const matches = (text.match(regex) || []).length;
                score += matches;
            }

            if (score > maxScore) {
                maxScore = score;
                detectedEmotion = emotion;
            }
        }

        // 점수가 너무 낮으면 감정 없음으로 처리
        if (maxScore < 1) {
            detectedEmotion = null;
        }

        // 캐시에 저장
        this.emotionCache.set(text, detectedEmotion);

        if (detectedEmotion) {
            console.log(`😊 감정 감지: ${detectedEmotion} (점수: ${maxScore}) - "${text.substring(0, 30)}..."`);
        }

        return detectedEmotion;
    }

    /**
     * 감정 신뢰도 계산
     */
    _getEmotionConfidence(text, emotion) {
        const keywords = this.options.emotionKeywords[emotion] || [];
        let matches = 0;
        
        for (const keyword of keywords) {
            const regex = new RegExp(keyword, 'gi');
            matches += (text.match(regex) || []).length;
        }

        // 텍스트 길이 대비 매칭 키워드 비율로 신뢰도 계산
        const confidence = Math.min(matches / (text.length / 10), 1.0);
        return Math.round(confidence * 100);
    }

    /**
     * 적절한 비디오 클립 선택
     */
    _selectVideoClip(text, audioDuration, emotion) {
        // 1. 감정 기반 비디오 선택
        if (emotion && this.options.emotionVideos[emotion]) {
            const emotionVideos = this.options.emotionVideos[emotion];
            const selectedVideo = emotionVideos[Math.floor(Math.random() * emotionVideos.length)];
            
            console.log(`🎭 감정 비디오 선택: ${selectedVideo} (감정: ${emotion})`);
            return selectedVideo;
        }

        // 2. 음성 길이 기반 talking 비디오 선택
        if (audioDuration >= this.options.minTalkingDuration && 
            audioDuration <= this.options.maxTalkingDuration) {
            
            const talkingVideos = this.options.talkingVideos;
            const selectedVideo = talkingVideos[Math.floor(Math.random() * talkingVideos.length)];
            
            console.log(`🗣️ 말하기 비디오 선택: ${selectedVideo} (길이: ${audioDuration}s)`);
            return selectedVideo;
        }

        // 3. 기본 idle 비디오
        const idleVideos = this.options.emotionVideos.idle;
        const selectedVideo = idleVideos[Math.floor(Math.random() * idleVideos.length)];
        
        console.log(`😐 기본 비디오 선택: ${selectedVideo}`);
        return selectedVideo;
    }

    /**
     * 비디오 전환 실행
     */
    async _executeVideoTransition(videoFile, audioDuration, syncJob) {
        syncJob.status = 'transitioning';

        try {
            // 비디오 전환 매니저를 통한 전환
            if (this.videoTransitionManager && this.videoTransitionManager.changeVideo) {
                await this.videoTransitionManager.changeVideo(videoFile);
            }

            this.currentVideoClip = videoFile;
            syncJob.actualVideo = videoFile;
            syncJob.status = 'playing';

            // 비디오 변경 콜백 호출
            if (this.onVideoChange) {
                this.onVideoChange({
                    video: videoFile,
                    duration: audioDuration,
                    emotion: syncJob.detectedEmotion,
                    syncId: syncJob.id
                });
            }

            // 립싱크 모드에서는 비디오를 오디오 길이에 맞춰 제어
            if (this.options.enableLipSync) {
                await this._manageLipSync(videoFile, audioDuration, syncJob);
            }

            // 오디오 종료 후 idle 상태로 복귀 스케줄링
            const returnToIdleTimeout = setTimeout(() => {
                this._returnToIdleState();
            }, (audioDuration * 1000) + this.options.transitionBuffer);

            this.syncTimeouts.push(returnToIdleTimeout);

        } catch (error) {
            syncJob.status = 'failed';
            throw error;
        }
    }

    /**
     * 립싱크 관리
     */
    async _manageLipSync(videoFile, audioDuration, syncJob) {
        console.log(`👄 립싱크 시작: ${videoFile} (${audioDuration}s)`);

        // 비디오 루프 전략에 따른 처리
        switch (this.options.videoLoopStrategy) {
            case 'simple':
                // 단순 반복: 비디오를 계속 루프
                break;
                
            case 'smart':
                // 스마트 루프: 오디오 길이에 맞춰 적절한 구간 반복
                await this._smartVideoLoop(videoFile, audioDuration);
                break;
                
            case 'seamless':
                // 매끄러운 전환: 여러 비디오 클립 조합
                await this._seamlessVideoTransition(videoFile, audioDuration);
                break;
        }
    }

    /**
     * 스마트 비디오 루프
     */
    async _smartVideoLoop(videoFile, audioDuration) {
        // 비디오 클립의 실제 길이를 고려하여 적절한 루프 계획 수립
        // 구현: 비디오 메타데이터 로드 후 루프 횟수 계산
        console.log(`🔄 스마트 루프 적용: ${videoFile}`);
    }

    /**
     * 매끄러운 비디오 전환
     */
    async _seamlessVideoTransition(videoFile, audioDuration) {
        // 여러 관련 비디오 클립을 조합하여 자연스러운 전환 구현
        console.log(`🌊 매끄러운 전환 적용: ${videoFile}`);
    }

    /**
     * idle 상태로 복귀
     */
    _returnToIdleState() {
        if (this.currentSyncState === 'idle') {
            return;
        }

        console.log(`😐 Idle 상태로 복귀`);
        
        this.currentSyncState = 'idle';
        const idleVideo = this._selectIdleVideo();
        
        if (this.videoTransitionManager && this.videoTransitionManager.changeVideo) {
            this.videoTransitionManager.changeVideo(idleVideo);
        }

        this.currentVideoClip = idleVideo;

        if (this.onVideoChange) {
            this.onVideoChange({
                video: idleVideo,
                duration: 0,
                emotion: null,
                syncId: 'idle-return'
            });
        }
    }

    /**
     * 랜덤 idle 비디오 선택
     */
    _selectIdleVideo() {
        const idleVideos = this.options.emotionVideos.idle;
        return idleVideos[Math.floor(Math.random() * idleVideos.length)];
    }

    /**
     * 동기화 작업 완료 처리
     */
    _completeSyncJob(syncJob, success, errorMessage = null) {
        syncJob.status = success ? 'completed' : 'failed';
        syncJob.completedAt = Date.now();
        syncJob.duration = syncJob.completedAt - syncJob.startTime;

        if (success) {
            this.stats.successfulSyncs++;
        } else {
            this.stats.failedSyncs++;
            syncJob.error = errorMessage;
        }

        // 동기화 정확도 업데이트 (성공한 경우만)
        if (success) {
            const accuracy = this._calculateSyncAccuracy(syncJob);
            this.stats.averageSyncAccuracy = 
                (this.stats.averageSyncAccuracy * (this.stats.successfulSyncs - 1) + accuracy) / 
                this.stats.successfulSyncs;
        }

        console.log(`${success ? '✅' : '❌'} 동기화 작업 ${success ? '완료' : '실패'}: ${syncJob.id} (${syncJob.duration}ms)`);

        if (this.onSyncComplete) {
            this.onSyncComplete(syncJob);
        }

        // 현재 작업이 완료된 경우 상태 초기화
        if (this.activeSyncJob && this.activeSyncJob.id === syncJob.id) {
            this.activeSyncJob = null;
        }
    }

    /**
     * 동기화 정확도 계산
     */
    _calculateSyncAccuracy(syncJob) {
        // 여러 요소를 고려한 정확도 계산
        let accuracy = 100;

        // 감정 매칭 정확도
        if (syncJob.detectedEmotion) {
            accuracy += 10; // 감정 감지 보너스
        }

        // 비디오 선택 적절성
        if (syncJob.actualVideo && syncJob.selectedVideo === syncJob.actualVideo) {
            accuracy += 5; // 예상대로 비디오 선택됨
        }

        // 처리 시간 효율성
        const processingEfficiency = Math.max(0, 100 - (syncJob.duration / 100));
        accuracy += processingEfficiency * 0.1;

        return Math.min(100, Math.max(0, accuracy));
    }

    /**
     * 모든 동기화 중단
     */
    stopAllSync() {
        // 모든 타이머 정리
        this.syncTimeouts.forEach(timeout => clearTimeout(timeout));
        this.syncTimeouts = [];

        // 현재 작업 중단
        if (this.activeSyncJob) {
            this._completeSyncJob(this.activeSyncJob, false, '사용자에 의해 중단됨');
        }

        // 상태 초기화
        this.currentSyncState = 'idle';
        this.videoQueue = [];

        console.log('⏹️ 모든 비디오 동기화 중단');
    }

    /**
     * 감정 캐시 정리
     */
    clearEmotionCache() {
        this.emotionCache.clear();
        console.log('🗑️ 감정 분석 캐시 정리');
    }

    /**
     * 현재 상태 반환
     */
    getStatus() {
        return {
            currentSyncState: this.currentSyncState,
            currentVideoClip: this.currentVideoClip,
            activeSyncJob: this.activeSyncJob,
            videoQueueLength: this.videoQueue.length,
            emotionCacheSize: this.emotionCache.size,
            stats: { ...this.stats }
        };
    }

    /**
     * 설정 업데이트
     */
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        console.log('⚙️ VideoSyncManager: 설정 업데이트', this.options);
    }
}

export default VideoSyncManager;