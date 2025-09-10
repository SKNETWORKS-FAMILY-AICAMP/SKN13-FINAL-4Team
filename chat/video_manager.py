"""
비디오 선택 시스템 - JSON 기반 설정 로드
기본 idle loop + TTS 중 talk 비디오 재생
"""
import json
import random
import logging
import os
from typing import Dict, Any, List, Optional
from django.conf import settings

logger = logging.getLogger(__name__)

class VideoSelector:
    """JSON 기반 비디오 선택기 - idle/talk 전환"""
    
    def __init__(self):
        self.video_config = None
        self._load_video_config()
    
    def _load_video_config(self):
        """JSON 설정 파일에서 비디오 구성 로드"""
        try:
            config_path = os.path.join(
                os.path.dirname(os.path.dirname(__file__)), 
                'config', 
                'video_assets.json'
            )
            
            with open(config_path, 'r', encoding='utf-8') as f:
                self.video_config = json.load(f)
            
            logger.info(f"✅ 비디오 설정 로드 완료: {len(self.video_config.get('characters', {}))} 캐릭터")
            
        except Exception as e:
            logger.error(f"❌ 비디오 설정 파일 로드 실패: {e}")
            # 기본 설정 사용
            self.video_config = self._get_default_config()
    
    
    def _get_default_config(self):
        """기본 비디오 설정 반환 (JSON 로드 실패 시 폴백)"""
        return {
            "videoCategories": {
                "idle": {
                    "files": ["a_idle_0.mp4", "a_idle_1.mp4"],
                    "defaultFile": "a_idle_0.mp4"
                },
                "talk": {
                    "files": ["a_talk_0.mp4", "a_talk_1.mp4"],
                    "defaultFile": "a_talk_0.mp4"
                }
            },
            "emotionMapping": {
                "neutral": {
                    "idle": ["a_idle_0.mp4"],
                    "talk": ["a_talk_0.mp4"],
                    "weight": 1.0
                }
            },
            "systemSettings": {
                "fallbackVideo": "a_idle_0.mp4",
                "defaultEmotion": "neutral"
            }
        }
    
    def get_talk_video(self, emotion: str = 'neutral', character_id: str = None) -> str:
        """
        TTS 재생 중 사용할 talk 비디오 선택 (캐릭터별 JSON 기반)
        
        Args:
            emotion: LLM에서 제공한 감정
            character_id: 캐릭터 ID (예: 'hongseohyun', 'kimchunki')
            
        Returns:
            talk 비디오 파일명 (basePath 포함)
        """
        try:
            character_id = character_id or self.video_config['systemSettings']['defaultCharacter']
            
            # JSON 설정에서 비디오 파일 선택
            character_config = self.video_config['characters'].get(character_id)
            
            if not character_config:
                logger.warning(f"⚠️ 캐릭터 '{character_id}' 설정 없음, 기본값 사용")
                character_id = self.video_config['systemSettings']['defaultCharacter']
                character_config = self.video_config['characters'][character_id]
            
            # 비디오 경로 결정 (JSON 기반)
            final_base_path = character_config.get('videoBasePath', f"/videos/{character_id}/")
            
            # 감정별 선호 비디오 확인
            emotion_mapping = character_config.get('emotionMapping', {})
            if emotion in emotion_mapping:
                talk_videos = emotion_mapping[emotion].get('talk', [])
                if talk_videos:
                    selected = random.choice(talk_videos)
                    full_path = final_base_path + selected
                    logger.info(f"🎬 Talk 비디오 선택 ({character_id}/{emotion}): {selected}")
                    return full_path
            
            # 기본 talk 비디오에서 선택
            talk_category = character_config['videoCategories'].get('talk', {})
            talk_files = talk_category.get('files', [])
            if talk_files:
                selected = random.choice(talk_files)
                full_path = final_base_path + selected
                logger.info(f"🎬 Talk 비디오 선택 ({character_id}/기본): {selected}")
                return full_path
            
            # 최종 폴백
            logger.warning(f"⚠️ Talk 비디오 없음, 폴백 사용: {character_id}")
            return final_base_path + talk_category.get('defaultFile', 'a_talk_0.mp4')
                
        except Exception as e:
            logger.error(f"❌ Talk 비디오 선택 실패: {str(e)}")
            fallback = self.video_config['systemSettings']['fallbackVideo']
            return f"/videos/{fallback}"
    
    def get_idle_video(self, emotion: str = 'neutral', character_id: str = None) -> str:
        """
        TTS 완료 후 돌아갈 idle 비디오 선택 (캐릭터별 JSON 기반)
        
        Args:
            emotion: 현재 감정 상태
            character_id: 캐릭터 ID
            
        Returns:
            idle 비디오 파일명 (basePath 포함)
        """
        try:
            character_id = character_id or self.video_config['systemSettings']['defaultCharacter']
            
            # JSON 설정에서 비디오 파일 선택
            character_config = self.video_config['characters'].get(character_id)
            
            if not character_config:
                logger.warning(f"⚠️ 캐릭터 '{character_id}' 설정 없음, 기본값 사용")
                character_id = self.video_config['systemSettings']['defaultCharacter']
                character_config = self.video_config['characters'][character_id]
            
            # 비디오 경로 결정 (JSON 기반)
            final_base_path = character_config.get('videoBasePath', f"/videos/{character_id}/")
            
            # 감정별 선호 비디오 확인
            emotion_mapping = character_config.get('emotionMapping', {})
            if emotion in emotion_mapping:
                idle_videos = emotion_mapping[emotion].get('idle', [])
                if idle_videos:
                    selected = random.choice(idle_videos)
                    full_path = final_base_path + selected
                    logger.info(f"😐 Idle 비디오 선택 ({character_id}/{emotion}): {selected}")
                    return full_path
            
            # 기본 idle 비디오에서 선택
            idle_category = character_config['videoCategories'].get('idle', {})
            idle_files = idle_category.get('files', [])
            if idle_files:
                selected = random.choice(idle_files)
                full_path = final_base_path + selected
                logger.info(f"😐 Idle 비디오 선택 ({character_id}/기본): {selected}")
                return full_path
            
            # 최종 폴백
            logger.warning(f"⚠️ Idle 비디오 없음, 폴백 사용: {character_id}")
            return final_base_path + idle_category.get('defaultFile', 'idle_0.mp4')
                
        except Exception as e:
            logger.error(f"❌ Idle 비디오 선택 실패: {str(e)}")
            fallback = self.video_config['systemSettings']['fallbackVideo']
            return f"/videos/{fallback}"
    
    def get_character_info(self, character_id: str) -> Dict[str, Any]:
        """캐릭터 정보 반환"""
        return self.video_config['characters'].get(character_id, {})
    
    def get_available_characters(self) -> Dict[str, str]:
        """사용 가능한 캐릭터 목록 반환"""
        return {
            char_id: config['name'] 
            for char_id, config in self.video_config['characters'].items()
        }
    
    def get_character_videos(self, character_id: str) -> Dict[str, List[str]]:
        """캐릭터별 사용 가능한 비디오 목록 반환"""
        character_config = self.video_config['characters'].get(character_id, {})
        return character_config.get('videoCategories', {})
    
    def reload_config(self):
        """설정 파일 다시 로드 (런타임 중 설정 변경 반영)"""
        logger.info("🔄 비디오 설정 파일 다시 로드 중...")
        self._load_video_config()