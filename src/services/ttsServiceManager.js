/**
 * TTS Service Manager
 * 여러 TTS 서비스를 통합 관리하는 매니저 클래스
 */
import { ElevenLabsService } from './elevenLabsService.js';

export class TTSServiceManager {
  constructor(settings = {}) {
    this.settings = settings;
    this.currentEngine = settings.ttsEngine || 'elevenlabs';
    this.services = {};
    this.activeAudioUrl = null;
    
    // 서비스 초기화
    this.initializeServices();
  }

  /**
   * 모든 TTS 서비스 초기화
   */
  initializeServices() {
    try {
      // ElevenLabs TTS 서비스 (기본 엔진)
      this.services.elevenlabs = new ElevenLabsService(this.settings);
      console.log('✅ ElevenLabs TTS 서비스 초기화 완료');

      // TODO: 필요시 다른 TTS 서비스들 추가
      // this.services.melotts = new MeloTTSService(this.settings);
      // this.services.coqui = new CoquiTTSService(this.settings);

    } catch (error) {
      console.error('❌ TTS 서비스 초기화 실패:', error);
    }
  }

  /**
   * 현재 활성 TTS 서비스 반환
   * @returns {Object} 현재 TTS 서비스 인스턴스
   */
  getCurrentService() {
    const service = this.services[this.currentEngine];
    if (!service) {
      console.warn(`⚠️ TTS 엔진 '${this.currentEngine}'을 찾을 수 없어 ElevenLabs로 폴백`);
      this.currentEngine = 'elevenlabs';
      return this.services.elevenlabs;
    }
    return service;
  }

  /**
   * TTS 엔진 변경
   * @param {string} engine - 새로운 TTS 엔진명
   */
  switchEngine(engine) {
    if (!this.services[engine]) {
      throw new Error(`지원하지 않는 TTS 엔진: ${engine}`);
    }
    
    const previousEngine = this.currentEngine;
    this.currentEngine = engine;
    
    console.log(`🔄 TTS 엔진 변경: ${previousEngine} → ${engine}`);
    
    // 이전 오디오 정리
    this.cleanupAudio();
  }

  /**
   * 텍스트를 음성으로 변환
   * @param {string} text - 변환할 텍스트
   * @returns {Promise<string>} 오디오 Blob URL
   */
  async generateAudio(text) {
    if (!text || !text.trim()) {
      throw new Error('텍스트가 비어있습니다');
    }

    const service = this.getCurrentService();
    
    try {
      // 이전 오디오 정리
      this.cleanupAudio();
      
      console.log(`🎵 ${this.currentEngine.toUpperCase()} TTS로 음성 생성 시작`);
      const audioUrl = await service.generateAudio(text);
      
      // 생성된 오디오 URL 추적
      this.activeAudioUrl = audioUrl;
      
      return audioUrl;
      
    } catch (error) {
      console.error(`❌ ${this.currentEngine.toUpperCase()} TTS 생성 실패:`, error);
      
      // 폴백 로직: ElevenLabs가 아닌 경우 ElevenLabs로 재시도
      if (this.currentEngine !== 'elevenlabs' && this.services.elevenlabs) {
        console.log('🔄 ElevenLabs TTS로 폴백 시도...');
        try {
          const fallbackUrl = await this.services.elevenlabs.generateAudio(text);
          this.activeAudioUrl = fallbackUrl;
          return fallbackUrl;
        } catch (fallbackError) {
          console.error('❌ ElevenLabs TTS 폴백도 실패:', fallbackError);
        }
      }
      
      throw error;
    }
  }

  /**
   * 사용 가능한 음성 목록 반환 (현재 엔진 기준)
   * @returns {Array} 음성 옵션 배열
   */
  getAvailableVoices() {
    const service = this.getCurrentService();
    return service.getAvailableVoices ? service.getAvailableVoices() : [];
  }

  /**
   * 사용 가능한 모델 목록 반환 (ElevenLabs 등)
   * @returns {Array} 모델 옵션 배열
   */
  getAvailableModels() {
    const service = this.getCurrentService();
    return service.getAvailableModels ? service.getAvailableModels() : [];
  }

  /**
   * 현재 TTS 엔진명 반환
   * @returns {string} 현재 엔진명
   */
  getCurrentEngine() {
    return this.currentEngine;
  }

  /**
   * 사용 가능한 TTS 엔진 목록 반환
   * @returns {Array} 엔진 목록
   */
  getAvailableEngines() {
    return Object.keys(this.services).filter(engine => this.services[engine]);
  }

  /**
   * 설정 업데이트
   * @param {Object} newSettings - 새로운 설정
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    
    // 엔진 변경이 있으면 처리
    if (newSettings.ttsEngine && newSettings.ttsEngine !== this.currentEngine) {
      this.switchEngine(newSettings.ttsEngine);
    }
    
    // 모든 서비스에 설정 전파
    Object.values(this.services).forEach(service => {
      if (service && service.updateSettings) {
        service.updateSettings(this.settings);
      }
    });
    
    console.log('🔧 TTS 매니저 설정 업데이트:', {
      currentEngine: this.currentEngine,
      availableEngines: this.getAvailableEngines()
    });
  }

  /**
   * 모든 서비스의 통계 정보 반환
   * @returns {Object} 통계 정보
   */
  getAllStats() {
    const stats = {
      currentEngine: this.currentEngine,
      availableEngines: this.getAvailableEngines(),
      services: {}
    };
    
    Object.entries(this.services).forEach(([engine, service]) => {
      if (service && service.getStats) {
        stats.services[engine] = service.getStats();
      }
    });
    
    return stats;
  }

  /**
   * 현재 서비스의 통계 정보 반환
   * @returns {Object} 현재 서비스 통계
   */
  getCurrentStats() {
    const service = this.getCurrentService();
    return service && service.getStats ? service.getStats() : {};
  }

  /**
   * 오디오 리소스 정리
   */
  cleanupAudio() {
    if (this.activeAudioUrl) {
      try {
        URL.revokeObjectURL(this.activeAudioUrl);
        this.activeAudioUrl = null;
        console.log('🧹 이전 오디오 URL 정리 완료');
      } catch (error) {
        console.warn('⚠️ 오디오 URL 정리 중 오류:', error);
      }
    }
  }

  /**
   * 모든 리소스 정리
   */
  cleanup() {
    // 오디오 리소스 정리
    this.cleanupAudio();
    
    // 모든 서비스 정리
    Object.values(this.services).forEach(service => {
      if (service && service.cleanup) {
        service.cleanup();
      }
    });
    
    console.log('🧹 TTS 매니저 전체 정리 완료');
  }

  /**
   * TTS 엔진 상태 확인
   * @param {string} engine - 확인할 엔진명
   * @returns {boolean} 사용 가능 여부
   */
  isEngineAvailable(engine) {
    return !!(this.services[engine]);
  }

  /**
   * 현재 엔진이 특정 기능을 지원하는지 확인
   * @param {string} feature - 확인할 기능명 ('models', 'voiceSettings' 등)
   * @returns {boolean} 지원 여부
   */
  supportsFeature(feature) {
    const service = this.getCurrentService();
    
    switch (feature) {
      case 'models':
        return !!(service && service.getAvailableModels);
      case 'voiceSettings':
        return this.currentEngine === 'elevenlabs';
      case 'streaming':
        return this.currentEngine === 'melotts';
      default:
        return false;
    }
  }
}