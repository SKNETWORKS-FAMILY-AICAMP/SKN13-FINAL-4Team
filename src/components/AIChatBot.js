import React, { useEffect } from 'react';
import { useAIChatBot } from '../hooks/useAIChatBot';
import AIChatHeader from './AIChatHeader';
import AISettingsPanel from './AISettingsPanel';
import AIMessageDisplay from './AIMessageDisplay';
import AIMessageInput from './AIMessageInput';

/**
 * 메인 AIChatBot 컴포넌트
 * TTS 기능이 통합된 AI 챗봇 인터페이스 (Backend API 사용)
 * WebSocket 채팅과 구분되는 AI 전용 챗봇
 */
const AIChatBot = () => {
  // OpenAI 클라이언트는 더 이상 필요하지 않음 (Backend API 사용)

  const {
    // 상태 관리
    messages,
    setMessages,
    inputValue,
    setInputValue,
    isLoading,
    setIsLoading,
    isStreamingMessage,
    setIsStreamingMessage,
    isPlayingAudio,
    audioEnabled,
    setAudioEnabled,
    showSettings,
    setShowSettings,
    isGeneratingTTS,
    setIsGeneratingTTS,
    currentRevealedText,
    currentPromptType,
    setCurrentPromptType,
    setCurrentRevealedText,
    setIsPlayingAudio,
    settings,

    // 참조 객체들
    messagesEndRef,
    abortControllerRef,
    inputRef,
    audioRef,
    currentMessageRef,
    streamingTimeoutRef,
    ttsTimeoutRef,
    fullTextRef,

    // 서비스들
    ttsManagerRef,
    audioServiceRef,
    textSyncServiceRef,

    // 함수들
    initializeServices,
    updateSetting,
    applyPreset
  } = useAIChatBot(); // OpenAI 클라이언트 매개변수 제거

  // 컴포넌트 마운트 시 서비스 초기화
  useEffect(() => {
    initializeServices();
  }, []);

  // 메시지 변경 시 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreamingMessage, currentRevealedText, isGeneratingTTS]);

  // 첫 사용자 상호작용 시 오디오 컨텍스트 초기화
  useEffect(() => {
    const initializeAudioContext = () => {
      if (audioRef.current) {
        audioRef.current.volume = 1.0;
        audioRef.current.muted = false;
      }
    };

    const handleFirstInteraction = () => {
      initializeAudioContext();
      // 이벤트 리스너 제거
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };

    // 첫 클릭/키보드 입력 시 오디오 컨텍스트 활성화
    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('keydown', handleFirstInteraction);

    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };
  }, []);

  /**
   * TTS 생성 및 텍스트 동기화 메인 프로세스
   */
  const generateTTSAndSyncText = async (fullText) => {
    // 오디오가 비활성화되었거나 텍스트가 비어있으면 바로 메시지 추가
    if (!audioEnabled || !fullText.trim()) {
      const botMessage = {
        id: Date.now(),
        text: fullText,
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);
      return;
    }

    try {
      // Step 1: TTS 생성 시작 상태로 변경 (로딩 인디케이터 표시)
      setIsGeneratingTTS(true);
      fullTextRef.current = fullText;
      
      // Step 2: 선택된 TTS 엔진을 통해 오디오 생성
      // - TTS 매니저가 현재 선택된 엔진을 사용하여 음성 생성
      // - OpenAI, MeloTTS, Coqui TTS 중 선택된 엔진 사용
      const audioUrl = await ttsManagerRef.current.generateAudio(fullText);
      
      // Step 3: 오디오 재생 시작 및 지속시간 획득
      // - 오디오 요소에 src 설정 후 재생
      // - 오디오 총 재생시간(duration) 반환
      const audioDuration = await audioServiceRef.current.playAudio(audioUrl);
      
      // Step 4: 텍스트 동기화 시작
      // - 오디오 재생시간에 맞춰 텍스트를 점진적으로 표시
      // - 청크 단위로 텍스트를 나누어 시간차를 두고 표시
      textSyncServiceRef.current.startSynchronizedReveal(fullText, audioDuration);
      setIsGeneratingTTS(false);
      
    } catch (error) {
      console.error('TTS Error:', error);
      setIsGeneratingTTS(false);
      // TTS 실패 시 텍스트만 바로 표시
      const botMessage = {
        id: Date.now(),
        text: fullText,
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);
    }
  };

  /**
   * 메시지 전송 및 스트리밍 처리 메인 핸들러
   */
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    // Step 1: 사용자 메시지를 채팅 목록에 추가
    const userMessage = {
      id: Date.now(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue(''); // 입력 필드 초기화
    setIsLoading(true); // 로딩 상태 시작
    setIsStreamingMessage('');
    currentMessageRef.current = '';
    
    // UI 포커스 복원
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    try {
      // Step 2: 요청 중단을 위한 AbortController 설정
      abortControllerRef.current = new AbortController();
      
      // Step 3: Backend AI Chat API 요청
      const baseUrl = window.location.protocol + '//' + window.location.hostname + ':8000';
      const conversationHistory = messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));

      const response = await fetch(`${baseUrl}/api/ai/chat/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentInput,
          conversation_history: conversationHistory
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Backend AI API 요청 실패`);
      }

      const data = await response.json();
      const aiResponse = data.response;

      if (aiResponse) {
        // Step 4: AI 응답을 누적 변수에 저장 (TTS 준비)
        const accumulatedMessage = aiResponse;
        currentMessageRef.current = accumulatedMessage;
        // Step 5: Backend API 응답 완료 후 TTS 생성 및 텍스트 동기화 시작
        if (!abortControllerRef.current.signal.aborted) {
          generateTTSAndSyncText(accumulatedMessage);
        }
      } else {
        throw new Error('AI 응답을 받지 못했습니다');
      }

    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Backend AI API Error:', error);
        const errorMessage = {
          id: Date.now(),
          text: '죄송합니다. 일시적인 오류가 발생했습니다. 다시 시도해 주세요.',
          sender: 'bot',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
      setIsStreamingMessage('');
      abortControllerRef.current = null;
      
      // 입력 필드 포커스 복원
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  /**
   * 키보드 입력 이벤트 핸들러
   */
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  /**
   * 생성 중단 핸들러
   */
  const handleStopGeneration = () => {
    // OpenAI 요청 중단
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // 타이머 정리
    if (streamingTimeoutRef.current) {
      clearTimeout(streamingTimeoutRef.current);
    }
    if (ttsTimeoutRef.current) {
      clearTimeout(ttsTimeoutRef.current);
    }
    
    // 텍스트 동기화 중단
    if (textSyncServiceRef.current) {
      textSyncServiceRef.current.stopReveal();
    }
    
    // 오디오 재생 중단
    if (audioServiceRef.current) {
      audioServiceRef.current.stopAudio();
    }
    
    // 상태 초기화
    setIsStreamingMessage('');
    setIsGeneratingTTS(false);
    setCurrentRevealedText('');
    fullTextRef.current = '';
  };

  /**
   * 오디오 토글 핸들러
   */
  const toggleAudio = () => {
    setAudioEnabled(!audioEnabled);
    if (!audioEnabled && audioServiceRef.current) {
      audioServiceRef.current.stopAudio();
    }
  };

  /**
   * 현재 오디오 중단 핸들러
   */
  const stopCurrentAudio = () => {
    if (audioServiceRef.current) {
      audioServiceRef.current.stopAudio();
    }
  };

  /**
   * 시간 포맷 유틸리티
   */
  const formatTime = (timestamp) => {
    return timestamp.toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="container-fluid h-100 d-flex flex-column p-0">
      {/* AI 채팅 헤더 */}
      <AIChatHeader
        isPlayingAudio={isPlayingAudio}
        audioEnabled={audioEnabled}
        showSettings={showSettings}
        stopCurrentAudio={stopCurrentAudio}
        toggleAudio={toggleAudio}
        setShowSettings={setShowSettings}
      />

      {/* AI 설정 패널 */}
      <AISettingsPanel
        showSettings={showSettings}
        settings={settings}
        currentPromptType={currentPromptType}
        updateSetting={updateSetting}
        applyPreset={applyPreset}
        setCurrentPromptType={setCurrentPromptType}
        ttsManager={ttsManagerRef.current}
      />

      {/* 메시지 컨테이너 */}
      <div className="flex-grow-1 overflow-hidden">
        <div className="container h-100 py-3">
          <div className="card h-100">
            <div className="card-body p-0 d-flex flex-column">
              
              {/* AI 메시지 표시 영역 */}
              <AIMessageDisplay
                messages={messages}
                isStreamingMessage={isStreamingMessage}
                isGeneratingTTS={isGeneratingTTS}
                currentRevealedText={currentRevealedText}
                isPlayingAudio={isPlayingAudio}
                isLoading={isLoading}
                messagesEndRef={messagesEndRef}
                formatTime={formatTime}
              />

              {/* AI 메시지 입력 영역 */}
              <AIMessageInput
                inputValue={inputValue}
                setInputValue={setInputValue}
                handleSendMessage={handleSendMessage}
                handleKeyPress={handleKeyPress}
                handleStopGeneration={handleStopGeneration}
                isLoading={isLoading}
                inputRef={inputRef}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 숨겨진 오디오 엘리먼트 */}
      <audio
        ref={audioRef}
        onEnded={() => {
          if (audioServiceRef.current) {
            audioServiceRef.current.onEnded && audioServiceRef.current.onEnded();
          }
        }}
        onError={() => {
          console.error('Audio playback error');
          setIsPlayingAudio(false);
        }}
        style={{ display: 'none' }}
      />

      {/* 커스텀 스타일 */}
      <style jsx>{`
        .message-bubble {
          position: relative;
          animation: fadeIn 0.3s ease-in;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .streaming-cursor {
          animation: blink 1s infinite;
          font-weight: bold;
        }
        
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        
        .message-text {
          white-space: pre-wrap;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
};

export default AIChatBot;