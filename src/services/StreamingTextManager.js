/**
 * 스트리밍 텍스트 생성 및 관리 시스템
 * AI 응답 텍스트의 실시간 chunk 분할 및 처리를 담당
 */
export class StreamingTextManager {
    constructor(options = {}) {
        this.options = {
            chunkSize: options.chunkSize || 30,           // 문자 단위 청크 크기
            sentenceDelimiters: options.sentenceDelimiters || /[.!?。！？]/g,  // 문장 구분자
            pauseBetweenSentences: options.pauseBetweenSentences || 500,  // 문장 간 일시정지 (ms)
            streamingDelay: options.streamingDelay || 50,   // 글자 단위 스트리밍 지연 (ms)
            enableSmartChunking: options.enableSmartChunking !== false,   // 스마트 청킹 활성화
            ...options
        };

        // 상태 관리
        this.currentText = '';
        this.currentChunks = [];
        this.currentChunkIndex = 0;
        this.isStreaming = false;
        this.streamingTimeouts = [];
        
        // 콜백 함수들
        this.onChunkReady = null;      // 청크 완성 시 호출
        this.onStreamingUpdate = null;  // 스트리밍 진행 중 호출
        this.onComplete = null;         // 전체 완료 시 호출
        this.onSentenceComplete = null; // 문장 완료 시 호출

        // 디버그 정보
        this.debugInfo = {
            totalChunks: 0,
            processedChunks: 0,
            averageChunkSize: 0,
            estimatedDuration: 0
        };
    }

    /**
     * 콜백 함수들 설정
     */
    setCallbacks({ 
        onChunkReady, 
        onStreamingUpdate, 
        onComplete, 
        onSentenceComplete 
    }) {
        this.onChunkReady = onChunkReady;
        this.onStreamingUpdate = onStreamingUpdate;
        this.onComplete = onComplete;
        this.onSentenceComplete = onSentenceComplete;
    }

    /**
     * 텍스트를 의미있는 청크로 분할
     * @param {string} text - 분할할 텍스트
     * @returns {Array} 청크 배열
     */
    divideIntoChunks(text) {
        if (!text || typeof text !== 'string') {
            return [];
        }

        // 스마트 청킹이 활성화된 경우
        if (this.options.enableSmartChunking) {
            return this._smartChunking(text);
        }

        // 기본 청킹: 문자 수 기반
        return this._basicChunking(text);
    }

    /**
     * 스마트 청킹: 문장, 절, 의미 단위로 분할
     */
    _smartChunking(text) {
        const chunks = [];
        
        // 1단계: 문장 단위로 분할
        const sentences = text.split(this.options.sentenceDelimiters).filter(s => s.trim());
        
        for (let sentence of sentences) {
            sentence = sentence.trim();
            if (!sentence) continue;

            // 문장이 너무 긴 경우 추가 분할
            if (sentence.length > this.options.chunkSize * 2) {
                // 절 단위로 분할 (쉼표, 세미콜론 기준)
                const clauses = sentence.split(/[,;，；]/).filter(c => c.trim());
                
                let currentChunk = '';
                for (const clause of clauses) {
                    const trimmedClause = clause.trim();
                    if (currentChunk.length + trimmedClause.length + 1 <= this.options.chunkSize) {
                        currentChunk += (currentChunk ? ', ' : '') + trimmedClause;
                    } else {
                        if (currentChunk) {
                            chunks.push({
                                text: currentChunk,
                                type: 'clause',
                                estimatedDuration: this._estimateChunkDuration(currentChunk)
                            });
                        }
                        currentChunk = trimmedClause;
                    }
                }
                
                if (currentChunk) {
                    chunks.push({
                        text: currentChunk,
                        type: 'clause',
                        estimatedDuration: this._estimateChunkDuration(currentChunk)
                    });
                }
            } else {
                // 문장이 적당한 길이인 경우 그대로 사용
                chunks.push({
                    text: sentence,
                    type: 'sentence',
                    estimatedDuration: this._estimateChunkDuration(sentence)
                });
            }
        }

        return chunks;
    }

    /**
     * 기본 청킹: 문자 수 기반 분할
     */
    _basicChunking(text) {
        const chunks = [];
        const chunkSize = this.options.chunkSize;
        
        for (let i = 0; i < text.length; i += chunkSize) {
            const chunk = text.slice(i, i + chunkSize);
            chunks.push({
                text: chunk,
                type: 'basic',
                estimatedDuration: this._estimateChunkDuration(chunk)
            });
        }

        return chunks;
    }

    /**
     * 청크의 예상 재생 시간 계산 (한국어 기준)
     */
    _estimateChunkDuration(text) {
        // 한국어 평균 읽기 속도: 분당 350-400자
        // 1자당 약 150-170ms로 계산
        const koreanCharsPerMinute = 375;
        const msPerChar = (60 * 1000) / koreanCharsPerMinute;
        
        // 영어와 숫자는 더 빠르게 계산
        const koreanChars = (text.match(/[가-힣]/g) || []).length;
        const otherChars = text.length - koreanChars;
        
        return (koreanChars * msPerChar) + (otherChars * msPerChar * 0.7);
    }

    /**
     * 스트리밍 텍스트 처리 시작
     * @param {string} text - 처리할 텍스트
     * @param {Object} options - 처리 옵션
     */
    async startStreaming(text, options = {}) {
        // 기존 스트리밍 정리
        this.stopStreaming();

        this.currentText = text;
        this.currentChunks = this.divideIntoChunks(text);
        this.currentChunkIndex = 0;
        this.isStreaming = true;

        // 디버그 정보 업데이트
        this.debugInfo = {
            totalChunks: this.currentChunks.length,
            processedChunks: 0,
            averageChunkSize: this.currentChunks.reduce((sum, chunk) => sum + chunk.text.length, 0) / this.currentChunks.length,
            estimatedDuration: this.currentChunks.reduce((sum, chunk) => sum + chunk.estimatedDuration, 0)
        };

        console.log('🎬 StreamingTextManager: 스트리밍 시작', {
            totalText: text.length,
            chunks: this.currentChunks.length,
            debugInfo: this.debugInfo
        });

        // 청크 순차 처리 시작
        await this._processNextChunk();
    }

    /**
     * 다음 청크 처리
     */
    async _processNextChunk() {
        if (!this.isStreaming || this.currentChunkIndex >= this.currentChunks.length) {
            this._completeStreaming();
            return;
        }

        const chunk = this.currentChunks[this.currentChunkIndex];
        
        console.log(`📝 청크 ${this.currentChunkIndex + 1}/${this.currentChunks.length} 처리:`, chunk.text);

        // 청크 완성 콜백 호출
        if (this.onChunkReady) {
            await this.onChunkReady(chunk, this.currentChunkIndex, this.currentChunks.length);
        }

        // 스트리밍 업데이트 콜백 호출
        if (this.onStreamingUpdate) {
            this.onStreamingUpdate({
                currentChunk: this.currentChunkIndex,
                totalChunks: this.currentChunks.length,
                progress: ((this.currentChunkIndex + 1) / this.currentChunks.length) * 100,
                text: chunk.text,
                type: chunk.type
            });
        }

        // 문장 완료 시 특별 처리
        if (chunk.type === 'sentence' && this.onSentenceComplete) {
            this.onSentenceComplete(chunk, this.currentChunkIndex);
        }

        this.debugInfo.processedChunks = this.currentChunkIndex + 1;
        this.currentChunkIndex++;

        // 다음 청크 처리 스케줄링
        const delay = chunk.type === 'sentence' ? 
            this.options.pauseBetweenSentences : 
            this.options.streamingDelay;

        const timeoutId = setTimeout(() => {
            this._processNextChunk();
        }, delay);

        this.streamingTimeouts.push(timeoutId);
    }

    /**
     * 스트리밍 완료 처리
     */
    _completeStreaming() {
        this.isStreaming = false;
        this.streamingTimeouts = [];

        console.log('✅ StreamingTextManager: 스트리밍 완료', {
            processedChunks: this.debugInfo.processedChunks,
            totalChunks: this.debugInfo.totalChunks
        });

        if (this.onComplete) {
            this.onComplete({
                totalText: this.currentText,
                chunks: this.currentChunks,
                debugInfo: this.debugInfo
            });
        }
    }

    /**
     * 스트리밍 중단
     */
    stopStreaming() {
        this.isStreaming = false;
        
        // 모든 타이머 정리
        this.streamingTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.streamingTimeouts = [];

        console.log('⏹️ StreamingTextManager: 스트리밍 중단');
    }

    /**
     * 현재 상태 정보 반환
     */
    getStatus() {
        return {
            isStreaming: this.isStreaming,
            currentChunkIndex: this.currentChunkIndex,
            totalChunks: this.currentChunks.length,
            debugInfo: this.debugInfo,
            currentText: this.currentText
        };
    }

    /**
     * 설정 업데이트
     */
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        console.log('⚙️ StreamingTextManager: 설정 업데이트', this.options);
    }
}

export default StreamingTextManager;