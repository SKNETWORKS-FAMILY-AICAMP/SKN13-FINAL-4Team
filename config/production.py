from .base import config

# 운영 환경 특화 설정
config.model_path = "/app/models/streamer_models"
config.log_level = "INFO"
config.host = "0.0.0.0"

# 프로덕션 최적화
config.gpu_memory_limit = None  # 제한 없음