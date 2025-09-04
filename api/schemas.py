from pydantic import BaseModel, Field
from typing import Optional

class GenerateRequest(BaseModel):
    system_prompt: str = Field(..., description="시스템 프롬프트")
    user_prompt: str = Field(..., description="사용자 프롬프트")
    max_tokens: Optional[int] = Field(512, description="최대 토큰 수")
    temperature: Optional[float] = Field(0.2, description="온도 파라미터")
    
class GenerateResponse(BaseModel):
    text: str = Field(..., description="생성된 텍스트")
    tokens_used: int = Field(..., description="사용된 토큰 수")
    generation_time: float = Field(..., description="생성 시간(초)")
    
class HealthResponse(BaseModel):
    status: str = Field(..., description="서비스 상태")
    streamer_id: str = Field(..., description="스트리머 ID")
    model_loaded: bool = Field(..., description="모델 로드 상태")
    gpu_memory_used: Optional[float] = Field(None, description="GPU 메모리 사용량(MB)")
    uptime: float = Field(..., description="업타임(초)")