#!/usr/bin/env python3
"""
4개 스트리머 추론 서버 동시 실행 스크립트 (개발용)
"""
import subprocess
import os
import sys
import time
from pathlib import Path

# 프로젝트 루트를 Python path에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

servers = [
    {"streamer_id": "streamer1", "port": 8001},
    {"streamer_id": "streamer2", "port": 8002}, 
    {"streamer_id": "streamer3", "port": 8003},
    {"streamer_id": "streamer4", "port": 8004}
]

def main():
    print("🚀 4개 추론 서버 동시 시작 중...")
    processes = []
    
    for server in servers:
        env = os.environ.copy()
        env.update({
            "ENVIRONMENT": "development",
            "STREAMER_ID": server["streamer_id"],
            "PORT": str(server["port"]),
            "MODEL_PATH": "./omar_exaone_4.0_1.2b"
        })
        
        print(f"📋 {server['streamer_id']} 서버 시작 중... (포트: {server['port']})")
        
        process = subprocess.Popen([
            sys.executable, "-m", "uvicorn", 
            "api.main:app",
            "--host", "localhost",
            "--port", str(server["port"]),
            "--reload"
        ], env=env, cwd=project_root)
        
        processes.append((process, server))
        time.sleep(2)  # 서버 간 시작 간격
    
    print(f"\n✅ 모든 서버 시작 완료!")
    print("📍 서버 주소:")
    for _, server in processes:
        print(f"   - {server['streamer_id']}: http://localhost:{server['port']}")
    
    print("\n🛑 종료하려면 Ctrl+C를 누르세요...")
    
    try:
        # 모든 프로세스가 종료될 때까지 대기
        for process, server in processes:
            process.wait()
    except KeyboardInterrupt:
        print("\n🛑 서버 종료 중...")
        for process, server in processes:
            print(f"   - {server['streamer_id']} 종료 중...")
            process.terminate()
        
        # 강제 종료
        time.sleep(2)
        for process, _ in processes:
            if process.poll() is None:
                process.kill()
        
        print("✅ 모든 서버 종료 완료!")

if __name__ == "__main__":
    main()