// AI Chat and TTS configuration
export const AI_DEFAULT_SETTINGS = {
  streamingDelay: 50, // 텍스트 스트리밍 지연 (ms)
  ttsDelay: 500, // TTS 시작 지연 (ms)
  ttsSpeed: 1.0, // TTS 속도 (0.25 ~ 4.0)
  ttsVoice: 'nova', // OpenAI TTS 음성
  ttsEngine: 'openai', // TTS 엔진 선택
  chunkSize: 3, // 한 번에 표시할 문자 수
  syncMode: 'after_complete', // 'real_time', 'after_complete', 'chunked'
  // MeloTTS 설정
  meloVoice: 'default',
  language: 'ko',
  // Coqui TTS 설정
  coquiModel: 'tts_models/ko/css10/vits',
  coquiSpeaker: 0
};

// AI TTS 엔진 옵션
export const AI_TTS_ENGINE_OPTIONS = [
  { value: 'openai', label: 'OpenAI TTS', description: '고품질, 안정적' },
  { value: 'melotts', label: 'MeloTTS', description: '실시간 스트리밍' },
  { value: 'coqui', label: 'Coqui TTS', description: '오픈소스, 커스터마이징' }
];

// AI 전용 OpenAI 음성 옵션
export const AI_OPENAI_VOICE_OPTIONS = [
  { value: 'nova', label: 'Nova (여성)' },
  { value: 'alloy', label: 'Alloy (중성)' },
  { value: 'echo', label: 'Echo (남성)' },
  { value: 'fable', label: 'Fable (남성)' },
  { value: 'onyx', label: 'Onyx (남성)' },
  { value: 'shimmer', label: 'Shimmer (여성)' }
];

// AI 전용 MeloTTS 음성 옵션
export const AI_MELO_VOICE_OPTIONS = [
  { value: 'default', label: 'Default Voice' },
  { value: 'female', label: 'Female Voice' },
  { value: 'male', label: 'Male Voice' }
];

// AI 전용 Coqui TTS 모델 옵션
export const AI_COQUI_MODEL_OPTIONS = [
  { value: 'tts_models/ko/css10/vits', label: 'Korean CSS10 VITS' },
  { value: 'tts_models/en/ljspeech/tacotron2-DDC', label: 'English LJSpeech' },
  { value: 'tts_models/multilingual/multi-dataset/your_tts', label: 'Multilingual YourTTS' }
];

// 호환성 지원용 (기존 코드 호환성 유지)
export const DEFAULT_SETTINGS = AI_DEFAULT_SETTINGS;
export const TTS_ENGINE_OPTIONS = AI_TTS_ENGINE_OPTIONS;
export const OPENAI_VOICE_OPTIONS = AI_OPENAI_VOICE_OPTIONS;
export const MELO_VOICE_OPTIONS = AI_MELO_VOICE_OPTIONS;
export const COQUI_MODEL_OPTIONS = AI_COQUI_MODEL_OPTIONS;
export const VOICE_OPTIONS = AI_OPENAI_VOICE_OPTIONS;

export const AI_PRESETS = {
  fast: {
    streamingDelay: 20,
    ttsDelay: 200,
    ttsSpeed: 1.2,
    chunkSize: 5,
    syncMode: 'real_time'
  },
  balanced: {
    streamingDelay: 50,
    ttsDelay: 500,
    ttsSpeed: 1.0,
    chunkSize: 3,
    syncMode: 'after_complete'
  },
  natural: {
    streamingDelay: 80,
    ttsDelay: 800,
    ttsSpeed: 0.9,
    chunkSize: 2,
    syncMode: 'after_complete'
  }
};

export const AI_SYNC_MODES = [
  { value: 'real_time', label: '실시간 (텍스트+음성 동시)' },
  { value: 'after_complete', label: '완료 후 (텍스트→음성)' },
  { value: 'chunked', label: '즉시 (빠른 표시)' }
];

// 추가 호환성 지원
export const PRESETS = AI_PRESETS;
export const SYNC_MODES = AI_SYNC_MODES;