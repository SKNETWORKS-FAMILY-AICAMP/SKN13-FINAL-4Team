import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .endpoints import router
from ..config.base import config
from ..models.model_manager import model_manager

# 환경에 따른 설정 로드
environment = os.getenv('ENVIRONMENT', 'development')
if environment == 'development':
    from ..config import development
elif environment == 'production':
    from ..config import production

# 로깅 설정
logging.basicConfig(
    level=getattr(logging, config.log_level),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# FastAPI 앱 생성
app = FastAPI(
    title="LLM Inference Server",
    description=f"Text generation server for streamer: {config.streamer_id}",
    version="1.0.0"
)

# CORS 미들웨어 (개발 환경용)
if environment == 'development':
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# 라우터 등록
app.include_router(router)

@app.on_event("startup")
async def startup_event():
    """서버 시작 시 모델 로드"""
    logger.info(f"Starting inference server for streamer: {config.streamer_id}")
    logger.info(f"Model path: {config.model_path}")
    logger.info(f"GPU device: {config.gpu_device}")
    
    try:
        model_manager.load_model()
        logger.info("Model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        # 개발 환경에서는 모델 로드 실패 시에도 서버 시작 허용
        if environment != 'development':
            raise

@app.on_event("shutdown")
async def shutdown_event():
    """서버 종료 시 정리"""
    logger.info(f"Shutting down inference server for streamer: {config.streamer_id}")

@app.get("/")
async def root():
    """기본 엔드포인트"""
    return {
        "service": "LLM Inference Server",
        "streamer_id": config.streamer_id,
        "status": "running",
        "model_loaded": model_manager.is_loaded
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "api.main:app",
        host=config.host,
        port=config.port,
        log_level=config.log_level.lower(),
        reload=environment == 'development'
    )