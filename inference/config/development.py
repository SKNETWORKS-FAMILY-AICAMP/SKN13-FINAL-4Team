from .base import config

# 개발 환경 특화 설정
config.model_path = "./omar_exaone_4.0_1.2b"
config.log_level = "DEBUG"
config.host = "localhost"

# RTX 3070 최적화
config.gpu_memory_limit = 7000  # MB