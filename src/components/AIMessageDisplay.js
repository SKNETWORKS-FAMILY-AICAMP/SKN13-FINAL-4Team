import React from 'react';

/**
 * AI 메시지 표시 컴포넌트
 * AI 챗봇 전용 - 일반 메시지, 스트리밍 메시지, TTS 상태 등을 표시
 */
const AIMessageDisplay = ({
  messages,
  isStreamingMessage,
  isGeneratingTTS,
  currentRevealedText,
  isPlayingAudio,
  isLoading,
  messagesEndRef,
  formatTime
}) => {
  /**
   * 메시지 버블 스타일 결정
   */
  const getMessageBubbleClass = (sender) => {
    return `message-bubble p-3 rounded-3 shadow-sm ${
      sender === 'user' 
        ? 'bg-primary text-white ms-5' 
        : 'bg-light text-dark me-5'
    }`;
  };

  /**
   * 타임스탬프 스타일 결정
   */
  const getTimestampClass = (sender) => {
    return `d-block text-end ${
      sender === 'user' ? 'text-white-50' : 'text-muted'
    }`;
  };

  return (
    <div 
      className="flex-grow-1 overflow-auto p-3" 
      style={{ maxHeight: 'calc(100vh - 200px)' }}
    >
      {/* 일반 메시지들 */}
      {messages.map((message) => (
        <div 
          key={message.id} 
          className={`d-flex mb-3 ${
            message.sender === 'user' 
              ? 'justify-content-end' 
              : 'justify-content-start'
          }`}
        >
          <div 
            className={getMessageBubbleClass(message.sender)}
            style={{ maxWidth: '70%', wordBreak: 'break-word' }}
          >
            <div className="message-text mb-1">
              {message.text}
            </div>
            <small className={getTimestampClass(message.sender)}>
              {formatTime(message.timestamp)}
            </small>
          </div>
        </div>
      ))}

      {/* GPT 스트리밍 메시지 (현재는 사용하지 않음) */}
      {isStreamingMessage && !isGeneratingTTS && !currentRevealedText && (
        <div className="d-flex mb-3 justify-content-start">
          <div 
            className="message-bubble p-3 rounded-3 shadow-sm bg-light text-dark me-5" 
            style={{ maxWidth: '70%', wordBreak: 'break-word' }}
          >
            <div className="message-text mb-1">
              {isStreamingMessage}
              <span className="streaming-cursor">|</span>
            </div>
            <small className="d-block text-end text-muted">
              AI 응답 생성 중...
            </small>
          </div>
        </div>
      )}

      {/* TTS 생성 단계 */}
      {isGeneratingTTS && (
        <div className="d-flex mb-3 justify-content-start">
          <div 
            className="message-bubble p-3 rounded-3 shadow-sm bg-info text-white me-5" 
            style={{ maxWidth: '70%', wordBreak: 'break-word' }}
          >
            <div className="d-flex align-items-center">
              <div className="spinner-border spinner-border-sm me-2" role="status">
                <span className="visually-hidden">음성 생성 중...</span>
              </div>
              <span>🎵 음성 생성 중...</span>
            </div>
            <small className="d-block text-end mt-1 opacity-75">
              텍스트 분석 완료 • 선택된 TTS 엔진으로 음성 생성 중
            </small>
          </div>
        </div>
      )}

      {/* 동기화된 텍스트-오디오 표시 */}
      {currentRevealedText && (
        <div className="d-flex mb-3 justify-content-start">
          <div 
            className="message-bubble p-3 rounded-3 shadow-sm bg-success text-white me-5" 
            style={{ maxWidth: '70%', wordBreak: 'break-word' }}
          >
            <div className="message-text mb-1">
              {currentRevealedText}
              {isPlayingAudio && (
                <span className="streaming-cursor ms-1" aria-label="음성 재생 중">
                  🎵
                </span>
              )}
            </div>
            <small className="d-block text-end opacity-75">
              {isPlayingAudio 
                ? '음성과 텍스트 동기화 재생 중' 
                : '음성 재생 완료'
              }
            </small>
          </div>
        </div>
      )}

      {/* 로딩 인디케이터 */}
      {isLoading && !isStreamingMessage && (
        <div className="d-flex mb-3 justify-content-start">
          <div className="message-bubble p-3 rounded-3 shadow-sm bg-light text-dark me-5">
            <div className="d-flex align-items-center">
              <div className="spinner-border spinner-border-sm me-2" role="status">
                <span className="visually-hidden">AI 응답 대기 중...</span>
              </div>
              <span className="text-muted">AI가 생각하는 중...</span>
            </div>
          </div>
        </div>
      )}

      {/* 자동 스크롤을 위한 참조 요소 */}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default AIMessageDisplay;