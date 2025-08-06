// AI TTS 매니저 - AI 챗봇 전용 여러 TTS 엔진을 통합 관리
import { AITTSService } from './aiTTSService';
import { MeloTTSService } from './meloTTSService';
import { CoquiTTSService } from './coquiTTSService';

/**
 * AI 챗봇에서 지원되는 TTS 엔진 타입
 */
export const AI_TTS_ENGINES = {
  OPENAI: 'openai',
  MELOTTS: 'melotts',
  COQUI: 'coqui'
};

/**
 * TTS 엔진별 설정 정보
 */
export const AI_TTS_ENGINE_CONFIGS = {
  [AI_TTS_ENGINES.OPENAI]: {
    name: 'OpenAI TTS',
    description: '고품질 음성, 안정적',
    supportsStreaming: false,
    voices: ['nova', 'alloy', 'echo', 'fable', 'onyx', 'shimmer'],
    maxLength: 4096 // OpenAI TTS 텍스트 길이 제한
  },
  [AI_TTS_ENGINES.MELOTTS]: {
    name: 'MeloTTS',
    description: '실시간 스트리밍, 빠른 응답',
    supportsStreaming: true,
    voices: ['default', 'female', 'male'],
    maxLength: 1000 // 권장 최대 길이
  },
  [AI_TTS_ENGINES.COQUI]: {
    name: 'Coqui TTS',
    description: '오픈소스, 커스터마이징 가능',
    supportsStreaming: true,
    voices: ['default'],
    maxLength: 500 // 권장 최대 길이
  }
};

/**
 * AI TTS 매니저 클래스
 * AI 챗봇 전용 여러 TTS 엔진을 통합하여 관리하고 동적으로 전환 가능
 */
export class AITTSManager {
  constructor(openai, settings) {
    this.openai = openai;
    this.settings = settings;
    this.currentEngine = settings.ttsEngine || AI_TTS_ENGINES.OPENAI;
    this.services = {};
    this.initializeServices();
  }

  /**
   * TTS 서비스들 초기화
   */
  initializeServices() {
    try {
      // OpenAI TTS 서비스
      this.services[AI_TTS_ENGINES.OPENAI] = new AITTSService(this.openai, this.settings);
      
      // MeloTTS 서비스
      this.services[AI_TTS_ENGINES.MELOTTS] = new MeloTTSService(this.settings);
      
      // Coqui TTS 서비스
      this.services[AI_TTS_ENGINES.COQUI] = new CoquiTTSService(this.settings);

      console.log('✅ TTS 서비스들 초기화 완료');
    } catch (error) {
      console.error('❌ TTS 서비스 초기화 실패:', error);
    }
  }

  /**
   * 현재 활성 TTS 서비스 반환
   */
  getCurrentService() {
    const service = this.services[this.currentEngine];
    if (!service) {
      console.warn(`⚠️ ${this.currentEngine} 서비스를 찾을 수 없습니다. OpenAI로 폴백합니다.`);
      return this.services[AI_TTS_ENGINES.OPENAI];
    }
    return service;
  }

  /**
   * TTS 엔진 변경
   * @param {string} engineType - 변경할 엔진 타입
   */
  async switchEngine(engineType) {
    if (!Object.values(AI_TTS_ENGINES).includes(engineType)) {
      throw new Error(`지원하지 않는 TTS 엔진: ${engineType}`);
    }

    const oldEngine = this.currentEngine;
    this.currentEngine = engineType;

    try {
      const service = this.services[engineType];
      if (!service) {
        throw new Error(`${engineType} 서비스가 초기화되지 않았습니다`);
      }

      // MeloTTS인 경우 WebSocket 연결 확인
      if (engineType === AI_TTS_ENGINES.MELOTTS) {
        if (service.connect) {
          await service.connect();
          if (!service.isConnected) {
            throw new Error('MeloTTS 서버에 연결할 수 없습니다');
          }
        }
      }

      // Coqui TTS인 경우 서버 상태 확인
      if (engineType === AI_TTS_ENGINES.COQUI) {
        if (service.checkServerStatus) {
          const isAvailable = await service.checkServerStatus();
          if (!isAvailable) {
            throw new Error('Coqui TTS 서버를 사용할 수 없습니다');
          }
        }
      }

      console.log(`🔄 TTS 엔진 변경: ${oldEngine} → ${engineType}`);
    } catch (error) {
      // 실패 시 이전 엔진으로 롤백
      this.currentEngine = oldEngine;
      console.error(`❌ TTS 엔진 변경 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * 음성 생성 (통합 인터페이스)
   * @param {string} text - 변환할 텍스트
   * @returns {Promise<string>} 생성된 오디오의 URL
   */
  async generateAudio(text) {
    if (!text || !text.trim()) {
      throw new Error('텍스트가 비어있습니다');
    }

    const service = this.getCurrentService();
    const config = AI_TTS_ENGINE_CONFIGS[this.currentEngine];

    // 텍스트 길이 검증
    if (text.length > config.maxLength) {
      console.warn(`⚠️ 텍스트가 권장 길이(${config.maxLength}자)를 초과했습니다: ${text.length}자`);
    }

    try {
      console.log(`🎵 ${config.name}로 음성 생성 중: "${text.substring(0, 50)}..."`);
      const audioUrl = await service.generateAudio(text);
      console.log(`✅ ${config.name} 음성 생성 완료`);
      return audioUrl;
    } catch (error) {
      console.error(`❌ ${config.name} 음성 생성 실패:`, error);
      
      // OpenAI가 아닌 경우 폴백 시도
      if (this.currentEngine !== AI_TTS_ENGINES.OPENAI) {
        console.log(`🔄 ${AI_TTS_ENGINES.OPENAI}로 폴백 시도...`);
        try {
          const fallbackService = this.services[AI_TTS_ENGINES.OPENAI];
          return await fallbackService.generateAudio(text);
        } catch (fallbackError) {
          console.error('❌ 폴백도 실패:', fallbackError);
        }
      }
      
      throw error;
    }
  }

  /**
   * 스트리밍 음성 생성 (지원하는 엔진만)
   * @param {string} textChunk - 변환할 텍스트 청크
   * @param {Function} onAudioChunk - 오디오 청크 콜백
   */
  async generateStreamingAudio(textChunk, onAudioChunk) {
    const service = this.getCurrentService();
    const config = AI_TTS_ENGINE_CONFIGS[this.currentEngine];

    if (!config.supportsStreaming) {
      throw new Error(`${config.name}은 스트리밍을 지원하지 않습니다`);
    }

    try {
      if (this.currentEngine === AI_TTS_ENGINES.MELOTTS) {
        service.setCallbacks(onAudioChunk);
        return await service.generateStreamingAudio(textChunk);
      } else if (this.currentEngine === AI_TTS_ENGINES.COQUI) {
        return await service.generateStreamingAudio(textChunk, onAudioChunk);
      }
    } catch (error) {
      console.error(`❌ 스트리밍 TTS 실패:`, error);
      throw error;
    }
  }

  /**
   * 현재 엔진 정보 반환
   */
  getCurrentEngineInfo() {
    return {
      engine: this.currentEngine,
      config: AI_TTS_ENGINE_CONFIGS[this.currentEngine],
      supportsStreaming: AI_TTS_ENGINE_CONFIGS[this.currentEngine].supportsStreaming,
      service: this.getCurrentService()
    };
  }

  /**
   * 사용 가능한 엔진 목록 반환
   */
  getAvailableEngines() {
    return Object.entries(AI_TTS_ENGINE_CONFIGS).map(([key, config]) => ({
      id: key,
      ...config
    }));
  }

  /**
   * 설정 업데이트
   * @param {Object} newSettings - 새로운 설정
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    
    // 모든 서비스에 설정 업데이트 전파
    Object.values(this.services).forEach(service => {
      if (service && service.updateSettings) {
        try {
          service.updateSettings(this.settings);
        } catch (error) {
          console.warn('서비스 설정 업데이트 실패:', error);
        }
      }
    });

    // 엔진이 변경된 경우 처리
    if (newSettings.ttsEngine && newSettings.ttsEngine !== this.currentEngine) {
      this.switchEngine(newSettings.ttsEngine).catch(error => {
        console.error('엔진 자동 전환 실패:', error);
      });
    }
  }

  /**
   * 엔진별 성능 통계 반환
   */
  getPerformanceStats() {
    return {
      currentEngine: this.currentEngine,
      engineConfigs: AI_TTS_ENGINE_CONFIGS,
      servicesInitialized: Object.keys(this.services).length
    };
  }

  /**
   * 리소스 정리
   */
  cleanup() {
    try {
      // MeloTTS 연결 해제
      const meloService = this.services[AI_TTS_ENGINES.MELOTTS];
      if (meloService && meloService.disconnect) {
        meloService.disconnect();
      }

      // 다른 서비스들도 cleanup 메서드가 있다면 호출
      Object.values(this.services).forEach(service => {
        if (service && service.cleanup && typeof service.cleanup === 'function') {
          service.cleanup();
        }
      });

      console.log('✅ TTS 매니저 리소스 정리 완료');
    } catch (error) {
      console.error('❌ TTS 매니저 정리 중 오류:', error);
    }
  }
}