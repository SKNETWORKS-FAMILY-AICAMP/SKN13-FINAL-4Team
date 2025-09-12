/**
 * 텍스트 처리 유틸리티 함수들
 */

/**
 * ElevenLabs V3 음성 태그를 텍스트에서 제거
 * @param {string} text - 원본 텍스트
 * @returns {string} - 음성 태그가 제거된 텍스트
 */
export const removeVoiceTags = (text) => {
    if (!text || typeof text !== 'string') {
        return text;
    }
    
    // ElevenLabs V3 음성 태그 패턴: [태그명]
    // 지원되는 태그들: laugh, sigh, gasp, whisper, excited, sad, angry, confused, surprised, pleased, disappointed
    const voiceTagPattern = /\[(laugh|sigh|gasp|whisper|excited|sad|angry|confused|surprised|pleased|disappointed)\]/gi;
    
    return text.replace(voiceTagPattern, '').trim();
};

/**
 * 텍스트에서 음성 태그만 추출
 * @param {string} text - 원본 텍스트  
 * @returns {Array} - 발견된 음성 태그들의 배열
 */
export const extractVoiceTags = (text) => {
    if (!text || typeof text !== 'string') {
        return [];
    }
    
    const voiceTagPattern = /\[(laugh|sigh|gasp|whisper|excited|sad|angry|confused|surprised|pleased|disappointed)\]/gi;
    const matches = text.match(voiceTagPattern);
    
    return matches ? matches.map(tag => tag.toLowerCase()) : [];
};

/**
 * 음성 태그가 포함된 텍스트인지 확인
 * @param {string} text - 확인할 텍스트
 * @returns {boolean} - 음성 태그 포함 여부
 */
export const hasVoiceTags = (text) => {
    if (!text || typeof text !== 'string') {
        return false;
    }
    
    const voiceTagPattern = /\[(laugh|sigh|gasp|whisper|excited|sad|angry|confused|surprised|pleased|disappointed)\]/gi;
    return voiceTagPattern.test(text);
};

/**
 * V3 모델 사용 여부에 따라 텍스트 처리
 * @param {string} text - 원본 텍스트
 * @param {string} model - 사용 중인 TTS 모델
 * @param {boolean} showTags - 태그 표시 여부 (기본값: false, 사용자에게는 숨김)
 * @returns {string} - 처리된 텍스트
 */
export const processTextForDisplay = (text, model = '', showTags = false) => {
    if (!text || typeof text !== 'string') {
        return text;
    }
    
    // V3 모델이 아니거나 태그를 숨기려는 경우 음성 태그 제거
    if (!model.includes('v3') || !showTags) {
        return removeVoiceTags(text);
    }
    
    return text;
};

/**
 * 디버그용: 음성 태그 정보 출력
 * @param {string} text - 분석할 텍스트
 */
export const debugVoiceTags = (text) => {
    const tags = extractVoiceTags(text);
    const cleanText = removeVoiceTags(text);
    
    console.log('🎤 음성 태그 디버그:', {
        originalText: text,
        cleanText: cleanText,
        voiceTags: tags,
        hasVoiceTags: hasVoiceTags(text)
    });
    
    return { cleanText, voiceTags: tags };
};