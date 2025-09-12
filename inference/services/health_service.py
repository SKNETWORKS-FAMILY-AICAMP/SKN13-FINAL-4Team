import time
import psutil
from typing import Dict, Optional
from ..config.base import config
from ..models.model_manager import model_manager
from ..api.schemas import HealthResponse

class HealthService:
    """헬스체크 및 메트릭스 서비스"""
    
    def __init__(self):
        self.start_time = time.time()
    
    async def get_status(self) -> HealthResponse:
        """헬스체크 상태 반환"""
        return HealthResponse(
            status="healthy" if model_manager.is_loaded else "unhealthy",
            streamer_id=config.streamer_id,
            model_loaded=model_manager.is_loaded,
            gpu_memory_used=model_manager.get_memory_usage(),
            uptime=time.time() - self.start_time
        )
    
    async def get_metrics(self) -> str:
        """Prometheus 형식 메트릭스"""
        status = await self.get_status()
        cpu_percent = psutil.cpu_percent()
        memory_percent = psutil.virtual_memory().percent
        
        metrics = [
            f"inference_server_uptime_seconds {status.uptime}",
            f"inference_server_cpu_percent {cpu_percent}",
            f"inference_server_memory_percent {memory_percent}",
            f"inference_server_model_loaded {int(status.model_loaded)}",
        ]
        
        if status.gpu_memory_used:
            metrics.append(f"inference_server_gpu_memory_mb {status.gpu_memory_used}")
        
        return "\n".join(metrics)