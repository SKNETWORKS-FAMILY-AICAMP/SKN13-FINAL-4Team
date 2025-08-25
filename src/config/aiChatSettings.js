// AI Chat and TTS configuration
export const DEFAULT_SETTINGS = {
  // 기본 TTS 설정
  streamingDelay: 50,
  ttsDelay: 500,
  ttsEngine: 'elevenlabs',
  chunkSize: 3,
  syncMode: 'after_complete',
  
  // ElevenLabs 설정 (전용 엔진)
  elevenLabsVoice: 'aneunjin',
  elevenLabsModel: 'eleven_multilingual_v2',
  elevenLabsStability: 0.5,
  elevenLabsSimilarity: 0.8,
  elevenLabsStyle: 0.0,
  elevenLabsSpeakerBoost: true,
  elevenLabsVoiceModels: {},
  useVoiceOptimizedModels: true
};

// TTS 엔진 옵션 (ElevenLabs 전용)
export const TTS_ENGINE_OPTIONS = [
  { value: 'elevenlabs', label: 'ElevenLabs', description: '초고품질, 자연스러운 음성' }
];

// ElevenLabs 음성 옵션 (model_id 포함)
export const ELEVENLABS_VOICE_OPTIONS = [
  // 한국 배우 음성 (다국어 모델 사용)
  { 
    value: 'kimtaeri', 
    label: '김태리 (한국 여성 배우)', 
    accent: 'Korean', 
    language: 'ko', 
    gender: 'female',
    defaultModel: 'eleven_multilingual_v2',
    recommendedModels: ['eleven_multilingual_v2', 'eleven_multilingual_v1'],
    description: '한국 여성 배우의 섬세하고 감정이 풍부한 음성'
  },
  { 
    value: 'kimminjeong', 
    label: '김민정 (한국 여성 배우)', 
    accent: 'Korean', 
    language: 'ko', 
    gender: 'female',
    defaultModel: 'eleven_multilingual_v2',
    recommendedModels: ['eleven_multilingual_v2', 'eleven_multilingual_v1'],
    description: '한국 여성 배우의 맑고 또렷한 음성'
  },
  { 
    value: 'jinseonkyu', 
    label: '진선규 (한국 남성 배우)', 
    accent: 'Korean', 
    language: 'ko', 
    gender: 'male',
    defaultModel: 'eleven_multilingual_v2',
    recommendedModels: ['eleven_multilingual_v2', 'eleven_turbo_v2'],
    description: '한국 남성 배우의 깊이 있고 카리스마 넘치는 음성'
  },
  { 
    value: 'parkchangwook', 
    label: '박창욱 (한국 남성 배우)', 
    accent: 'Korean', 
    language: 'ko', 
    gender: 'male',
    defaultModel: 'eleven_multilingual_v2',
    recommendedModels: ['eleven_multilingual_v2', 'eleven_turbo_v2'],
    description: '한국 남성 배우의 안정적이고 신뢰감 있는 음성'
  },
  { 
    value: 'aneunjin', 
    label: '안은진 (한국 여성 배우)', 
    accent: 'Korean', 
    language: 'ko', 
    gender: 'female',
    defaultModel: 'eleven_multilingual_v2',
    recommendedModels: ['eleven_multilingual_v2', 'eleven_multilingual_v1'],
    description: '한국 여성 배우의 따뜻하고 친근한 음성'
  },
  
  // 다국어 지원 음성 (한국어 호환) 
  { 
    value: 'charlie', 
    label: 'Charlie (호주 남성, 다국어)', 
    accent: 'Australian', 
    language: 'multi', 
    gender: 'male',
    defaultModel: 'eleven_multilingual_v2',
    recommendedModels: ['eleven_multilingual_v2', 'eleven_turbo_v2'],
    description: '호주 억양의 다국어 남성 음성'
  },
  { 
    value: 'liam', 
    label: 'Liam (미국 남성, 다국어)', 
    accent: 'American', 
    language: 'multi', 
    gender: 'male',
    defaultModel: 'eleven_multilingual_v2',
    recommendedModels: ['eleven_multilingual_v2', 'eleven_turbo_v2'],
    description: '미국 억양의 다국어 남성 음성'
  },
  { 
    value: 'charlotte', 
    label: 'Charlotte (영국 여성, 다국어)', 
    accent: 'British', 
    language: 'multi', 
    gender: 'female',
    defaultModel: 'eleven_multilingual_v2',
    recommendedModels: ['eleven_multilingual_v2', 'eleven_multilingual_v1'],
    description: '영국 억양의 다국어 여성 음성'
  },
  { 
    value: 'daniel', 
    label: 'Daniel (영국 남성, 다국어)', 
    accent: 'British', 
    language: 'multi', 
    gender: 'male',
    defaultModel: 'eleven_multilingual_v2',
    recommendedModels: ['eleven_multilingual_v2', 'eleven_turbo_v2'],
    description: '영국 억양의 다국어 남성 음성'
  },
  { 
    value: 'james', 
    label: 'James (호주 남성, 다국어)', 
    accent: 'Australian', 
    language: 'multi', 
    gender: 'male',
    defaultModel: 'eleven_multilingual_v2',
    recommendedModels: ['eleven_multilingual_v2', 'eleven_turbo_v2'],
    description: '호주 억양의 다국어 남성 음성'
  },
  { 
    value: 'joseph', 
    label: 'Joseph (영국 남성, 다국어)', 
    accent: 'British', 
    language: 'multi', 
    gender: 'male',
    defaultModel: 'eleven_multilingual_v2',
    recommendedModels: ['eleven_multilingual_v2', 'eleven_turbo_v2'],
    description: '영국 억양의 다국어 남성 음성'
  },
  { 
    value: 'jeremy', 
    label: 'Jeremy (미국 남성, 다국어)', 
    accent: 'American', 
    language: 'multi', 
    gender: 'male',
    defaultModel: 'eleven_multilingual_v2',
    recommendedModels: ['eleven_multilingual_v2', 'eleven_turbo_v2'],
    description: '미국 억양의 다국어 남성 음성'
  },
  
  // 영어 음성 (기본 제공)
  { 
    value: 'rachel', 
    label: 'Rachel (미국 여성)', 
    accent: 'American', 
    language: 'en', 
    gender: 'female',
    defaultModel: 'eleven_monolingual_v1',
    recommendedModels: ['eleven_monolingual_v1', 'eleven_multilingual_v2', 'eleven_turbo_v2'],
    description: '미국 여성 음성, 명확하고 자연스러운 톤'
  },
  { 
    value: 'adam', 
    label: 'Adam (미국 남성, 깊은 목소리)', 
    accent: 'American', 
    language: 'en', 
    gender: 'male',
    defaultModel: 'eleven_monolingual_v1',
    recommendedModels: ['eleven_monolingual_v1', 'eleven_multilingual_v2', 'eleven_turbo_v2'],
    description: '미국 남성 음성, 깊고 권위적인 톤'
  },
  { 
    value: 'antoni', 
    label: 'Antoni (미국 남성)', 
    accent: 'American', 
    language: 'en', 
    gender: 'male',
    defaultModel: 'eleven_monolingual_v1',
    recommendedModels: ['eleven_monolingual_v1', 'eleven_multilingual_v2'],
    description: '미국 남성 음성, 따뜻하고 친근한 톤'
  },
  { 
    value: 'bella', 
    label: 'Bella (미국 여성)', 
    accent: 'American', 
    language: 'en', 
    gender: 'female',
    defaultModel: 'eleven_monolingual_v1',
    recommendedModels: ['eleven_monolingual_v1', 'eleven_multilingual_v2'],
    description: '미국 여성 음성, 부드럽고 표현력이 풍부한 톤'
  },
  { 
    value: 'josh', 
    label: 'Josh (미국 남성)', 
    accent: 'American', 
    language: 'en', 
    gender: 'male',
    defaultModel: 'eleven_monolingual_v1',
    recommendedModels: ['eleven_monolingual_v1', 'eleven_turbo_v2'],
    description: '미국 남성 음성, 젊고 활기찬 톤'
  }
];

// ElevenLabs 모델 옵션
export const ELEVENLABS_MODEL_OPTIONS = [
  { value: 'eleven_multilingual_v2', label: 'Multilingual v2', description: '최신 다국어 모델' },
  { value: 'eleven_monolingual_v1', label: 'Monolingual v1', description: '영어 전용 최적화' },
  { value: 'eleven_turbo_v2', label: 'Turbo v2', description: '고속 생성' },
  { value: 'eleven_multilingual_v1', label: 'Multilingual v1', description: '구버전 다국어' }
];

// Coqui TTS 모델 옵션
export const COQUI_MODEL_OPTIONS = [
  { value: 'tts_models/ko/css10/vits', label: 'Korean CSS10 VITS' },
  { value: 'tts_models/en/ljspeech/tacotron2-DDC', label: 'English LJSpeech' },
  { value: 'tts_models/multilingual/multi-dataset/your_tts', label: 'Multilingual YourTTS' }
];

// TTS 프리셋
export const TTS_PRESETS = {
  fast: {
    streamingDelay: 20,
    ttsDelay: 200,
    chunkSize: 5,
    syncMode: 'real_time'
  },
  balanced: {
    streamingDelay: 50,
    ttsDelay: 500,
    chunkSize: 3,
    syncMode: 'after_complete'
  },
  natural: {
    streamingDelay: 80,
    ttsDelay: 800,
    chunkSize: 2,
    syncMode: 'after_complete'
  }
};

// 동기화 모드 옵션
export const SYNC_MODES = [
  { value: 'real_time', label: '실시간 (텍스트+음성 동시)' },
  { value: 'after_complete', label: '완료 후 (텍스트→음성)' },
  { value: 'chunked', label: '즉시 (빠른 표시)' }
];