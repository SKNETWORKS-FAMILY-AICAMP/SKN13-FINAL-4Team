import os
from dataclasses import dataclass
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

@dataclass
class InferenceConfig:
    # 서버 설정
    host: str = os.getenv('HOST', '0.0.0.0')
    port: int = int(os.getenv('PORT', '8001'))
    
    # 스트리머 설정
    streamer_id: str = os.getenv('STREAMER_ID', 'default')
    
    # 모델 설정
    model_path: str = os.getenv('MODEL_PATH', './omar_exaone_4.0_1.2b')  # 하위 호환성
    base_model_name: str = os.getenv('BASE_MODEL_NAME', 'LGAI/EXAONE-4.0-1.2B')
    adapter_path: Optional[str] = os.getenv('ADAPTER_PATH', None)
    max_tokens: int = int(os.getenv('MAX_TOKENS', '512'))
    temperature: float = float(os.getenv('TEMPERATURE', '0.7'))
    
    # GPU 설정
    gpu_device: int = int(os.getenv('GPU_DEVICE', '0'))
    gpu_memory_limit: Optional[int] = int(os.getenv('GPU_MEMORY_LIMIT', '0')) or None
    
    # 로깅 설정
    log_level: str = os.getenv('LOG_LEVEL', 'INFO')
    
    # 헬스체크 설정
    health_check_interval: int = int(os.getenv('HEALTH_CHECK_INTERVAL', '30'))

# 전역 설정 인스턴스
config = InferenceConfig()