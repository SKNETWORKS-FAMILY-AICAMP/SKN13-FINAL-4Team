# chat/test_ai.py
import asyncio
import os
import django
from pathlib import Path
import sys

# Django 환경 설정
sys.path.append(str(Path(__file__).parent.parent))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from chat.ai_service import ai_service

async def test_ai_service():
    """AI 서비스 테스트"""
    print("=== AI 서비스 테스트 시작 ===")
    
    # 서비스 가용성 체크
    print(f"AI 서비스 가용성: {ai_service.is_available()}")
    
    if not ai_service.is_available():
        print("❌ AI 서비스를 사용할 수 없습니다")
        return
    
    # 테스트 메시지
    test_message = "안녕하세요, 테스트입니다."
    print(f"테스트 메시지: {test_message}")
    
    try:
        # AI 응답 생성
        response = await ai_service.generate_response(test_message)
        
        if response:
            print(f"✅ AI 응답 생성 성공:")
            print(f"응답: {response}")
            print(f"응답 길이: {len(response)} 문자")
        else:
            print("❌ AI 응답 생성 실패: 응답이 None입니다")
            
    except Exception as e:
        print(f"❌ AI 응답 생성 중 예외 발생: {e}")
    
    print("=== AI 서비스 테스트 완료 ===")

if __name__ == "__main__":
    asyncio.run(test_ai_service())