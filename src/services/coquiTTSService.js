// Coqui TTS 서비스 - 오픈소스 실시간 TTS
export class CoquiTTSService {
  constructor(settings) {
    this.settings = settings;
    this.serverUrl = process.env.REACT_APP_COQUI_SERVER_URL || 'http://localhost:5002';
    this.streamingEndpoint = `${this.serverUrl}/api/tts-stream`;
    this.standardEndpoint = `${this.serverUrl}/api/tts`;
  }

  // 스트리밍 TTS 생성
  async generateStreamingAudio(textChunk, onAudioChunk) {
    try {
      const response = await fetch(this.streamingEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: textChunk,
          model_name: this.settings.coquiModel || 'tts_models/ko/css10/vits',
          speaker_idx: this.settings.coquiSpeaker || 0,
          speed: this.settings.ttsSpeed || 1.0
        })
      });

      if (!response.ok) {
        throw new Error(`Coqui TTS API error: ${response.status}`);
      }

      // 스트리밍 응답 처리
      const reader = response.body.getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        // 오디오 청크 처리
        const audioBlob = new Blob([value], { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        if (onAudioChunk) {
          onAudioChunk(audioUrl);
        }
      }
    } catch (error) {
      console.error('Coqui streaming TTS failed:', error);
      throw error;
    }
  }

  // 전체 텍스트를 한번에 음성 생성
  async generateAudio(text) {
    try {
      const response = await fetch(this.standardEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          model_name: this.settings.coquiModel || 'tts_models/ko/css10/vits',
          speaker_idx: this.settings.coquiSpeaker || 0,
          speed: this.settings.ttsSpeed || 1.0
        })
      });

      if (!response.ok) {
        throw new Error(`Coqui TTS API error: ${response.status}`);
      }

      const audioBlob = await response.blob();
      return URL.createObjectURL(audioBlob);
    } catch (error) {
      console.error('Coqui TTS generation failed:', error);
      throw error;
    }
  }

  // 사용 가능한 모델 목록 가져오기
  async getAvailableModels() {
    try {
      const response = await fetch(`${this.serverUrl}/api/models`);
      if (!response.ok) {
        throw new Error(`Failed to get models: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to get Coqui models:', error);
      return [];
    }
  }

  // 설정 업데이트
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
  }

  // 서버 상태 확인
  async checkServerStatus() {
    try {
      const response = await fetch(`${this.serverUrl}/api/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}