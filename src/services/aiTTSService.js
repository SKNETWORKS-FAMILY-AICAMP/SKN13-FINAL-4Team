/**
 * AI TTS Service (Backend API)
 * Backend API를 통한 안전한 음성 생성 서비스 (API 키 노출 방지)
 */
export class AITTSService {
  constructor(openai, settings) {
    // openai 매개변수는 하위 호환성을 위해 유지하지만 사용하지 않음
    this.baseUrl = window.location.protocol + '//' + window.location.hostname + ':8000';
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

    // 텍스트 길이 제한 확인 (OpenAI TTS API 제한: 4096자)
    if (text.length > 4096) {
      console.warn(`⚠️ 텍스트가 OpenAI 제한(4096자)을 초과합니다: ${text.length}자`);
      text = text.substring(0, 4096);
    }

    // 요청 통계 업데이트
    this.requestCount++;
    this.lastRequestTime = Date.now();

    try {
      console.log(`🎵 Backend TTS API 요청 시작 (${this.requestCount}번째)`);
      const startTime = Date.now();

      // Backend TTS API 호출
      const response = await fetch(`${this.baseUrl}/api/ai/tts/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          voice: this.settings.ttsVoice || 'nova',
          speed: this.validateSpeed(this.settings.ttsSpeed),
          format: 'mp3'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Backend TTS API 요청 실패`);
      }

      // 응답을 Blob으로 변환
      const audioArrayBuffer = await response.arrayBuffer();
      const audioBlob = new Blob([audioArrayBuffer], { 
        type: 'audio/mpeg' 
      });
      
      // Blob URL 생성
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const duration = Date.now() - startTime;
      console.log(`✅ Backend TTS 완료: ${duration}ms, ${audioBlob.size} bytes`);
      
      return audioUrl;

    } catch (error) {
      console.error('❌ Backend TTS 생성 실패:', error);
      
      // 네트워크 오류 또는 Backend API 오류 처리
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Backend 서버에 연결할 수 없습니다. 서버 상태를 확인해주세요');
      } else {
        throw new Error(`Backend TTS 서비스 오류: ${error.message}`);
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
      serviceName: 'Backend TTS API',
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime,
      currentSettings: this.settings,
      backendUrl: this.baseUrl,
      secureApiAccess: true // Backend를 통한 안전한 API 접근
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
    // Backend API를 통한 TTS는 특별한 정리 작업이 필요하지 않음
    console.log('🧹 Backend TTS API 서비스 정리 완료');
  }
}