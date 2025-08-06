import React, { useState, useEffect } from 'react';
import { 
  TTS_ENGINE_OPTIONS, 
  OPENAI_VOICE_OPTIONS, 
  MELO_VOICE_OPTIONS, 
  COQUI_MODEL_OPTIONS 
} from '../config/chatSettings';

/**
 * TTS 엔진 선택 컴포넌트
 * 다양한 TTS 엔진 선택 및 상태 확인 기능
 */
const TTSEngineSelector = ({ 
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
      // OpenAI TTS 상태 확인 (API 키 존재 여부)
      status.openai = !!process.env.REACT_APP_OPENAI_API_KEY;

      // MeloTTS 서버 상태 확인
      try {
        const meloService = ttsManager?.services?.melotts;
        if (meloService) {
          // WebSocket 연결 시도
          await meloService.connect();
          status.melotts = meloService.isConnected;
          if (!meloService.isConnected) {
            meloService.disconnect();
          }
        } else {
          status.melotts = false;
        }
      } catch (error) {
        console.warn('MeloTTS 상태 확인 실패:', error);
        status.melotts = false;
      }

      // Coqui TTS 서버 상태 확인
      try {
        const coquiService = ttsManager?.services?.coqui;
        if (coquiService) {
          status.coqui = await coquiService.checkServerStatus();
        } else {
          status.coqui = false;
        }
      } catch (error) {
        console.warn('Coqui TTS 상태 확인 실패:', error);
        status.coqui = false;
      }

    } catch (error) {
      console.error('TTS 엔진 상태 확인 중 오류:', error);
    }

    setEngineStatus(status);
    setIsChecking(false);
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
      case 'openai':
        return OPENAI_VOICE_OPTIONS;
      case 'melotts':
        return MELO_VOICE_OPTIONS;
      case 'coqui':
        return COQUI_MODEL_OPTIONS;
      default:
        return OPENAI_VOICE_OPTIONS;
    }
  };

  /**
   * 현재 음성 설정 키 반환
   */
  const getCurrentVoiceKey = () => {
    switch (currentEngine) {
      case 'openai':
        return 'ttsVoice';
      case 'melotts':
        return 'meloVoice';
      case 'coqui':
        return 'coquiModel';
      default:
        return 'ttsVoice';
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
        case 'openai':
          return '⚠️ OpenAI API 키가 설정되지 않았습니다';
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
          <label className="form-label fw-bold mb-0">
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
                  isActive ? 'border-primary bg-light' : ''
                } ${!isAvailable ? 'opacity-75' : ''}`}>
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
                        >
                          {engine.label}
                        </label>
                      </div>
                      <StatusIcon status={isAvailable} engineId={engine.value} />
                    </div>
                    
                    <p className="card-text small text-muted mb-2">
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
          <label className="form-label fw-bold">
            <span className="me-2">🎭</span>
            {currentEngine === 'openai' && '음성 선택'}
            {currentEngine === 'melotts' && '음성 타입'}
            {currentEngine === 'coqui' && '모델 선택'}
          </label>
          <select
            className="form-select"
            value={getCurrentVoiceValue()}
            onChange={(e) => onSettingChange(getCurrentVoiceKey(), e.target.value)}
          >
            {getCurrentVoiceOptions().map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <small className="text-muted d-block mt-1">
            선택한 엔진의 음성 또는 모델을 변경할 수 있습니다
          </small>
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

export default TTSEngineSelector;