/**
 * AI MeloTTS Service (Backend API)
 * Backend MeloTTS API를 통한 고품질 다국어 음성 생성 서비스
 */
export class AIMeloTTSService {
  constructor(settings) {
    this.baseUrl = window.location.protocol + '//' + window.location.hostname + ':8000';
    this.settings = settings || {};
    this.requestCount = 0;
    this.lastRequestTime = 0;
    this.currentLanguage = 'KR'; // 기본 언어 한국어
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

    // MeloTTS는 텍스트 길이 제한이 더 관대함
    if (text.length > 10000) {
      console.warn(`⚠️ 텍스트가 너무 깁니다: ${text.length}자`);
      text = text.substring(0, 10000);
    }

    // 요청 통계 업데이트
    this.requestCount++;
    this.lastRequestTime = Date.now();

    try {
      console.log(`🎵 MeloTTS API 요청 시작 (${this.requestCount}번째)`);
      const startTime = Date.now();

      // 언어 자동 감지
      const detectedLang = this.detectLanguage(text);
      
      // Backend MeloTTS API 호출
      const response = await fetch(`${this.baseUrl}/api/ai/tts/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          engine: 'melotts',  // MeloTTS 엔진 명시
          voice: this.settings.meloVoice || 'default',
          speed: this.validateSpeed(this.settings.ttsSpeed),
          format: 'mp3',
          language: detectedLang || this.currentLanguage
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: MeloTTS API 요청 실패`);
      }

      // 응답을 Blob으로 변환
      const audioArrayBuffer = await response.arrayBuffer();
      const audioBlob = new Blob([audioArrayBuffer], { 
        type: 'audio/mpeg' 
      });
      
      // Blob URL 생성
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const duration = Date.now() - startTime;
      console.log(`✅ MeloTTS 완료: ${duration}ms, ${audioBlob.size} bytes, 언어: ${detectedLang}`);
      
      return audioUrl;

    } catch (error) {
      console.error('❌ MeloTTS 생성 실패:', error);
      
      // 네트워크 오류 또는 Backend API 오류 처리
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Backend 서버에 연결할 수 없습니다. 서버 상태를 확인해주세요');
      } else {
        throw new Error(`MeloTTS 서비스 오류: ${error.message}`);
      }
    }
  }

  /**
   * 텍스트에서 언어 자동 감지
   * @param {string} text - 분석할 텍스트
   * @returns {string} 감지된 언어 코드
   */
  detectLanguage(text) {
    // 한글 체크
    if (/[\u3131-\uD79D]/.test(text)) {
      return 'KR';
    }
    // 일본어 체크 (히라가나, 가타카나)
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) {
      return 'JP';
    }
    // 중국어 체크
    if (/[\u4E00-\u9FFF]/.test(text)) {
      return 'ZH';
    }
    // 스페인어 특수문자 체크
    if (/[áéíóúñ¿¡]/i.test(text)) {
      return 'ES';
    }
    // 프랑스어 특수문자 체크
    if (/[àâäéèêëïîôùûç]/i.test(text)) {
      return 'FR';
    }
    // 기본값 영어
    return 'EN';
  }

  /**
   * 속도 값 검증 및 보정 (MeloTTS 범위: 0.5 ~ 2.0)
   * @param {number} speed - 요청된 속도
   * @returns {number} 검증된 속도 값
   */
  validateSpeed(speed) {
    if (!speed || typeof speed !== 'number') {
      return 1.0;
    }
    
    // MeloTTS 속도 범위: 0.5 ~ 2.0
    return Math.max(0.5, Math.min(2.0, speed));
  }

  /**
   * 설정 업데이트
   * @param {Object} newSettings - 새로운 설정
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    
    // 언어 설정 업데이트
    if (newSettings.language) {
      this.currentLanguage = newSettings.language.toUpperCase();
    }
    
    console.log('🔧 MeloTTS 설정 업데이트:', {
      voice: this.settings.meloVoice,
      speed: this.settings.ttsSpeed,
      language: this.currentLanguage
    });
  }

  /**
   * 서비스 통계 정보 반환
   * @returns {Object} 통계 정보
   */
  getStats() {
    return {
      serviceName: 'MeloTTS (Backend API)',
      engineType: 'melotts',
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime,
      currentSettings: this.settings,
      currentLanguage: this.currentLanguage,
      backendUrl: this.baseUrl,
      features: {
        multiLanguage: true,
        cpuRealTime: true,
        streaming: false,  // 현재 구현에서는 스트리밍 미지원
        customVoice: false
      }
    };
  }

  /**
   * 사용 가능한 음성 목록 반환
   * @param {string} language - 언어 코드
   * @returns {Array} 음성 옵션 배열
   */
  getAvailableVoices(language = 'KR') {
    const lang = language.toUpperCase();
    
    if (lang === 'EN') {
      return [
        { value: 'default', label: 'American (Female)' },
        { value: 'male', label: 'Brazilian (Male)' },
        { value: 'british', label: 'British' },
        { value: 'indian', label: 'Indian' },
        { value: 'australian', label: 'Australian' }
      ];
    } else if (lang === 'KR') {
      return [
        { value: 'default', label: '한국어 (여성)' },
        { value: 'male', label: '한국어 (남성)' }
      ];
    } else {
      return [
        { value: 'default', label: 'Default' },
        { value: 'female', label: 'Female' },
        { value: 'male', label: 'Male' }
      ];
    }
  }

  /**
   * 지원 언어 목록 반환
   * @returns {Array} 지원 언어 목록
   */
  getSupportedLanguages() {
    return [
      { code: 'KR', label: '한국어' },
      { code: 'EN', label: 'English' },
      { code: 'ZH', label: '中文' },
      { code: 'JP', label: '日本語' },
      { code: 'ES', label: 'Español' },
      { code: 'FR', label: 'Français' }
    ];
  }

  /**
   * 현재 언어 설정
   * @param {string} language - 언어 코드
   */
  setLanguage(language) {
    this.currentLanguage = language.toUpperCase();
    console.log(`🌐 MeloTTS 언어 변경: ${this.currentLanguage}`);
  }

  /**
   * MeloTTS 서버 상태 확인
   * @returns {Promise<boolean>} 서버 사용 가능 여부
   */
  async checkServerStatus() {
    try {
      const response = await fetch(`${this.baseUrl}/api/ai/tts/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: 'test',
          engine: 'melotts',
          voice: 'default',
          speed: 1.0,
          format: 'mp3'
        })
      });
      
      return response.ok;
    } catch (error) {
      console.error('MeloTTS 서버 상태 확인 실패:', error);
      return false;
    }
  }

  /**
   * 리소스 정리
   */
  cleanup() {
    // Blob URL 정리는 호출하는 쪽에서 처리
    console.log('🧹 MeloTTS API 서비스 정리 완료');
  }
}