import httpx
import asyncio
from typing import Dict, Optional
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

class InferenceClient:
    """추론 서버와 통신하는 HTTP 클라이언트"""
    
    def __init__(self, streamer_id: str):
        self.streamer_id = streamer_id
        self.base_url = self._get_server_url(streamer_id)
        self.timeout = httpx.Timeout(30.0)  # 30초 타임아웃
        
    def _get_server_url(self, streamer_id: str) -> str:
        """환경에 따른 서버 URL 결정"""
        urls = getattr(settings, 'INFERENCE_SERVERS', {})
        return urls.get(streamer_id, 'http://localhost:8001')
    
    async def generate_text(self, system_prompt: str, user_prompt: str, 
                          max_tokens: int = 512, temperature: float = 0.2) -> str:
        """텍스트 생성 요청"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/generate",
                    json={
                        "system_prompt": system_prompt,
                        "user_prompt": user_prompt,
                        "max_tokens": max_tokens,
                        "temperature": temperature
                    }
                )
                response.raise_for_status()
                result = response.json()
                return result["text"]
                
        except httpx.TimeoutException:
            logger.error(f"Inference server timeout: {self.streamer_id}")
            raise Exception("추론 서버 응답 시간 초과")
        except httpx.HTTPStatusError as e:
            logger.error(f"Inference server error: {e.response.status_code}")
            raise Exception(f"추론 서버 오류: {e.response.status_code}")
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            raise Exception(f"추론 서버 통신 오류: {str(e)}")
    
    async def health_check(self) -> Dict:
        """헬스체크 요청"""
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
                response = await client.get(f"{self.base_url}/health")
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Health check failed for {self.streamer_id}: {e}")
            return {"status": "unhealthy", "error": str(e)}