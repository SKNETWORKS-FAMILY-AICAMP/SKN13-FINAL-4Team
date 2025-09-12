import time
import asyncio
from typing import Dict
import logging
from ..models.model_manager import model_manager
from ..api.schemas import GenerateResponse
from ..config.base import config

logger = logging.getLogger(__name__)

class TextGenerator:
    """텍스트 생성 서비스"""
    
    def __init__(self):
        pass
    
    async def generate(self, system_prompt: str, user_prompt: str, 
                      max_tokens: int = None, temperature: float = None) -> GenerateResponse:
        """텍스트 생성 메인 로직"""
        start_time = time.time()
        
        try:
            # 프롬프트 포맷팅 (기존 main.py의 로직 재사용)
            formatted_prompt = await self._format_prompt(system_prompt, user_prompt)
            
            # 비동기 텍스트 생성 (GPU 작업을 별도 스레드에서 실행)
            generated_text, tokens_used = await asyncio.to_thread(
                model_manager.generate_text, 
                formatted_prompt, 
                max_tokens, 
                temperature
            )
            
            generation_time = time.time() - start_time
            
            logger.info(f"Text generation completed for {config.streamer_id}: {tokens_used} tokens in {generation_time:.2f}s")
            
            return GenerateResponse(
                text=generated_text,
                tokens_used=tokens_used,
                generation_time=generation_time
            )
            
        except Exception as e:
            logger.error(f"Text generation failed for {config.streamer_id}: {e}")
            raise
    
    async def _format_prompt(self, system_prompt: str, user_prompt: str) -> str:
        """프롬프트 포맷팅 (기존 main.py의 chat template 로직)"""
        # 대화 형식으로 구성
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        # 토크나이저의 chat_template 사용
        if model_manager.tokenizer and hasattr(model_manager.tokenizer, 'apply_chat_template'):
            try:
                formatted_prompt = model_manager.tokenizer.apply_chat_template(
                    messages, 
                    tokenize=False, 
                    add_generation_prompt=True
                )
                return formatted_prompt
            except Exception as e:
                logger.warning(f"Chat template failed, using fallback format: {e}")
        
        # 폴백: 단순 텍스트 결합
        return f"System: {system_prompt}\n\nUser: {user_prompt}\n\nAssistant:"