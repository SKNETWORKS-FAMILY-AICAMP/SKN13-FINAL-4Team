#!/usr/bin/env python3
"""
추론 서버 통합 테스트 스크립트
"""
import asyncio
import httpx
import time
from pathlib import Path
import sys

# 프로젝트 루트를 Python path에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

async def test_server(base_url: str, streamer_id: str):
    """단일 서버 테스트"""
    print(f"\n🧪 {streamer_id} 테스트 시작 ({base_url})")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            # 1. 헬스체크 테스트
            print("   📋 헬스체크 테스트...")
            health_response = await client.get(f"{base_url}/health")
            if health_response.status_code == 200:
                health_data = health_response.json()
                print(f"   ✅ 헬스체크 성공: {health_data['status']}")
                print(f"      - 모델 로드: {health_data['model_loaded']}")
                print(f"      - 업타임: {health_data['uptime']:.1f}초")
            else:
                print(f"   ❌ 헬스체크 실패: {health_response.status_code}")
                return False
            
            # 2. 텍스트 생성 테스트
            print("   💭 텍스트 생성 테스트...")
            generate_request = {
                "system_prompt": "당신은 친근한 AI 스트리머입니다.",
                "user_prompt": "안녕하세요! 오늘 기분이 어떠세요?",
                "max_tokens": 100,
                "temperature": 0.7
            }
            
            start_time = time.time()
            generate_response = await client.post(f"{base_url}/generate", json=generate_request)
            generation_time = time.time() - start_time
            
            if generate_response.status_code == 200:
                generate_data = generate_response.json()
                print(f"   ✅ 텍스트 생성 성공 ({generation_time:.2f}초)")
                print(f"      - 생성된 텍스트: {generate_data['text'][:50]}...")
                print(f"      - 사용 토큰: {generate_data['tokens_used']}")
            else:
                print(f"   ❌ 텍스트 생성 실패: {generate_response.status_code}")
                print(f"      - 에러: {generate_response.text}")
                return False
            
            # 3. 메트릭스 테스트
            print("   📊 메트릭스 테스트...")
            metrics_response = await client.get(f"{base_url}/metrics")
            if metrics_response.status_code == 200:
                print("   ✅ 메트릭스 조회 성공")
            else:
                print(f"   ⚠️ 메트릭스 조회 실패: {metrics_response.status_code}")
            
            return True
            
        except Exception as e:
            print(f"   ❌ 테스트 중 오류 발생: {e}")
            return False

async def test_all_servers():
    """모든 서버 테스트"""
    servers = [
        {"streamer_id": "streamer1", "url": "http://localhost:8001"},
        {"streamer_id": "streamer2", "url": "http://localhost:8002"},
        {"streamer_id": "streamer3", "url": "http://localhost:8003"},
        {"streamer_id": "streamer4", "url": "http://localhost:8004"}
    ]
    
    print("🚀 추론 서버 통합 테스트 시작")
    print("=" * 50)
    
    results = []
    
    # 병렬로 모든 서버 테스트
    tasks = []
    for server in servers:
        task = test_server(server["url"], server["streamer_id"])
        tasks.append(task)
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # 결과 요약
    print("\n" + "=" * 50)
    print("📊 테스트 결과 요약")
    
    success_count = 0
    for i, (server, result) in enumerate(zip(servers, results)):
        if isinstance(result, Exception):
            print(f"   ❌ {server['streamer_id']}: 예외 발생 - {result}")
        elif result:
            print(f"   ✅ {server['streamer_id']}: 모든 테스트 통과")
            success_count += 1
        else:
            print(f"   ❌ {server['streamer_id']}: 테스트 실패")
    
    print(f"\n🎯 전체 결과: {success_count}/{len(servers)} 서버 성공")
    
    if success_count == len(servers):
        print("🎉 모든 서버가 정상적으로 작동합니다!")
    else:
        print("⚠️ 일부 서버에서 문제가 발생했습니다.")
    
    return success_count == len(servers)

async def test_single_server():
    """단일 서버 테스트 (개발용)"""
    print("🧪 단일 서버 테스트 모드")
    success = await test_server("http://localhost:8001", "streamer1")
    if success:
        print("\n🎉 단일 서버 테스트 성공!")
    else:
        print("\n❌ 단일 서버 테스트 실패!")
    return success

def main():
    import argparse
    parser = argparse.ArgumentParser(description="추론 서버 테스트")
    parser.add_argument("--single", action="store_true", help="단일 서버만 테스트")
    args = parser.parse_args()
    
    if args.single:
        asyncio.run(test_single_server())
    else:
        asyncio.run(test_all_servers())

if __name__ == "__main__":
    main()