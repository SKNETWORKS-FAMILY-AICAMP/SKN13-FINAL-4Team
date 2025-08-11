/**
 * ElevenLabs TTS Service (Backend API)
 * Backend API를 통한 안전한 ElevenLabs 음성 생성 서비스 (API 키 노출 방지)
 */
import { ELEVENLABS_VOICE_OPTIONS } from '../config/aiChatSettings.js';

export class ElevenLabsService {
  constructor(settings) {
    this.baseUrl = window.location.protocol + '//' + window.location.hostname + ':8000';
    this.settings = settings;
    this.requestCount = 0;
    this.lastRequestTime = 0;
  }

  /**
   * 음성에 최적화된 model_id 결정
   * @param {string} voiceName - 음성 이름
   * @returns {string} 최적화된 model_id
   */
  getVoiceOptimizedModel(voiceName) {
    // 1. 사용자가 해당 음성에 대해 개별 설정한 model_id가 있으면 사용
    if (this.settings.elevenLabsVoiceModels && this.settings.elevenLabsVoiceModels[voiceName]) {
      console.log(`🎛️ ${voiceName} 음성에 대한 사용자 개별 모델 사용: ${this.settings.elevenLabsVoiceModels[voiceName]}`);
      return this.settings.elevenLabsVoiceModels[voiceName];
    }

    // 2. 음성별 최적화 설정이 활성화되어 있고 해당 음성에 기본 모델이 정의되어 있으면 사용
    if (this.settings.useVoiceOptimizedModels !== false) {
      const voiceOption = ELEVENLABS_VOICE_OPTIONS.find(v => v.value === voiceName);
      if (voiceOption && voiceOption.defaultModel) {
        console.log(`⭐ ${voiceName} 음성 최적화 모델 사용: ${voiceOption.defaultModel}`);
        return voiceOption.defaultModel;
      }
    }

    // 3. 전역 기본 모델 사용
    const globalModel = this.settings.elevenLabsModel || 'eleven_multilingual_v2';
    console.log(`🌐 ${voiceName} 음성에 전역 모델 사용: ${globalModel}`);
    return globalModel;
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

    // 텍스트 길이 제한 확인 (ElevenLabs 제한: 5000자)
    if (text.length > 5000) {
      console.warn(`⚠️ 텍스트가 ElevenLabs 제한(5000자)을 초과합니다: ${text.length}자`);
      text = text.substring(0, 5000);
    }

    // 요청 통계 업데이트
    this.requestCount++;
    this.lastRequestTime = Date.now();

    try {
      console.log(`🎵 Backend ElevenLabs TTS API 요청 시작 (${this.requestCount}번째)`);
      const startTime = Date.now();

      // Backend TTS API 호출
      const response = await fetch(`${this.baseUrl}/api/ai/tts/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          engine: 'elevenlabs',
          voice: this.settings.elevenLabsVoice || 'rachel',
          model_id: this.getVoiceOptimizedModel(this.settings.elevenLabsVoice || 'rachel'),
          stability: this.settings.elevenLabsStability || 0.5,
          similarity_boost: this.settings.elevenLabsSimilarity || 0.8,
          style: this.settings.elevenLabsStyle || 0.0,
          use_speaker_boost: this.settings.elevenLabsSpeakerBoost !== false,
          format: 'mp3'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Backend ElevenLabs API 요청 실패`);
      }

      // 응답을 Blob으로 변환
      const audioArrayBuffer = await response.arrayBuffer();
      const audioBlob = new Blob([audioArrayBuffer], { 
        type: 'audio/mpeg' 
      });
      
      // Blob URL 생성
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const duration = Date.now() - startTime;
      console.log(`✅ Backend ElevenLabs TTS 완료: ${duration}ms, ${audioBlob.size} bytes`);
      
      return audioUrl;

    } catch (error) {
      console.error('❌ Backend ElevenLabs TTS 생성 실패:', error);
      
      // 네트워크 오류 또는 Backend API 오류 처리
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Backend 서버에 연결할 수 없습니다. 서버 상태를 확인해주세요');
      } else {
        throw new Error(`Backend ElevenLabs TTS 서비스 오류: ${error.message}`);
      }
    }
  }


  /**
   * 사용 가능한 음성 목록 반환
   * @returns {Array} 음성 옵션 배열
   */
  getAvailableVoices() {
    return [
      { value: 'rachel', label: 'Rachel (미국 여성)', language: 'en-US' },
      { value: 'domi', label: 'Domi (미국 여성)', language: 'en-US' },
      { value: 'bella', label: 'Bella (미국 여성)', language: 'en-US' },
      { value: 'antoni', label: 'Antoni (미국 남성)', language: 'en-US' },
      { value: 'elli', label: 'Elli (미국 여성)', language: 'en-US' },
      { value: 'josh', label: 'Josh (미국 남성)', language: 'en-US' },
      { value: 'arnold', label: 'Arnold (미국 남성)', language: 'en-US' },
      { value: 'adam', label: 'Adam (미국 남성)', language: 'en-US' },
      { value: 'sam', label: 'Sam (미국 남성)', language: 'en-US' }
    ];
  }

  /**
   * 사용 가능한 모델 목록 반환
   * @returns {Array} 모델 옵션 배열
   */
  getAvailableModels() {
    return [
      { value: 'eleven_multilingual_v2', label: 'Multilingual v2 (다국어 지원)', description: '최신 다국어 모델' },
      { value: 'eleven_monolingual_v1', label: 'Monolingual v1 (영어 전용)', description: '영어 최적화 모델' },
      { value: 'eleven_turbo_v2', label: 'Turbo v2 (고속)', description: '빠른 생성 속도' },
      { value: 'eleven_multilingual_v1', label: 'Multilingual v1 (구버전)', description: '이전 다국어 모델' }
    ];
  }

  /**
   * 설정 업데이트
   * @param {Object} newSettings - 새로운 설정
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    console.log('🔧 ElevenLabs TTS 설정 업데이트:', {
      voice: this.settings.elevenLabsVoice,
      model: this.settings.elevenLabsModel,
      stability: this.settings.elevenLabsStability,
      similarity: this.settings.elevenLabsSimilarity
    });
  }

  /**
   * 서비스 통계 정보 반환
   * @returns {Object} 통계 정보
   */
  getStats() {
    return {
      serviceName: 'Backend ElevenLabs TTS API',
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime,
      currentSettings: this.settings,
      backendUrl: this.baseUrl,
      secureApiAccess: true // Backend를 통한 안전한 API 접근
    };
  }

  /**
   * 리소스 정리
   */
  cleanup() {
    console.log('🧹 Backend ElevenLabs TTS API 서비스 정리 완료');
  }
}