from fastapi import APIRouter, HTTPException
from .schemas import GenerateRequest, GenerateResponse, HealthResponse
from ..services.text_generator import TextGenerator
from ..services.health_service import HealthService
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# 서비스 인스턴스
text_generator = TextGenerator()
health_service = HealthService()

@router.post("/generate", response_model=GenerateResponse)
async def generate_text(request: GenerateRequest):
    """메인 서버에서 호출하는 텍스트 생성 API"""
    try:
        result = await text_generator.generate(
            system_prompt=request.system_prompt,
            user_prompt=request.user_prompt,
            max_tokens=request.max_tokens,
            temperature=request.temperature
        )
        return result
    except Exception as e:
        logger.error(f"Generate text API error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """헬스체크 및 모니터링 API"""
    try:
        return await health_service.get_status()
    except Exception as e:
        logger.error(f"Health check API error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/metrics")
async def get_metrics():
    """모니터링 메트릭스 (Prometheus 호환)"""
    try:
        metrics = await health_service.get_metrics()
        return {"metrics": metrics}
    except Exception as e:
        logger.error(f"Metrics API error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/context/clear")
async def clear_context():
    """컨텍스트 초기화 (향후 확장용)"""
    return {"status": "context_cleared"}