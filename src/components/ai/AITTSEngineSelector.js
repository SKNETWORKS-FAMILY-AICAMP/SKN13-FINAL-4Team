import React, { useState, useEffect } from 'react';
import { 
  TTS_ENGINE_OPTIONS, 
  ELEVENLABS_VOICE_OPTIONS,
  ELEVENLABS_MODEL_OPTIONS,
  MELO_VOICE_OPTIONS, 
  COQUI_MODEL_OPTIONS 
} from '../../config/aiChatSettings';

/**
 * AI TTS 엔진 선택 컴포넌트
 * AI 챗봇 전용 - 다양한 TTS 엔진 선택 및 상태 확인 기능
 */
const AITTSEngineSelector = ({ 
  currentEngine, 
  settings, 
  onEngineChange, 
  onSettingChange,
  ttsManager 
}) => {
  const [engineStatus, setEngineStatus] = useState({});
  const [isChecking, setIsChecking] = useState(false);

  /**
   * TTS 엔진 서버 상태 확인
   */
  const checkEngineStatus = async () => {
    setIsChecking(true);
    const status = {};

    try {
      const baseUrl = window.location.protocol + '//' + window.location.hostname + ':8000';
      console.log(`🔧 현재 페이지: ${window.location.href}`);
      console.log(`🔧 baseUrl 생성: ${baseUrl}`);

      // 전용 상태 확인 API 사용
      console.log(`📡 TTS 상태 확인 API 호출: ${baseUrl}/api/ai/tts/status/`);
      
      const statusResponse = await fetch(`${baseUrl}/api/ai/tts/status/`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      console.log(`📡 API 응답: ${statusResponse.status} ${statusResponse.statusText}`);
      console.log(`📡 응답 헤더:`, Object.fromEntries([...statusResponse.headers.entries()]));

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        console.log('📡 API 응답 데이터:', statusData);
        
        if (statusData.success && statusData.engines) {
          status.elevenlabs = statusData.engines.elevenlabs?.available || false;
          status.melotts = statusData.engines.melotts?.available || false;
          status.coqui = false; // 현재 구현되지 않음

          console.log('✅ TTS 엔진 상태 업데이트:', {
            elevenlabs: status.elevenlabs ? '✅ 사용가능' : '❌ 사용불가',
            melotts: status.melotts ? '✅ 사용가능' : '❌ 사용불가'
          });
        } else {
          // 상태 API 실패 시 폴백
          console.warn('⚠️ TTS 상태 API 응답 오류, 폴백 모드 사용:', statusData);
          await fallbackStatusCheck(status, baseUrl);
        }
      } else {
        // 상태 API 실패 시 폴백
        console.warn(`⚠️ TTS 상태 API 연결 실패 (${statusResponse.status}), 폴백 모드 사용`);
        await fallbackStatusCheck(status, baseUrl);
      }

    } catch (error) {
      console.error('TTS 엔진 상태 확인 중 오류:', error);
      // 에러 시 기본값 설정
      status.elevenlabs = false;
      status.melotts = false;
      status.coqui = false;
    }

    setEngineStatus(status);
    setIsChecking(false);
  };

  // 폴백 상태 확인 함수
  const fallbackStatusCheck = async (status, baseUrl) => {
    console.log('🔄 폴백 모드: 실제 TTS API로 테스트 시작');
    
    // OpenAI TTS는 제거됨

    // ElevenLabs 테스트
    try {
      console.log('🧪 ElevenLabs 테스트 중...');
      const token = localStorage.getItem('accessToken');
      const elevenLabsResponse = await fetch(`${baseUrl}/api/ai/tts/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: 'test',
          engine: 'elevenlabs',
          voice: 'aneunjin',
          speed: 1.0
        })
      });
      status.elevenlabs = elevenLabsResponse.ok;
      console.log(`🧪 ElevenLabs 결과: ${elevenLabsResponse.status} - ${status.elevenlabs ? '✅' : '❌'}`);
      
      if (!elevenLabsResponse.ok) {
        const errorData = await elevenLabsResponse.json().catch(() => ({}));
        console.log('🧪 ElevenLabs 에러:', errorData);
      }
    } catch (error) {
      status.elevenlabs = false;
      console.log('🧪 ElevenLabs 예외:', error);
    }

    // MeloTTS 테스트  
    try {
      console.log('🧪 MeloTTS 테스트 중...');
      const token = localStorage.getItem('accessToken');
      const meloResponse = await fetch(`${baseUrl}/api/ai/tts/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: 'test',
          engine: 'melotts',
          voice: 'default',
          speed: 1.0
        })
      });
      status.melotts = meloResponse.ok;
      console.log(`🧪 MeloTTS 결과: ${meloResponse.status} - ${status.melotts ? '✅' : '❌'}`);
      
      if (!meloResponse.ok) {
        const errorData = await meloResponse.json().catch(() => ({}));
        console.log('🧪 MeloTTS 에러:', errorData);
      }
    } catch (error) {
      status.melotts = false;
      console.log('🧪 MeloTTS 예외:', error);
    }
    
    console.log('🔄 폴백 테스트 완료:', status);
  };

  /**
   * 컴포넌트 마운트 시 상태 확인
   */
  useEffect(() => {
    if (ttsManager) {
      checkEngineStatus();
    }
  }, [ttsManager]);

  /**
   * TTS 엔진 변경 핸들러
   */
  const handleEngineChange = async (engineId) => {
    if (!engineStatus[engineId]) {
      alert(`${engineId} 엔진을 사용할 수 없습니다. 서버 상태를 확인해주세요.`);
      return;
    }

    try {
      if (ttsManager) {
        await ttsManager.switchEngine(engineId);
      }
      onEngineChange(engineId);
      onSettingChange('ttsEngine', engineId);
    } catch (error) {
      console.error('TTS 엔진 변경 실패:', error);
      alert(`TTS 엔진 변경 실패: ${error.message}`);
    }
  };

  /**
   * 현재 엔진에 따른 음성 옵션 반환
   */
  const getCurrentVoiceOptions = () => {
    switch (currentEngine) {
      case 'elevenlabs':
        return ELEVENLABS_VOICE_OPTIONS;
      case 'melotts':
        return MELO_VOICE_OPTIONS;
      case 'coqui':
        return COQUI_MODEL_OPTIONS;
      default:
        return ELEVENLABS_VOICE_OPTIONS;
    }
  };

  /**
   * 현재 음성 설정 키 반환
   */
  const getCurrentVoiceKey = () => {
    switch (currentEngine) {
      case 'elevenlabs':
        return 'elevenLabsVoice';
      case 'melotts':
        return 'meloVoice';
      case 'coqui':
        return 'coquiModel';
      default:
        return 'elevenLabsVoice';
    }
  };

  /**
   * 현재 음성 설정 값 반환
   */
  const getCurrentVoiceValue = () => {
    const key = getCurrentVoiceKey();
    return settings[key];
  };

  /**
   * 현재 선택된 음성 객체 반환
   */
  const getCurrentVoiceObject = () => {
    const currentVoice = getCurrentVoiceValue();
    return getCurrentVoiceOptions().find(voice => voice.value === currentVoice);
  };

  /**
   * 음성별 model_id 가져오기
   */
  const getVoiceModel = (voiceName) => {
    const voiceObject = getCurrentVoiceOptions().find(voice => voice.value === voiceName);
    
    // 1. 사용자 개별 설정이 있으면 사용
    if (settings.elevenLabsVoiceModels && settings.elevenLabsVoiceModels[voiceName]) {
      return settings.elevenLabsVoiceModels[voiceName];
    }
    
    // 2. 음성 최적화 모델 사용 설정이 켜져 있고 음성에 기본 모델이 있으면 사용
    if (settings.useVoiceOptimizedModels && voiceObject && voiceObject.defaultModel) {
      return voiceObject.defaultModel;
    }
    
    // 3. 전역 기본 모델 사용
    return settings.elevenLabsModel || 'eleven_multilingual_v2';
  };

  /**
   * 음성별 model_id 설정
   */
  const setVoiceModel = (voiceName, modelId) => {
    const newVoiceModels = { ...settings.elevenLabsVoiceModels };
    
    // 기본값과 같으면 삭제 (전역 설정 사용)
    const voiceObject = getCurrentVoiceOptions().find(voice => voice.value === voiceName);
    const isDefaultModel = voiceObject && voiceObject.defaultModel === modelId;
    
    if (isDefaultModel && settings.useVoiceOptimizedModels) {
      delete newVoiceModels[voiceName];
    } else {
      newVoiceModels[voiceName] = modelId;
    }
    
    onSettingChange('elevenLabsVoiceModels', newVoiceModels);
  };

  /**
   * 상태 아이콘 컴포넌트
   */
  const StatusIcon = ({ status, engineId }) => {
    if (isChecking) {
      return (
        <div className="spinner-border spinner-border-sm text-primary" role="status">
          <span className="visually-hidden">확인 중...</span>
        </div>
      );
    }
    
    return (
      <span className={`badge ${status ? 'bg-success' : 'bg-danger'}`}>
        {status ? '✓ 사용가능' : '✗ 불가능'}
      </span>
    );
  };

  /**
   * 엔진별 상태 메시지 반환
   */
  const getStatusMessage = (engineId, status) => {
    if (isChecking) return '상태 확인 중...';
    
    if (!status) {
      switch (engineId) {
        case 'elevenlabs':
          return '⚠️ ElevenLabs API 키가 설정되지 않았습니다';
        case 'melotts':
          return '⚠️ MeloTTS 서버에 연결할 수 없습니다';
        case 'coqui':
          return '⚠️ Coqui TTS 서버에 연결할 수 없습니다';
        default:
          return '⚠️ 엔진을 사용할 수 없습니다';
      }
    }
    return null;
  };

  return (
    <div className="tts-engine-selector">
      <div className="mb-3">
        {/* 헤더 */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <label className="form-label fw-bold mb-0" style={{ color: '#ffffff' }}>
            <span className="me-2">🎤</span>
            TTS 엔진 선택
          </label>
          <button 
            className="btn btn-sm btn-outline-primary"
            onClick={checkEngineStatus}
            disabled={isChecking}
            title="서버 상태 다시 확인"
          >
            {isChecking ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" />
                확인 중...
              </>
            ) : (
              <>
                <span className="me-1">🔄</span>
                상태 확인
              </>
            )}
          </button>
        </div>

        {/* TTS 엔진 목록 */}
        <div className="row g-2">
          {TTS_ENGINE_OPTIONS.map((engine) => {
            const isActive = currentEngine === engine.value;
            const isAvailable = engineStatus[engine.value];
            const statusMessage = getStatusMessage(engine.value, isAvailable);

            return (
              <div key={engine.value} className="col-12">
                <div className={`card h-100 ${
                  isActive ? 'border-primary' : 'border-secondary'
                } ${!isAvailable ? 'opacity-75' : ''}`} 
                style={{ 
                  backgroundColor: isActive ? 'rgba(13, 202, 240, 0.1)' : '#2c3034',
                  color: '#ffffff'
                }}>
                  <div className="card-body p-3">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="ttsEngine"
                          id={`engine-${engine.value}`}
                          value={engine.value}
                          checked={isActive}
                          onChange={(e) => handleEngineChange(e.target.value)}
                          disabled={!isAvailable || isChecking}
                        />
                        <label 
                          className="form-check-label fw-bold" 
                          htmlFor={`engine-${engine.value}`}
                          style={{ color: '#ffffff' }}
                        >
                          {engine.label}
                        </label>
                      </div>
                      <StatusIcon status={isAvailable} engineId={engine.value} />
                    </div>
                    
                    <p className="card-text small mb-2" style={{ color: '#adb5bd' }}>
                      {engine.description}
                    </p>
                    
                    {statusMessage && (
                      <small className="text-danger d-block">
                        {statusMessage}
                      </small>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 현재 엔진의 음성/모델 선택 */}
      {engineStatus[currentEngine] && (
        <div className="mb-3">
          <label className="form-label fw-bold" style={{ color: '#ffffff' }}>
            <span className="me-2">🎭</span>
            {currentEngine === 'elevenlabs' && '음성 선택'}
            {currentEngine === 'melotts' && '음성 타입'}
            {currentEngine === 'coqui' && '모델 선택'}
          </label>
          <select
            className="form-select"
            value={getCurrentVoiceValue()}
            onChange={(e) => onSettingChange(getCurrentVoiceKey(), e.target.value)}
            style={{ 
              backgroundColor: '#495057', 
              borderColor: '#6c757d', 
              color: '#ffffff' 
            }}
          >
            {currentEngine === 'elevenlabs' ? (
              // ElevenLabs 음성 그룹핑 (성별로도 구분)
              <>
                <optgroup label="🇰🇷 한국어 남성 음성">
                  {getCurrentVoiceOptions()
                    .filter(option => option.language === 'ko' && option.gender === 'male')
                    .map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="🇰🇷 한국어 여성 음성">
                  {getCurrentVoiceOptions()
                    .filter(option => option.language === 'ko' && option.gender === 'female')
                    .map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="🌍 다국어 남성 음성">
                  {getCurrentVoiceOptions()
                    .filter(option => option.language === 'multi' && option.gender === 'male')
                    .map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="🌍 다국어 여성 음성">
                  {getCurrentVoiceOptions()
                    .filter(option => option.language === 'multi' && option.gender === 'female')
                    .map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="🇺🇸 영어 남성 음성">
                  {getCurrentVoiceOptions()
                    .filter(option => option.language === 'en' && option.gender === 'male')
                    .map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="🇺🇸 영어 여성 음성">
                  {getCurrentVoiceOptions()
                    .filter(option => option.language === 'en' && option.gender === 'female')
                    .map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                </optgroup>
              </>
            ) : (
              // 다른 엔진은 기존 방식
              getCurrentVoiceOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))
            )}
          </select>
          <small className="d-block mt-1" style={{ color: '#adb5bd' }}>
            선택한 엔진의 음성 또는 모델을 변경할 수 있습니다
          </small>
        </div>
      )}

      {/* ElevenLabs 음성별 Model ID 설정 */}
      {engineStatus[currentEngine] && currentEngine === 'elevenlabs' && getCurrentVoiceObject() && (
        <div className="mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <label className="form-label fw-bold mb-0" style={{ color: '#ffffff' }}>
              <span className="me-2">🎛️</span>
              {getCurrentVoiceObject()?.label} 전용 모델
            </label>
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                id="useVoiceOptimizedModels"
                checked={settings.useVoiceOptimizedModels !== false}
                onChange={(e) => onSettingChange('useVoiceOptimizedModels', e.target.checked)}
              />
              <label className="form-check-label" htmlFor="useVoiceOptimizedModels" style={{ color: '#adb5bd', fontSize: '0.8rem' }}>
                음성별 최적화
              </label>
            </div>
          </div>
          
          <select
            className="form-select"
            value={getVoiceModel(getCurrentVoiceValue())}
            onChange={(e) => setVoiceModel(getCurrentVoiceValue(), e.target.value)}
            style={{ 
              backgroundColor: '#495057', 
              borderColor: '#6c757d', 
              color: '#ffffff' 
            }}
          >
            {getCurrentVoiceObject()?.recommendedModels?.map((modelId) => {
              const modelOption = ELEVENLABS_MODEL_OPTIONS.find(m => m.value === modelId);
              const isDefault = getCurrentVoiceObject()?.defaultModel === modelId;
              const isOptimized = isDefault && '⭐ ';
              
              return (
                <option key={modelId} value={modelId}>
                  {isOptimized}{modelOption?.label || modelId}
                  {isDefault ? ' (권장)' : ''}
                </option>
              );
            }) || ELEVENLABS_MODEL_OPTIONS.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </select>
          
          <div className="mt-2">
            <small style={{ color: '#adb5bd' }}>
              <strong>{getCurrentVoiceObject()?.description}</strong>
            </small>
            {getCurrentVoiceObject()?.defaultModel && (
              <small className="d-block mt-1" style={{ color: '#17a2b8' }}>
                ⭐ 권장 모델: {ELEVENLABS_MODEL_OPTIONS.find(m => m.value === getCurrentVoiceObject()?.defaultModel)?.label}
                <br />
                <span style={{ color: '#adb5bd' }}>
                  {ELEVENLABS_MODEL_OPTIONS.find(m => m.value === getCurrentVoiceObject()?.defaultModel)?.description}
                </span>
              </small>
            )}
          </div>
        </div>
      )}

      {/* ElevenLabs 전용 추가 설정 */}
      {engineStatus[currentEngine] && currentEngine === 'elevenlabs' && (
        <div className="mb-3">
          <h6 className="mb-3" style={{ color: '#ffffff' }}>
            <span className="me-2">🎚️</span>
            ElevenLabs 고급 설정
          </h6>
          
          <div className="row g-3">
            {/* 모델 선택 */}
            <div className="col-md-6">
              <label className="form-label fw-bold" style={{ color: '#ffffff' }}>모델</label>
              <select
                className="form-select"
                value={settings.elevenLabsModel || 'eleven_multilingual_v2'}
                onChange={(e) => onSettingChange('elevenLabsModel', e.target.value)}
                style={{ 
                  backgroundColor: '#495057', 
                  borderColor: '#6c757d', 
                  color: '#ffffff' 
                }}
              >
                {ELEVENLABS_MODEL_OPTIONS.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
              <small style={{ color: '#adb5bd' }}>음성 생성 모델을 선택하세요</small>
            </div>

            {/* Stability 설정 */}
            <div className="col-md-6">
              <label className="form-label fw-bold" style={{ color: '#ffffff' }}>
                안정성: {(settings.elevenLabsStability || 0.5).toFixed(1)}
              </label>
              <input
                type="range"
                className="form-range"
                min="0"
                max="1"
                step="0.1"
                value={settings.elevenLabsStability || 0.5}
                onChange={(e) => onSettingChange('elevenLabsStability', parseFloat(e.target.value))}
              />
              <small style={{ color: '#adb5bd' }}>높을수록 안정적, 낮을수록 변화가 많음</small>
            </div>

            {/* Similarity Boost 설정 */}
            <div className="col-md-6">
              <label className="form-label fw-bold" style={{ color: '#ffffff' }}>
                유사성: {(settings.elevenLabsSimilarity || 0.8).toFixed(1)}
              </label>
              <input
                type="range"
                className="form-range"
                min="0"
                max="1"
                step="0.1"
                value={settings.elevenLabsSimilarity || 0.8}
                onChange={(e) => onSettingChange('elevenLabsSimilarity', parseFloat(e.target.value))}
              />
              <small style={{ color: '#adb5bd' }}>원본 음성과의 유사성을 조절</small>
            </div>

            {/* Style 설정 */}
            <div className="col-md-6">
              <label className="form-label fw-bold" style={{ color: '#ffffff' }}>
                스타일: {(settings.elevenLabsStyle || 0.0).toFixed(1)}
              </label>
              <input
                type="range"
                className="form-range"
                min="0"
                max="1"
                step="0.1"
                value={settings.elevenLabsStyle || 0.0}
                onChange={(e) => onSettingChange('elevenLabsStyle', parseFloat(e.target.value))}
              />
              <small style={{ color: '#adb5bd' }}>음성의 감정 표현을 조절</small>
            </div>

            {/* Speaker Boost 설정 */}
            <div className="col-12">
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="speakerBoost"
                  checked={settings.elevenLabsSpeakerBoost !== false}
                  onChange={(e) => onSettingChange('elevenLabsSpeakerBoost', e.target.checked)}
                />
                <label className="form-check-label" htmlFor="speakerBoost" style={{ color: '#ffffff' }}>
                  <strong>스피커 부스트</strong> - 음성 품질 향상 (권장)
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 현재 엔진 정보 표시 */}
      {currentEngine && (
        <div className="alert alert-info small mb-0">
          <div className="d-flex align-items-center mb-2">
            <strong className="me-2">현재 선택된 엔진:</strong>
            <span className="badge bg-primary">
              {TTS_ENGINE_OPTIONS.find(e => e.value === currentEngine)?.label}
            </span>
          </div>
          <div className="row small">
            <div className="col-6">
              <strong>실시간 스트리밍:</strong>
              <span className={`ms-1 ${
                ['melotts', 'coqui'].includes(currentEngine) 
                  ? 'text-success' 
                  : 'text-muted'
              }`}>
                {['melotts', 'coqui'].includes(currentEngine) ? '✓ 지원' : '✗ 미지원'}
              </span>
            </div>
            <div className="col-6">
              <strong>연결 상태:</strong>
              <span className={`ms-1 ${
                engineStatus[currentEngine] ? 'text-success' : 'text-danger'
              }`}>
                {engineStatus[currentEngine] ? '✓ 연결됨' : '✗ 연결 안됨'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AITTSEngineSelector;