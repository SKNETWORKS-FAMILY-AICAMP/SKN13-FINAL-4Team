import React from 'react';

/**
 * AI 채팅 헤더 컴포넌트
 * AI 챗봇 전용 헤더 - 제목, 오디오 컨트롤, 설정 버튼을 포함
 */
const AIChatHeader = ({ 
  isPlayingAudio, 
  audioEnabled, 
  showSettings, 
  stopCurrentAudio, 
  toggleAudio, 
  setShowSettings 
}) => {
  return (
    <div className="bg-primary text-white p-3">
      <div className="container">
        <div className="d-flex justify-content-between align-items-center">
          {/* 제목 영역 */}
          <div>
            <h1 className="h4 mb-0">🤖 AI 인플루언서 챗봇</h1>
            <small className="opacity-75">
              다중 TTS 엔진 지원 • 실시간 스트리밍 • 음성 동기화
            </small>
          </div>
          
          {/* 컨트롤 영역 */}
          <div className="d-flex gap-2 align-items-center">
            {/* 음성 중단 버튼 (재생 중일 때만 표시) */}
            {isPlayingAudio && (
              <button
                className="btn btn-sm btn-outline-light"
                onClick={stopCurrentAudio}
                title="음성 중단"
                aria-label="음성 중단"
              >
                <span className="me-1">🔇</span>
                음성 중단
              </button>
            )}
            
            {/* TTS 토글 버튼 */}
            <button
              className={`btn btn-sm ${
                audioEnabled 
                  ? 'btn-light text-primary' 
                  : 'btn-outline-light'
              }`}
              onClick={toggleAudio}
              title={audioEnabled ? 'TTS 비활성화' : 'TTS 활성화'}
              aria-label={audioEnabled ? 'TTS 비활성화' : 'TTS 활성화'}
            >
              <span className="me-1">{audioEnabled ? '🔊' : '🔇'}</span>
              TTS
            </button>
            
            {/* 설정 버튼 */}
            <button
              className={`btn btn-sm ${
                showSettings 
                  ? 'btn-light text-primary' 
                  : 'btn-outline-light'
              }`}
              onClick={() => setShowSettings(!showSettings)}
              title="설정 패널 토글"
              aria-label="설정 패널 토글"
            >
              <span className="me-1">⚙️</span>
              설정
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChatHeader;