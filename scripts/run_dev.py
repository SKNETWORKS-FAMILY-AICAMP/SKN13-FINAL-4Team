#!/usr/bin/env python3
"""
개발 환경용 추론 서버 실행 스크립트
"""
import os
import sys
import uvicorn
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# 프로젝트 루트를 Python path에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# 환경 설정
os.environ.setdefault('ENVIRONMENT', 'development')
os.environ.setdefault('STREAMER_ID', 'streamer1')
os.environ.setdefault('PORT', '8001')

if __name__ == "__main__":
    from config.base import config
    
    print(f"🚀 추론 서버 시작 중...")
    print(f"📋 스트리머 ID: {config.streamer_id}")
    print(f"🔌 포트: {config.port}")
    print(f"📁 모델 경로: {config.model_path}")
    print(f"💾 GPU 메모리 제한: {config.gpu_memory_limit}MB" if config.gpu_memory_limit else "💾 GPU 메모리: 무제한")
    
    uvicorn.run(
        "api.main:app",
        host=config.host,
        port=config.port,
        log_level=config.log_level.lower(),
        reload=True
    )