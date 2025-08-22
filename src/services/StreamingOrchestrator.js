/**
 * 스트리밍 오케스트레이터
 * 텍스트 생성, TTS 큐, 비디오 동기화를 통합 관리하는 중앙 제어 시스템
 */
import { StreamingTextManager } from './StreamingTextManager.js';
import { TTSQueueManager } from './TTSQueueManager.js';
import { VideoSyncManager } from './VideoSyncManager.js';

export class StreamingOrchestrator {
    constructor(ttsManager, videoTransitionManager, options = {}) {
        this.options = {
            // 파이프라인 설정
            enableTextStreaming: options.enableTextStreaming !== false,
            enableTTSQueue: options.enableTTSQueue !== false,
            enableVideoSync: options.enableVideoSync !== false,
            
            // 동기화 모드
            syncMode: options.syncMode || 'realtime',  // realtime, buffered, manual
            
            // 오류 처리
            enableErrorRecovery: options.enableErrorRecovery !== false,
            maxRetryAttempts: options.maxRetryAttempts || 3,
            fallbackToText: options.fallbackToText !== false,
            
            // 성능 설정
            enablePreloading: options.enablePreloading !== false,
            maxConcurrentChunks: options.maxConcurrentChunks || 3,
            enableProfiling: options.enableProfiling || false,
            
            ...options
        };

        // 핵심 매니저 초기화
        this.textManager = new StreamingTextManager(options.textManager || {});
        this.ttsQueueManager = new TTSQueueManager(ttsManager, options.ttsQueue || {});
        this.videoSyncManager = new VideoSyncManager(videoTransitionManager, options.videoSync || {});

        // 상태 관리
        this.currentSession = null;
        this.activePipeline = new Map(); // chunkId -> pipelineStatus
        this.sessionStats = {
            totalSessions: 0,
            successfulSessions: 0,
            failedSessions: 0,
            averageProcessingTime: 0,
            totalChunksProcessed: 0
        };

        // 성능 프로파일링
        this.performanceProfiler = {
            textProcessing: [],
            ttsGeneration: [],
            videoSync: [],
            endToEndLatency: []
        };

        // 콜백 함수들
        this.onSessionStart = null;
        this.onSessionComplete = null;
        this.onChunkProgress = null;
        this.onError = null;
        this.onDebugInfo = null;

        // 매니저 간 콜백 설정
        this._setupManagerCallbacks();
    }

    /**
     * 매니저 간 콜백 설정
     */
    _setupManagerCallbacks() {
        // 텍스트 매니저 콜백
        this.textManager.setCallbacks({
            onChunkReady: async (chunk, chunkIndex, totalChunks) => {
                await this._handleTextChunkReady(chunk, chunkIndex, totalChunks);
            },
            onStreamingUpdate: (updateInfo) => {
                this._handleTextStreamingUpdate(updateInfo);
            },
            onComplete: (completionInfo) => {
                this._handleTextStreamingComplete(completionInfo);
            }
        });

        // TTS 큐 매니저 콜백
        this.ttsQueueManager.setCallbacks({
            onJobComplete: async (jobResult) => {
                await this._handleTTSJobComplete(jobResult);
            },
            onJobFailed: (jobFailure) => {
                this._handleTTSJobFailed(jobFailure);
            },
            onProgress: (progressInfo) => {
                this._handleTTSProgress(progressInfo);
            }
        });

        // 비디오 동기화 매니저 콜백
        this.videoSyncManager.setCallbacks({
            onVideoChange: (videoInfo) => {
                this._handleVideoChange(videoInfo);
            },
            onSyncComplete: (syncResult) => {
                this._handleVideoSyncComplete(syncResult);
            },
            onEmotionDetected: (emotionInfo) => {
                this._handleEmotionDetected(emotionInfo);
            }
        });
    }

    /**
     * 스트리밍 세션 시작
     * @param {string} text - 전체 텍스트
     * @param {string} sessionId - 세션 고유 식별자
     * @param {Object} options - 세션 옵션
     */
    async startStreamingSession(text, sessionId, options = {}) {
        try {
            console.log(`🎬 StreamingOrchestrator: 세션 시작`, {
                sessionId,
                textLength: text.length,
                syncMode: this.options.syncMode
            });

            // 새 세션 생성
            this.currentSession = {
                id: sessionId,
                text,
                options,
                startTime: Date.now(),
                status: 'starting',
                totalChunks: 0,
                processedChunks: 0,
                pipeline: new Map()
            };

            this.sessionStats.totalSessions++;

            // 세션 시작 콜백
            if (this.onSessionStart) {
                this.onSessionStart(this.currentSession);
            }

            // 기존 파이프라인 정리
            this._clearActivePipeline();

            // 동기화 모드에 따른 처리
            switch (this.options.syncMode) {
                case 'realtime':
                    await this._startRealtimeProcessing(text, sessionId);
                    break;
                case 'buffered':
                    await this._startBufferedProcessing(text, sessionId);
                    break;
                case 'manual':
                    await this._startManualProcessing(text, sessionId);
                    break;
                default:
                    throw new Error(`지원하지 않는 동기화 모드: ${this.options.syncMode}`);
            }

        } catch (error) {
            console.error('❌ 스트리밍 세션 시작 실패:', error);
            this._handleSessionError(error);
        }
    }

    /**
     * 실시간 처리 시작
     */
    async _startRealtimeProcessing(text, sessionId) {
        console.log('⚡ 실시간 처리 모드 시작');
        
        this.currentSession.status = 'processing';
        
        // 텍스트 스트리밍 시작 (청크별로 즉시 처리)
        if (this.options.enableTextStreaming) {
            await this.textManager.startStreaming(text, {
                mode: 'realtime'
            });
        }
    }

    /**
     * 버퍼링 처리 시작
     */
    async _startBufferedProcessing(text, sessionId) {
        console.log('📦 버퍼링 처리 모드 시작');
        
        this.currentSession.status = 'buffering';
        
        // 전체 텍스트를 미리 청크로 분할
        const chunks = this.textManager.divideIntoChunks(text);
        this.currentSession.totalChunks = chunks.length;
        
        // 일정 개수의 청크를 미리 TTS 생성
        const preloadCount = Math.min(chunks.length, this.options.maxConcurrentChunks);
        
        for (let i = 0; i < preloadCount; i++) {
            const chunk = chunks[i];
            this._queueTTSGeneration(chunk, i, sessionId);
        }
        
        // 버퍼링 완료 후 순차 재생 시작
        setTimeout(() => {
            this._startBufferedPlayback(chunks, sessionId);
        }, 1000); // 1초 버퍼링 시간
    }

    /**
     * 수동 처리 시작
     */
    async _startManualProcessing(text, sessionId) {
        console.log('🎛️ 수동 처리 모드 시작');
        
        this.currentSession.status = 'ready';
        
        // 텍스트만 청크로 분할하고 대기
        const chunks = this.textManager.divideIntoChunks(text);
        this.currentSession.chunks = chunks;
        this.currentSession.totalChunks = chunks.length;
        
        console.log(`📋 수동 모드: ${chunks.length}개 청크 준비 완료`);
    }

    /**
     * 텍스트 청크 준비 완료 처리
     */
    async _handleTextChunkReady(chunk, chunkIndex, totalChunks) {
        const chunkId = `${this.currentSession?.id || 'unknown'}_chunk_${chunkIndex}`;
        
        console.log(`📝 텍스트 청크 준비: ${chunkId}`);

        // 파이프라인 상태 추가
        const pipelineStatus = {
            id: chunkId,
            chunkIndex,
            totalChunks,
            chunk,
            stages: {
                textReady: { status: 'completed', timestamp: Date.now() },
                ttsQueued: { status: 'pending' },
                ttsCompleted: { status: 'pending' },
                videoSynced: { status: 'pending' }
            },
            startTime: Date.now()
        };

        this.activePipeline.set(chunkId, pipelineStatus);

        // TTS 생성 큐에 추가
        if (this.options.enableTTSQueue) {
            await this._queueTTSGeneration(chunk, chunkIndex, chunkId);
        }

        // 진행 상황 업데이트
        this._updateChunkProgress(chunkId, 'textReady');
    }

    /**
     * TTS 생성 큐에 추가
     */
    async _queueTTSGeneration(chunk, chunkIndex, chunkId) {
        const pipelineStatus = this.activePipeline.get(chunkId);
        if (pipelineStatus) {
            pipelineStatus.stages.ttsQueued = { status: 'processing', timestamp: Date.now() };
        }

        console.log(`🎵 TTS 큐 추가: ${chunkId}`);

        this.ttsQueueManager.addToQueue(
            chunk.text,
            chunkId,
            this.currentSession?.options?.ttsOptions || {},
            chunkIndex // 우선순위로 청크 순서 사용
        );
    }

    /**
     * TTS 작업 완료 처리
     */
    async _handleTTSJobComplete(jobResult) {
        const chunkId = jobResult.id;
        const pipelineStatus = this.activePipeline.get(chunkId);

        if (!pipelineStatus) {
            console.warn(`⚠️ 파이프라인 상태 없음: ${chunkId}`);
            return;
        }

        console.log(`🎵 TTS 완료: ${chunkId} (${jobResult.duration.toFixed(2)}s)`);

        // 파이프라인 상태 업데이트
        pipelineStatus.stages.ttsCompleted = { 
            status: 'completed', 
            timestamp: Date.now(),
            audioUrl: jobResult.audioUrl,
            duration: jobResult.duration
        };

        // 비디오 동기화 시작
        if (this.options.enableVideoSync) {
            await this._startVideoSync(chunkId, pipelineStatus, jobResult);
        }

        // 성능 프로파일링
        if (this.options.enableProfiling) {
            this.performanceProfiler.ttsGeneration.push({
                chunkId,
                duration: jobResult.generationTime,
                audioLength: jobResult.duration,
                timestamp: Date.now()
            });
        }

        this._updateChunkProgress(chunkId, 'ttsCompleted');
    }

    /**
     * 비디오 동기화 시작
     */
    async _startVideoSync(chunkId, pipelineStatus, ttsResult) {
        const chunk = pipelineStatus.chunk;
        
        console.log(`🎬 비디오 동기화 시작: ${chunkId}`);

        pipelineStatus.stages.videoSynced = { status: 'processing', timestamp: Date.now() };

        try {
            await this.videoSyncManager.syncVideoWithTTS(
                chunk.text,
                ttsResult.duration,
                chunkId,
                this.currentSession?.options?.videoOptions || {}
            );

        } catch (error) {
            console.error(`❌ 비디오 동기화 실패: ${chunkId}`, error);
            pipelineStatus.stages.videoSynced = { 
                status: 'failed', 
                timestamp: Date.now(),
                error: error.message 
            };
        }
    }

    /**
     * 비디오 동기화 완료 처리
     */
    _handleVideoSyncComplete(syncResult) {
        const chunkId = syncResult.id;
        const pipelineStatus = this.activePipeline.get(chunkId);

        if (pipelineStatus) {
            pipelineStatus.stages.videoSynced = { 
                status: 'completed', 
                timestamp: Date.now(),
                video: syncResult.actualVideo
            };

            // 전체 파이프라인 완료 확인
            this._checkPipelineCompletion(chunkId);
        }

        this._updateChunkProgress(chunkId, 'videoSynced');
    }

    /**
     * 파이프라인 완료 확인
     */
    _checkPipelineCompletion(chunkId) {
        const pipelineStatus = this.activePipeline.get(chunkId);
        if (!pipelineStatus) return;

        const allStagesCompleted = Object.values(pipelineStatus.stages)
            .every(stage => stage.status === 'completed');

        if (allStagesCompleted) {
            pipelineStatus.endTime = Date.now();
            pipelineStatus.totalDuration = pipelineStatus.endTime - pipelineStatus.startTime;

            console.log(`✅ 파이프라인 완료: ${chunkId} (${pipelineStatus.totalDuration}ms)`);

            this.sessionStats.totalChunksProcessed++;

            // 성능 프로파일링
            if (this.options.enableProfiling) {
                this.performanceProfiler.endToEndLatency.push({
                    chunkId,
                    duration: pipelineStatus.totalDuration,
                    timestamp: Date.now()
                });
            }

            // 세션 완료 확인
            this._checkSessionCompletion();
        }
    }

    /**
     * 세션 완료 확인
     */
    _checkSessionCompletion() {
        if (!this.currentSession) return;

        const completedChunks = Array.from(this.activePipeline.values())
            .filter(pipeline => 
                Object.values(pipeline.stages).every(stage => 
                    stage.status === 'completed' || stage.status === 'failed'
                )
            ).length;

        if (completedChunks >= this.currentSession.totalChunks) {
            this._completeSession();
        }
    }

    /**
     * 세션 완료 처리
     */
    _completeSession() {
        if (!this.currentSession) return;

        this.currentSession.endTime = Date.now();
        this.currentSession.totalDuration = this.currentSession.endTime - this.currentSession.startTime;
        this.currentSession.status = 'completed';

        this.sessionStats.successfulSessions++;
        this.sessionStats.averageProcessingTime = 
            (this.sessionStats.averageProcessingTime * (this.sessionStats.successfulSessions - 1) + 
             this.currentSession.totalDuration) / this.sessionStats.successfulSessions;

        console.log(`🎉 세션 완료: ${this.currentSession.id} (${this.currentSession.totalDuration}ms)`);

        if (this.onSessionComplete) {
            this.onSessionComplete(this.currentSession);
        }

        // 정리
        this._clearActivePipeline();
        this.currentSession = null;
    }

    /**
     * 진행 상황 업데이트
     */
    _updateChunkProgress(chunkId, stage) {
        const pipelineStatus = this.activePipeline.get(chunkId);
        if (!pipelineStatus) return;

        if (this.onChunkProgress) {
            this.onChunkProgress({
                chunkId,
                stage,
                progress: this._calculateChunkProgress(pipelineStatus),
                pipelineStatus
            });
        }

        // 디버그 정보 콜백
        if (this.onDebugInfo) {
            this.onDebugInfo({
                activePipelineSize: this.activePipeline.size,
                ttsQueueStatus: this.ttsQueueManager.getStatus(),
                videoSyncStatus: this.videoSyncManager.getStatus(),
                sessionStats: this.sessionStats
            });
        }
    }

    /**
     * 청크 진행률 계산
     */
    _calculateChunkProgress(pipelineStatus) {
        const stages = Object.values(pipelineStatus.stages);
        const completedStages = stages.filter(stage => stage.status === 'completed').length;
        return (completedStages / stages.length) * 100;
    }

    /**
     * 오류 처리
     */
    _handleSessionError(error) {
        if (this.currentSession) {
            this.currentSession.status = 'failed';
            this.currentSession.error = error.message;
            this.sessionStats.failedSessions++;
        }

        if (this.onError) {
            this.onError({
                type: 'session_error',
                message: error.message,
                sessionId: this.currentSession?.id,
                timestamp: Date.now()
            });
        }

        // 오류 복구 시도
        if (this.options.enableErrorRecovery) {
            this._attemptErrorRecovery(error);
        }
    }

    /**
     * 오류 복구 시도
     */
    _attemptErrorRecovery(error) {
        console.log('🔧 오류 복구 시도 중...');
        
        // 텍스트 전용 폴백
        if (this.options.fallbackToText && this.onSessionComplete) {
            // TTS/비디오 없이 텍스트만 표시
            this.onSessionComplete({
                ...this.currentSession,
                fallbackMode: 'text-only'
            });
        }
    }

    /**
     * 활성 파이프라인 정리
     */
    _clearActivePipeline() {
        this.activePipeline.clear();
        
        // 각 매니저 정리
        this.textManager.stopStreaming();
        this.ttsQueueManager.clearQueue();
        this.videoSyncManager.stopAllSync();
    }

    /**
     * 스트리밍 중단
     */
    stopStreaming() {
        console.log('⏹️ 스트리밍 중단');
        
        if (this.currentSession) {
            this.currentSession.status = 'stopped';
        }

        this._clearActivePipeline();
        this.currentSession = null;
    }

    /**
     * 콜백 함수 설정
     */
    setCallbacks({ onSessionStart, onSessionComplete, onChunkProgress, onError, onDebugInfo }) {
        this.onSessionStart = onSessionStart;
        this.onSessionComplete = onSessionComplete;
        this.onChunkProgress = onChunkProgress;
        this.onError = onError;
        this.onDebugInfo = onDebugInfo;
    }

    /**
     * 현재 상태 반환
     */
    getStatus() {
        return {
            currentSession: this.currentSession,
            activePipelineSize: this.activePipeline.size,
            sessionStats: this.sessionStats,
            textManagerStatus: this.textManager.getStatus(),
            ttsQueueStatus: this.ttsQueueManager.getStatus(),
            videoSyncStatus: this.videoSyncManager.getStatus(),
            performanceProfiler: this.options.enableProfiling ? this.performanceProfiler : null
        };
    }

    /**
     * 설정 업데이트
     */
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        
        // 하위 매니저 설정도 업데이트
        if (newOptions.textManager) {
            this.textManager.updateOptions(newOptions.textManager);
        }
        if (newOptions.ttsQueue) {
            this.ttsQueueManager.updateOptions(newOptions.ttsQueue);
        }
        if (newOptions.videoSync) {
            this.videoSyncManager.updateOptions(newOptions.videoSync);
        }

        console.log('⚙️ StreamingOrchestrator: 설정 업데이트', this.options);
    }

    // 이벤트 핸들러들 (기존 구현들)
    _handleTextStreamingUpdate(updateInfo) {
        // 텍스트 스트리밍 업데이트 처리
    }

    _handleTextStreamingComplete(completionInfo) {
        // 텍스트 스트리밍 완료 처리
    }

    _handleTTSJobFailed(jobFailure) {
        console.error(`❌ TTS 작업 실패: ${jobFailure.id}`, jobFailure.error);
        
        const pipelineStatus = this.activePipeline.get(jobFailure.id);
        if (pipelineStatus) {
            pipelineStatus.stages.ttsCompleted = { 
                status: 'failed', 
                timestamp: Date.now(),
                error: jobFailure.error 
            };
        }
    }

    _handleTTSProgress(progressInfo) {
        // TTS 큐 진행 상황 처리
    }

    _handleVideoChange(videoInfo) {
        // 비디오 변경 처리
    }

    _handleEmotionDetected(emotionInfo) {
        console.log(`😊 감정 감지: ${emotionInfo.emotion} (${emotionInfo.confidence}%)`);
    }
}

export default StreamingOrchestrator;