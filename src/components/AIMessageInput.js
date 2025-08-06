import React from 'react';

/**
 * AI 메시지 입력 컴포넌트
 * AI 챗봇 전용 - 텍스트 입력, 전송/중단 버튼을 포함
 */
const AIMessageInput = ({
  inputValue,
  setInputValue,
  handleSendMessage,
  handleKeyPress,
  handleStopGeneration,
  isLoading,
  inputRef
}) => {
  /**
   * 입력값 변경 핸들러
   */
  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  /**
   * 전송 버튼 활성화 여부 결정
   */
  const isSendDisabled = !inputValue.trim() || isLoading;

  return (
    <div className="border-top p-3 bg-light">
      <div className="row g-2 align-items-end">
        {/* 입력 필드 */}
        <div className="col">
          <textarea
            ref={inputRef}
            className="form-control"
            placeholder="AI에게 무엇이든 물어보세요... (Enter: 전송, Shift+Enter: 줄바꿈)"
            value={inputValue}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            rows="2"
            disabled={isLoading}
            style={{ 
              resize: 'none',
              borderRadius: '12px',
              border: '2px solid #e9ecef'
            }}
            autoFocus
            aria-label="메시지 입력"
          />
        </div>
        
        {/* 버튼 영역 */}
        <div className="col-auto d-flex flex-column align-items-center">
          {isLoading ? (
            /* 생성 중단 버튼 */
            <button 
              className="btn btn-outline-danger mb-1 px-3"
              onClick={handleStopGeneration}
              type="button"
              title="생성 중단"
              aria-label="AI 응답 생성 중단"
            >
              <span className="me-1">⏹️</span>
              정지
            </button>
          ) : (
            /* 전송 버튼 */
            <button 
              className="btn btn-primary mb-1 px-3"
              onClick={handleSendMessage}
              disabled={isSendDisabled}
              type="button"
              title="메시지 전송"
              aria-label="메시지 전송"
            >
              <span className="me-1">🚀</span>
              전송
            </button>
          )}
          
          {/* 도움말 텍스트 */}
          <small className="text-muted text-center">
            <kbd>Enter</kbd> 전송
            <br />
            <kbd>Shift+Enter</kbd> 줄바꿈
          </small>
        </div>
      </div>
      
      {/* 로딩 상태일 때 추가 정보 */}
      {isLoading && (
        <div className="mt-2">
          <div class="progress" style={{ height: '2px' }}>
            <div 
              class="progress-bar progress-bar-striped progress-bar-animated bg-primary" 
              role="progressbar" 
              style={{ width: '100%' }}
              aria-label="AI 응답 생성 중"
            />
          </div>
          <small className="text-muted d-block text-center mt-1">
            AI가 응답을 생성하고 있습니다. 잠시만 기다려주세요...
          </small>
        </div>
      )}
    </div>
  );
};

export default AIMessageInput;