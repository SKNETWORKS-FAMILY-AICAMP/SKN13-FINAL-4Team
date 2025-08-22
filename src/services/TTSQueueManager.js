/**
 * TTS 큐 관리 시스템
 * 순차적 음성 생성, 재생 및 버퍼링을 담당
 */
export class TTSQueueManager {
    constructor(ttsManager, options = {}) {
        this.ttsManager = ttsManager;
        this.options = {
            maxConcurrentJobs: options.maxConcurrentJobs || 2,    // 동시 TTS 생성 작업 수
            preloadNext: options.preloadNext !== false,           // 다음 청크 미리 로드
            retryAttempts: options.retryAttempts || 2,            // TTS 생성 재시도 횟수
            timeoutMs: options.timeoutMs || 15000,                // TTS 생성 타임아웃
            enableCaching: options.enableCaching !== false,      // 오디오 캐싱 활성화
            ...options
        };

        // 큐 상태 관리
        this.queue = [];                    // 대기 중인 TTS 작업들
        this.activeJobs = new Map();        // 현재 처리 중인 작업들
        this.completedCache = new Map();    // 완료된 오디오 캐시
        this.isProcessing = false;
        
        // 오디오 관리
        this.audioElements = new Map();     // 청크별 오디오 엘리먼트
        this.currentPlayingId = null;
        this.playbackQueue = [];           // 재생 대기열
        
        // 성능 통계
        this.stats = {
            totalJobs: 0,
            completedJobs: 0,
            failedJobs: 0,
            averageGenerationTime: 0,
            cacheHits: 0,
            totalGenerationTime: 0
        };

        // 콜백 함수들
        this.onJobComplete = null;
        this.onJobFailed = null;
        this.onQueueEmpty = null;
        this.onPlaybackStart = null;
        this.onPlaybackComplete = null;
        this.onProgress = null;
    }

    /**
     * 콜백 함수들 설정
     */
    setCallbacks({
        onJobComplete,
        onJobFailed,
        onQueueEmpty,
        onPlaybackStart,
        onPlaybackComplete,
        onProgress
    }) {
        this.onJobComplete = onJobComplete;
        this.onJobFailed = onJobFailed;
        this.onQueueEmpty = onQueueEmpty;
        this.onPlaybackStart = onPlaybackStart;
        this.onPlaybackComplete = onPlaybackComplete;
        this.onProgress = onProgress;
    }

    /**
     * TTS 작업을 큐에 추가
     * @param {string} text - 변환할 텍스트
     * @param {string} id - 고유 식별자
     * @param {Object} options - TTS 옵션
     * @param {number} priority - 우선순위 (낮을수록 높은 우선순위)
     */
    addToQueue(text, id, options = {}, priority = 0) {
        // 캐시 확인
        const cacheKey = this._generateCacheKey(text, options);
        if (this.options.enableCaching && this.completedCache.has(cacheKey)) {
            console.log(`📦 TTS 캐시 히트: ${id}`);
            this.stats.cacheHits++;
            
            const cachedAudio = this.completedCache.get(cacheKey);
            if (this.onJobComplete) {
                this.onJobComplete({
                    id,
                    text,
                    audioUrl: cachedAudio.url,
                    duration: cachedAudio.duration,
                    fromCache: true
                });
            }
            return;
        }

        const job = {
            id,
            text,
            options,
            priority,
            status: 'queued',
            createdAt: Date.now(),
            attempts: 0
        };

        // 우선순위에 따라 큐에 삽입
        const insertIndex = this.queue.findIndex(item => item.priority > priority);
        if (insertIndex === -1) {
            this.queue.push(job);
        } else {
            this.queue.splice(insertIndex, 0, job);
        }

        this.stats.totalJobs++;

        console.log(`📥 TTS 큐 추가: ${id} (우선순위: ${priority}, 큐 길이: ${this.queue.length})`);

        // 큐 처리 시작
        this._processQueue();
    }

    /**
     * 큐 처리 메인 로직
     */
    async _processQueue() {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }

        if (this.activeJobs.size >= this.options.maxConcurrentJobs) {
            return;
        }

        this.isProcessing = true;

        while (this.queue.length > 0 && this.activeJobs.size < this.options.maxConcurrentJobs) {
            const job = this.queue.shift();
            this._processJob(job);
        }

        this.isProcessing = false;
    }

    /**
     * 개별 TTS 작업 처리
     */
    async _processJob(job) {
        job.status = 'processing';
        job.startTime = Date.now();
        this.activeJobs.set(job.id, job);

        console.log(`🎵 TTS 작업 시작: ${job.id} (시도: ${job.attempts + 1})`);

        try {
            // TTS 생성 with 타임아웃
            const audioUrl = await this._generateTTSWithTimeout(job.text, job.options);
            
            // 오디오 메타데이터 로드
            const audioMetadata = await this._loadAudioMetadata(audioUrl);
            
            job.status = 'completed';
            job.completedAt = Date.now();
            job.generationTime = job.completedAt - job.startTime;
            job.audioUrl = audioUrl;
            job.duration = audioMetadata.duration;

            // 통계 업데이트
            this.stats.completedJobs++;
            this.stats.totalGenerationTime += job.generationTime;
            this.stats.averageGenerationTime = this.stats.totalGenerationTime / this.stats.completedJobs;

            // 캐싱
            if (this.options.enableCaching) {
                const cacheKey = this._generateCacheKey(job.text, job.options);
                this.completedCache.set(cacheKey, {
                    url: audioUrl,
                    duration: audioMetadata.duration,
                    createdAt: Date.now()
                });
            }

            console.log(`✅ TTS 작업 완료: ${job.id} (${job.generationTime}ms, ${audioMetadata.duration.toFixed(2)}s)`);

            // 완료 콜백 호출
            if (this.onJobComplete) {
                this.onJobComplete({
                    id: job.id,
                    text: job.text,
                    audioUrl: job.audioUrl,
                    duration: job.duration,
                    generationTime: job.generationTime,
                    fromCache: false
                });
            }

        } catch (error) {
            console.error(`❌ TTS 작업 실패: ${job.id}`, error);
            
            job.attempts++;
            job.lastError = error.message;

            // 재시도 로직
            if (job.attempts < this.options.retryAttempts) {
                console.log(`🔄 TTS 재시도: ${job.id} (${job.attempts}/${this.options.retryAttempts})`);
                
                // 큐 앞쪽에 다시 삽입 (높은 우선순위)
                this.queue.unshift(job);
            } else {
                // 최대 재시도 횟수 초과
                job.status = 'failed';
                job.failedAt = Date.now();
                this.stats.failedJobs++;

                console.error(`💥 TTS 작업 최종 실패: ${job.id} - ${error.message}`);

                if (this.onJobFailed) {
                    this.onJobFailed({
                        id: job.id,
                        text: job.text,
                        error: error.message,
                        attempts: job.attempts
                    });
                }
            }
        } finally {
            this.activeJobs.delete(job.id);
            
            // 진행 상황 콜백 호출
            if (this.onProgress) {
                this.onProgress({
                    queueLength: this.queue.length,
                    activeJobs: this.activeJobs.size,
                    completed: this.stats.completedJobs,
                    failed: this.stats.failedJobs,
                    total: this.stats.totalJobs
                });
            }

            // 큐가 비었을 때 콜백 호출
            if (this.queue.length === 0 && this.activeJobs.size === 0 && this.onQueueEmpty) {
                this.onQueueEmpty();
            }

            // 다음 작업 처리
            this._processQueue();
        }
    }

    /**
     * 타임아웃이 있는 TTS 생성
     */
    async _generateTTSWithTimeout(text, options) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`TTS 생성 타임아웃 (${this.options.timeoutMs}ms)`));
            }, this.options.timeoutMs);

            this.ttsManager.generateAudio(text, options)
                .then(audioUrl => {
                    clearTimeout(timeout);
                    resolve(audioUrl);
                })
                .catch(error => {
                    clearTimeout(timeout);
                    reject(error);
                });
        });
    }

    /**
     * 오디오 메타데이터 로드
     */
    async _loadAudioMetadata(audioUrl) {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            
            audio.addEventListener('loadedmetadata', () => {
                resolve({
                    duration: audio.duration,
                    readyState: audio.readyState
                });
            });

            audio.addEventListener('error', () => {
                reject(new Error('오디오 메타데이터 로드 실패'));
            });

            audio.src = audioUrl;
        });
    }

    /**
     * 캐시 키 생성
     */
    _generateCacheKey(text, options) {
        const optionsStr = JSON.stringify(options, Object.keys(options).sort());
        return `${text}:${btoa(optionsStr)}`;
    }

    /**
     * 재생 큐에 추가
     */
    addToPlaybackQueue(id, audioUrl, options = {}) {
        this.playbackQueue.push({
            id,
            audioUrl,
            options,
            status: 'queued'
        });

        console.log(`🎬 재생 큐 추가: ${id} (큐 길이: ${this.playbackQueue.length})`);

        // 현재 재생 중이 아니면 재생 시작
        if (!this.currentPlayingId) {
            this._playNext();
        }
    }

    /**
     * 다음 오디오 재생
     */
    async _playNext() {
        if (this.playbackQueue.length === 0 || this.currentPlayingId) {
            return;
        }

        const playbackItem = this.playbackQueue.shift();
        this.currentPlayingId = playbackItem.id;

        try {
            console.log(`▶️ 오디오 재생 시작: ${playbackItem.id}`);

            if (this.onPlaybackStart) {
                this.onPlaybackStart(playbackItem);
            }

            // 오디오 재생 (기존 오디오 서비스 활용)
            await this._playAudio(playbackItem.audioUrl);

            console.log(`⏹️ 오디오 재생 완료: ${playbackItem.id}`);

            if (this.onPlaybackComplete) {
                this.onPlaybackComplete(playbackItem);
            }

        } catch (error) {
            console.error(`❌ 오디오 재생 실패: ${playbackItem.id}`, error);
        } finally {
            this.currentPlayingId = null;
            // 다음 오디오 재생
            this._playNext();
        }
    }

    /**
     * 오디오 재생 (Promise 기반)
     */
    async _playAudio(audioUrl) {
        return new Promise((resolve, reject) => {
            const audio = new Audio(audioUrl);
            
            audio.addEventListener('ended', resolve);
            audio.addEventListener('error', reject);
            
            audio.play().catch(reject);
        });
    }

    /**
     * 큐 초기화
     */
    clearQueue() {
        this.queue = [];
        this.playbackQueue = [];
        this.activeJobs.clear();
        this.currentPlayingId = null;
        
        console.log('🗑️ TTS 큐 초기화');
    }

    /**
     * 재생 중단
     */
    stopPlayback() {
        this.currentPlayingId = null;
        this.playbackQueue = [];
        
        console.log('⏹️ TTS 재생 중단');
    }

    /**
     * 캐시 정리
     */
    clearCache() {
        this.completedCache.clear();
        console.log('🗑️ TTS 캐시 정리');
    }

    /**
     * 현재 상태 반환
     */
    getStatus() {
        return {
            queueLength: this.queue.length,
            activeJobs: this.activeJobs.size,
            playbackQueueLength: this.playbackQueue.length,
            currentPlayingId: this.currentPlayingId,
            cacheSize: this.completedCache.size,
            stats: { ...this.stats }
        };
    }

    /**
     * 설정 업데이트
     */
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        console.log('⚙️ TTSQueueManager: 설정 업데이트', this.options);
    }
}

export default TTSQueueManager;