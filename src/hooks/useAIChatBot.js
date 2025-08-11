import { useState, useRef } from 'react';
import { DEFAULT_SETTINGS } from '../config/aiChatSettings';
import { getSystemPrompt } from '../config/aiSystemPrompts';
import { TTSServiceManager } from '../services/ttsServiceManager';
import { AIAudioService } from '../services/aiAudioService';
import { AITextSyncService } from '../services/aiTextSyncService';

export const useAIChatBot = () => {
  // State management
  const [messages, setMessages] = useState([
    { id: 1, text: '안녕하세요! AI 인플루언서입니다. 무엇을 도와드릴까요?', sender: 'bot', timestamp: new Date() }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreamingMessage, setIsStreamingMessage] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [currentRevealedText, setCurrentRevealedText] = useState('');
  const [currentPromptType, setCurrentPromptType] = useState('classic');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  // Refs
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const inputRef = useRef(null);
  const audioRef = useRef(null);
  const currentMessageRef = useRef('');
  const streamingTimeoutRef = useRef(null);
  const ttsTimeoutRef = useRef(null);
  const fullTextRef = useRef('');

  // Services
  const ttsManagerRef = useRef(null);
  const audioServiceRef = useRef(null);
  const textSyncServiceRef = useRef(null);

  // Initialize services
  const initializeServices = () => {
    // TTS Service Manager 초기화 (여러 TTS 서비스 통합 관리)
    if (!ttsManagerRef.current) {
      ttsManagerRef.current = new TTSServiceManager(settings);
    }
    
    if (!audioServiceRef.current && audioRef.current) {
      audioServiceRef.current = new AIAudioService(audioRef);
      audioServiceRef.current.setCallbacks(setIsPlayingAudio, handleAudioEnded);
    }
    if (!textSyncServiceRef.current) {
      textSyncServiceRef.current = new AITextSyncService(settings);
      textSyncServiceRef.current.setCallbacks(setCurrentRevealedText, null);
    }
  };

  // Audio ended handler
  const handleAudioEnded = () => {
    setIsPlayingAudio(false);
    
    if (textSyncServiceRef.current) {
      textSyncServiceRef.current.stopReveal();
    }
    
    if (fullTextRef.current) {
      const finalText = fullTextRef.current;
      setCurrentRevealedText(finalText);
      
      setTimeout(() => {
        const botMessage = {
          id: Date.now(),
          text: finalText,
          sender: 'bot',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMessage]);
        
        setCurrentRevealedText('');
        fullTextRef.current = '';
      }, 500);
    }
    
    if (audioServiceRef.current) {
      audioServiceRef.current.cleanupAudio();
    }
  };

  // Update settings
  const updateSetting = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    // Update services
    if (ttsManagerRef.current) {
      ttsManagerRef.current.updateSettings(newSettings);
    }
    if (ttsServiceRef.current) {
      ttsServiceRef.current.updateSettings(newSettings);
    }
    if (textSyncServiceRef.current) {
      textSyncServiceRef.current.updateSettings(newSettings);
    }
  };

  // Apply preset
  const applyPreset = (presetName, presets) => {
    if (presets[presetName]) {
      const newSettings = { ...settings, ...presets[presetName] };
      setSettings(newSettings);
      
      // Update services
      if (ttsManagerRef.current) {
        ttsManagerRef.current.updateSettings(newSettings);
      }
      if (ttsServiceRef.current) {
        ttsServiceRef.current.updateSettings(newSettings);
      }
      if (textSyncServiceRef.current) {
        textSyncServiceRef.current.updateSettings(newSettings);
      }
    }
  };

  // getCurrentSystemPrompt 제거됨 - Backend API에서 시스템 프롬프트 처리

  return {
    // State
    messages,
    setMessages,
    inputValue,
    setInputValue,
    isLoading,
    setIsLoading,
    isStreamingMessage,
    setIsStreamingMessage,
    isPlayingAudio,
    setIsPlayingAudio,
    audioEnabled,
    setAudioEnabled,
    showSettings,
    setShowSettings,
    isGeneratingTTS,
    setIsGeneratingTTS,
    currentRevealedText,
    setCurrentRevealedText,
    currentPromptType,
    setCurrentPromptType,
    settings,
    setSettings,

    // Refs
    messagesEndRef,
    abortControllerRef,
    inputRef,
    audioRef,
    currentMessageRef,
    streamingTimeoutRef,
    ttsTimeoutRef,
    fullTextRef,

    // Services
    ttsManagerRef,
    audioServiceRef,
    textSyncServiceRef,

    // Functions
    initializeServices,
    handleAudioEnded,
    updateSetting,
    applyPreset
  };
};