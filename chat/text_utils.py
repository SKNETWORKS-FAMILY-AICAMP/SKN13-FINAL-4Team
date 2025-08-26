"""
텍스트 처리 유틸리티 함수들
ElevenLabs V3 음성 태그 처리를 위한 도구
"""
import re
import logging

logger = logging.getLogger(__name__)

def remove_voice_tags(text):
    """
    ElevenLabs V3 음성 태그를 텍스트에서 제거
    
    Args:
        text (str): 원본 텍스트
        
    Returns:
        str: 음성 태그가 제거된 텍스트
    """
    if not text or not isinstance(text, str):
        return text
    
    # ElevenLabs V3 음성 태그 패턴: [태그명]
    voice_tag_pattern = r'\[(laugh|sigh|gasp|whisper|excited|sad|angry|confused|surprised|pleased|disappointed)\]'
    
    clean_text = re.sub(voice_tag_pattern, '', text, flags=re.IGNORECASE).strip()
    return clean_text

def extract_voice_tags(text):
    """
    텍스트에서 음성 태그만 추출
    
    Args:
        text (str): 원본 텍스트
        
    Returns:
        list: 발견된 음성 태그들의 리스트
    """
    if not text or not isinstance(text, str):
        return []
    
    voice_tag_pattern = r'\[(laugh|sigh|gasp|whisper|excited|sad|angry|confused|surprised|pleased|disappointed)\]'
    matches = re.findall(voice_tag_pattern, text, flags=re.IGNORECASE)
    
    return [f'[{tag.lower()}]' for tag in matches]

def has_voice_tags(text):
    """
    음성 태그가 포함된 텍스트인지 확인
    
    Args:
        text (str): 확인할 텍스트
        
    Returns:
        bool: 음성 태그 포함 여부
    """
    if not text or not isinstance(text, str):
        return False
    
    voice_tag_pattern = r'\[(laugh|sigh|gasp|whisper|excited|sad|angry|confused|surprised|pleased|disappointed)\]'
    return bool(re.search(voice_tag_pattern, text, flags=re.IGNORECASE))

def process_text_for_display(text, model='', show_tags=False):
    """
    V3 모델 사용 여부에 따라 텍스트 처리
    
    Args:
        text (str): 원본 텍스트
        model (str): 사용 중인 TTS 모델
        show_tags (bool): 태그 표시 여부 (기본값: False, 사용자에게는 숨김)
        
    Returns:
        str: 처리된 텍스트
    """
    if not text or not isinstance(text, str):
        return text
    
    # V3 모델이 아니거나 태그를 숨기려는 경우 음성 태그 제거
    if 'v3' not in model.lower() or not show_tags:
        return remove_voice_tags(text)
    
    return text

def process_ai_response_text(ai_text, tts_model=''):
    """
    AI 응답 텍스트 처리 - TTS와 표시용으로 분리
    
    Args:
        ai_text (str): AI가 생성한 원본 텍스트 (음성 태그 포함 가능)
        tts_model (str): 사용할 TTS 모델명
        
    Returns:
        dict: {
            'display_text': str,  # 사용자에게 표시할 텍스트 (태그 제거됨)
            'tts_text': str,      # TTS에 전달할 텍스트 (V3면 태그 유지, 아니면 제거)
            'voice_tags': list,   # 추출된 음성 태그 리스트
            'has_tags': bool      # 태그 포함 여부
        }
    """
    if not ai_text:
        return {
            'display_text': '',
            'tts_text': '',
            'voice_tags': [],
            'has_tags': False
        }
    
    # 음성 태그 추출
    voice_tags = extract_voice_tags(ai_text)
    has_tags = len(voice_tags) > 0
    
    # 표시용 텍스트는 항상 태그 제거
    display_text = remove_voice_tags(ai_text)
    
    # TTS용 텍스트는 모델에 따라 처리
    if 'v3' in tts_model.lower() and has_tags:
        tts_text = ai_text  # V3 모델이면 태그 유지
        logger.info(f"V3 모델 감지, 음성 태그 유지: {voice_tags}")
    else:
        tts_text = display_text  # 다른 모델이면 태그 제거
        if has_tags:
            logger.info(f"V3 이외 모델({tts_model}), 음성 태그 제거: {voice_tags}")
    
    return {
        'display_text': display_text,
        'tts_text': tts_text,
        'voice_tags': voice_tags,
        'has_tags': has_tags
    }

def debug_voice_tags(text):
    """
    디버그용: 음성 태그 정보 출력
    
    Args:
        text (str): 분석할 텍스트
        
    Returns:
        dict: 디버그 정보
    """
    tags = extract_voice_tags(text)
    clean_text = remove_voice_tags(text)
    
    debug_info = {
        'original_text': text,
        'clean_text': clean_text,
        'voice_tags': tags,
        'has_voice_tags': has_voice_tags(text)
    }
    
    logger.debug(f"🎤 음성 태그 디버그: {debug_info}")
    return debug_info