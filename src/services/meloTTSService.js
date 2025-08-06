// MeloTTS 서비스 - 실시간 스트리밍 TTS
export class MeloTTSService {
  constructor(settings) {
    this.settings = settings;
    this.serverUrl = process.env.REACT_APP_MELOTTS_SERVER_URL || 'ws://localhost:8765';
    this.websocket = null;
    this.audioQueue = [];
    this.isConnected = false;
  }

  // WebSocket 연결 설정
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        this.websocket = new WebSocket(this.serverUrl);
        
        this.websocket.onopen = () => {
          console.log('MeloTTS WebSocket connected');
          this.isConnected = true;
          resolve();
        };

        this.websocket.onmessage = (event) => {
          this.handleAudioChunk(event.data);
        };

        this.websocket.onerror = (error) => {
          console.error('MeloTTS WebSocket error:', error);
          this.isConnected = false;
          reject(error);
        };

        this.websocket.onclose = () => {
          this.isConnected = false;
          console.log('MeloTTS WebSocket disconnected');
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  // 텍스트 청크를 스트리밍으로 음성 생성
  async generateStreamingAudio(textChunk) {
    if (!this.isConnected) {
      throw new Error('MeloTTS not connected');
    }

    const request = {
      text: textChunk,
      voice: this.settings.meloVoice || 'default',
      speed: this.settings.ttsSpeed || 1.0,
      language: this.settings.language || 'ko'
    };

    this.websocket.send(JSON.stringify(request));
  }

  // 전체 텍스트를 한번에 음성 생성 (폴백용)
  async generateAudio(text) {
    try {
      // REST API 엔드포인트 사용 (WebSocket 실패 시)
      const response = await fetch(`${this.serverUrl.replace('ws://', 'http://').replace('wss://', 'https://')}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          voice: this.settings.meloVoice || 'default',
          speed: this.settings.ttsSpeed || 1.0,
          language: this.settings.language || 'ko'
        })
      });

      if (!response.ok) {
        throw new Error(`MeloTTS API error: ${response.status}`);
      }

      const audioBlob = await response.blob();
      return URL.createObjectURL(audioBlob);
    } catch (error) {
      console.error('MeloTTS generation failed:', error);
      throw error;
    }
  }

  // 오디오 청크 처리
  handleAudioChunk(audioData) {
    try {
      // Base64 디코딩 또는 직접 오디오 데이터 처리
      const audioBlob = new Blob([audioData], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // 오디오 큐에 추가
      this.audioQueue.push(audioUrl);
      
      // 콜백이 있다면 호출
      if (this.onAudioChunk) {
        this.onAudioChunk(audioUrl);
      }
    } catch (error) {
      console.error('Error handling audio chunk:', error);
    }
  }

  // 연결 해제
  disconnect() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }

  // 설정 업데이트
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
  }

  // 콜백 설정
  setCallbacks(onAudioChunk) {
    this.onAudioChunk = onAudioChunk;
  }
}