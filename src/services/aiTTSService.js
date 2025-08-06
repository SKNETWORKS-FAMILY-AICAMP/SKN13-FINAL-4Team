/**
 * AI TTS Service (OpenAI)
 * AI 챗봇 전용 OpenAI Text-to-Speech API를 사용한 음성 생성 서비스
 */
export class AITTSService {
  constructor(openai, settings) {
    this.openai = openai;     // OpenAI 클라이언트 인스턴스
    this.settings = settings; // TTS 설정 (voice, speed 등)
    this.requestCount = 0;    // 요청 횟수 카운터
    this.lastRequestTime = 0; // 마지막 요청 시간
  }

  /**
   * 텍스트를 음성으로 변환하고 재생 가능한 URL 반환
   * @param {string} text - 변환할 텍스트
   * @returns {Promise<string>} 생성된 오디오의 Blob URL
   */
  async generateAudio(text) {
    if (!text || !text.trim()) {
      throw new Error('텍스트가 비어있습니다');
    }

    // API 키 확인
    if (!this.openai || !process.env.REACT_APP_OPENAI_API_KEY) {
      throw new Error('OpenAI API 키가 설정되지 않았습니다');
    }

    // 텍스트 길이 제한 확인 (OpenAI TTS API 제한: 4096자)
    if (text.length > 4096) {
      console.warn(`⚠️ 텍스트가 OpenAI 제한(4096자)을 초과합니다: ${text.length}자`);
      text = text.substring(0, 4096);
    }

    // 요청 통계 업데이트
    this.requestCount++;
    this.lastRequestTime = Date.now();

    try {
      console.log(`🎵 OpenAI TTS 요청 시작 (${this.requestCount}번째)`);
      const startTime = Date.now();

      // OpenAI TTS API 호출
      const response = await this.openai.audio.speech.create({
        model: this.getOptimalModel(),              // 모델 선택 (품질 vs 속도)
        voice: this.settings.ttsVoice || 'nova',    // 음성 종류
        input: text,                                // 변환할 텍스트
        speed: this.validateSpeed(this.settings.ttsSpeed), // 재생 속도
        response_format: 'mp3'                      // 출력 형식
      });

      // 응답을 Blob으로 변환
      const audioArrayBuffer = await response.arrayBuffer();
      const audioBlob = new Blob([audioArrayBuffer], { 
        type: 'audio/mpeg' 
      });
      
      // Blob URL 생성
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const duration = Date.now() - startTime;
      console.log(`✅ OpenAI TTS 완료: ${duration}ms, ${audioBlob.size} bytes`);
      
      return audioUrl;

    } catch (error) {
      console.error('❌ OpenAI TTS 생성 실패:', error);
      
      // 에러 타입별 처리
      if (error.status === 401) {
        throw new Error('OpenAI API 키가 유효하지 않습니다');
      } else if (error.status === 429) {
        throw new Error('OpenAI API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요');
      } else if (error.status === 400) {
        throw new Error('텍스트 형식이 올바르지 않습니다');
      } else {
        throw new Error(`OpenAI TTS 서비스 오류: ${error.message}`);
      }
    }
  }

  /**
   * 최적의 TTS 모델 선택
   * @returns {string} 선택된 모델명
   */
  getOptimalModel() {
    // 텍스트 길이나 품질 요구사항에 따라 모델 선택
    // tts-1: 빠른 속도, tts-1-hd: 고품질
    return this.settings.highQuality ? 'tts-1-hd' : 'tts-1';
  }

  /**
   * 속도 값 검증 및 보정
   * @param {number} speed - 요청된 속도
   * @returns {number} 검증된 속도 값
   */
  validateSpeed(speed) {
    if (!speed || typeof speed !== 'number') {
      return 1.0;
    }
    
    // OpenAI TTS API 속도 범위: 0.25 ~ 4.0
    return Math.max(0.25, Math.min(4.0, speed));
  }

  /**
   * 설정 업데이트
   * @param {Object} newSettings - 새로운 설정
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    console.log('🔧 OpenAI TTS 설정 업데이트:', {
      voice: this.settings.ttsVoice,
      speed: this.settings.ttsSpeed,
      highQuality: this.settings.highQuality
    });
  }

  /**
   * 서비스 통계 정보 반환
   * @returns {Object} 통계 정보
   */
  getStats() {
    return {
      serviceName: 'OpenAI TTS',
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime,
      currentSettings: this.settings,
      apiKeyConfigured: !!process.env.REACT_APP_OPENAI_API_KEY
    };
  }

  /**
   * 사용 가능한 음성 목록 반환
   * @returns {Array} 음성 옵션 배열
   */
  getAvailableVoices() {
    return [
      { value: 'nova', label: 'Nova (여성)', language: 'multiple' },
      { value: 'alloy', label: 'Alloy (중성)', language: 'multiple' },
      { value: 'echo', label: 'Echo (남성)', language: 'multiple' },
      { value: 'fable', label: 'Fable (남성)', language: 'multiple' },
      { value: 'onyx', label: 'Onyx (남성)', language: 'multiple' },
      { value: 'shimmer', label: 'Shimmer (여성)', language: 'multiple' }
    ];
  }

  /**
   * 리소스 정리
   */
  cleanup() {
    // OpenAI TTS는 특별한 정리 작업이 필요하지 않음
    console.log('🧹 OpenAI TTS 서비스 정리 완료');
  }
}