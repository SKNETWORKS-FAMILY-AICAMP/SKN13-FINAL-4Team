#!/usr/bin/env python3
"""개발용 단일 추론 서버 실행"""

import os
import sys
import logging
import uvicorn

def main():
    # 환경 설정
    os.environ.setdefault('ENVIRONMENT', 'development')
    os.environ.setdefault('STREAMER_ID', 'streamer1')
    os.environ.setdefault('PORT', '8002')
    
    # 로깅 설정
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    logger = logging.getLogger(__name__)
    
    try:
        logger.info("Starting development inference server...")
        logger.info(f"Streamer ID: {os.getenv('STREAMER_ID')}")
        logger.info(f"Port: {os.getenv('PORT')}")
        
        uvicorn.run(
            "inference.api.main:app",
            host="0.0.0.0",
            port=int(os.getenv('PORT', '8002')),
            reload=False,  # 개발용 핫 리로드 비활성화
            log_level="info"
        )
        
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server failed to start: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
