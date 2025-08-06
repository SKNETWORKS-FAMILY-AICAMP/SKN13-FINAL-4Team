import React from 'react';
import { PRESETS, SYNC_MODES } from '../config/chatSettings';
import { getAvailablePromptTypes } from '../config/systemPrompts';
import TTSEngineSelector from './TTSEngineSelector';

/**
 * 설정 패널 컴포넌트
 * TTS 엔진 선택, AI 개성, 성능 설정 등을 포함
 */
const SettingsPanel = ({ 
  showSettings, 
  settings, 
  currentPromptType,
  updateSetting, 
  applyPreset,
  setCurrentPromptType,
  ttsManager
}) => {
  // 설정이 닫혀있으면 렌더링하지 않음
  if (!showSettings) return null;

  // 프리셋 라벨 정의
  const presetLabels = {
    fast: '⚡ 빠름 (실시간 우선)',
    balanced: '⚖️ 균형 (품질+속도)',
    natural: '🌿 자연스럽게 (품질 우선)'
  };

  // AI 개성 라벨 정의
  const promptTypeLabels = {
    classic: '📏 정석형 (전문적)',
    spicy: '🌶️ 매운맛 (직설적)',
    weird: '🌀 4차원 (창의적)',
    neuro: '🧠 AI답게 (논리적)',
    bait: '🎣 어그로형 (도발적)'
  };

  /**
   * 프리셋 적용 핸들러
   */
  const handlePresetApply = (presetName) => {
    applyPreset(presetName, PRESETS);
  };

  return (
    <div className="bg-light border-bottom shadow-sm" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
      <div className="container py-4">
        <div className="row">
          <div className="col-12">
            {/* 설정 헤더 */}
            <div className="d-flex align-items-center mb-4">
              <h5 className="mb-0 me-3">
                <span className="me-2">⚙️</span>
                챗봇 설정
              </h5>
              <small className="text-muted">
                AI 개성, TTS 엔진, 성능 옵션을 조정하세요
              </small>
            </div>
            
            {/* AI 개성 선택 */}
            <div className="mb-4">
              <label className="form-label fw-bold">
                <span className="me-2">🎭</span>
                AI 개성 선택
              </label>
              <div className="d-flex flex-wrap gap-2">
                {getAvailablePromptTypes().map(type => (
                  <button
                    key={type}
                    className={`btn btn-sm ${
                      currentPromptType === type 
                        ? 'btn-primary' 
                        : 'btn-outline-primary'
                    }`}
                    onClick={() => setCurrentPromptType(type)}
                    title={`AI 개성을 ${promptTypeLabels[type]}로 변경`}
                  >
                    {promptTypeLabels[type]}
                  </button>
                ))}
              </div>
              <small className="text-muted d-block mt-2">
                선택한 개성에 따라 AI의 말투와 응답 스타일이 달라집니다
              </small>
            </div>

            {/* TTS 엔진 선택 */}
            <div className="mb-4">
              <TTSEngineSelector
                currentEngine={settings.ttsEngine}
                settings={settings}
                onEngineChange={(engine) => updateSetting('ttsEngine', engine)}
                onSettingChange={updateSetting}
                ttsManager={ttsManager}
              />
            </div>

            {/* 성능 프리셋 */}
            <div className="mb-4">
              <label className="form-label fw-bold">
                <span className="me-2">🚀</span>
                성능 프리셋
              </label>
              <div className="d-flex flex-wrap gap-2">
                {Object.keys(PRESETS).map(preset => (
                  <button
                    key={preset}
                    className="btn btn-sm btn-outline-success"
                    onClick={() => handlePresetApply(preset)}
                    title={`${presetLabels[preset]} 설정으로 변경`}
                  >
                    {presetLabels[preset]}
                  </button>
                ))}
              </div>
              <small className="text-muted d-block mt-2">
                프리셋을 선택하면 아래 세부 설정이 자동으로 조정됩니다
              </small>
            </div>

            {/* 세부 설정 */}
            <div className="row g-3">
              {/* 동기화 모드 */}
              <div className="col-md-6">
                <label className="form-label fw-bold">
                  <span className="me-2">🔄</span>
                  동기화 모드
                </label>
                <select 
                  className="form-select"
                  value={settings.syncMode}
                  onChange={(e) => updateSetting('syncMode', e.target.value)}
                >
                  {SYNC_MODES.map(mode => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* TTS 속도 */}
              <div className="col-md-6">
                <label className="form-label fw-bold">
                  <span className="me-2">⏩</span>
                  TTS 속도: {settings.ttsSpeed}x
                </label>
                <input
                  type="range"
                  className="form-range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={settings.ttsSpeed}
                  onChange={(e) => updateSetting('ttsSpeed', parseFloat(e.target.value))}
                />
                <div className="d-flex justify-content-between small text-muted">
                  <span>0.5x (느림)</span>
                  <span>1.0x (보통)</span>
                  <span>2.0x (빠름)</span>
                </div>
              </div>

              {/* 텍스트 표시 속도 */}
              <div className="col-md-6">
                <label className="form-label fw-bold">
                  <span className="me-2">💭</span>
                  텍스트 속도: {settings.streamingDelay}ms
                </label>
                <input
                  type="range"
                  className="form-range"
                  min="10"
                  max="200"
                  value={settings.streamingDelay}
                  onChange={(e) => updateSetting('streamingDelay', parseInt(e.target.value))}
                />
                <div className="d-flex justify-content-between small text-muted">
                  <span>10ms (빠름)</span>
                  <span>100ms (보통)</span>
                  <span>200ms (느림)</span>
                </div>
              </div>

              {/* TTS 지연 시간 */}
              <div className="col-md-6">
                <label className="form-label fw-bold">
                  <span className="me-2">⏱️</span>
                  TTS 지연: {settings.ttsDelay}ms
                </label>
                <input
                  type="range"
                  className="form-range"
                  min="0"
                  max="2000"
                  value={settings.ttsDelay}
                  onChange={(e) => updateSetting('ttsDelay', parseInt(e.target.value))}
                />
                <div className="d-flex justify-content-between small text-muted">
                  <span>0ms (즉시)</span>
                  <span>500ms (보통)</span>
                  <span>2000ms (지연)</span>
                </div>
              </div>

              {/* 청크 크기 */}
              <div className="col-md-6">
                <label className="form-label fw-bold">
                  <span className="me-2">📝</span>
                  청크 크기: {settings.chunkSize}글자
                </label>
                <input
                  type="range"
                  className="form-range"
                  min="1"
                  max="10"
                  value={settings.chunkSize}
                  onChange={(e) => updateSetting('chunkSize', parseInt(e.target.value))}
                />
                <div className="d-flex justify-content-between small text-muted">
                  <span>1글자 (세밀)</span>
                  <span>5글자 (보통)</span>
                  <span>10글자 (빠름)</span>
                </div>
              </div>
            </div>

            {/* 설정 정보 */}
            <div className="mt-4 p-3 bg-info bg-opacity-10 rounded">
              <small className="text-muted">
                <strong>💡 팁:</strong>
                <ul className="mb-0 mt-2">
                  <li><strong>빠른 응답</strong>이 필요하면 "빠름" 프리셋 선택</li>
                  <li><strong>자연스러운 대화</strong>를 원하면 "자연스럽게" 프리셋 선택</li>
                  <li><strong>실시간 스트리밍</strong>을 원하면 MeloTTS나 Coqui TTS 선택</li>
                  <li><strong>고품질 음성</strong>을 원하면 OpenAI TTS 선택</li>
                </ul>
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;