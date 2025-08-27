#!/usr/bin/env python3
"""
스트리밍 채팅 기능 단위 테스트
"""
import django
import os

# Django 설정 초기화
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from chat.streaming_consumers import StreamingChatConsumer

def test_ai_trigger_detection():
    """AI 트리거 감지 기능 테스트"""
    
    print("🧪 AI 트리거 감지 테스트 시작")
    print("=" * 50)
    
    consumer = StreamingChatConsumer()
    
    test_cases = [
        # 메시지, 예상 트리거 여부, 예상 우선순위, 예상 타입
        ("안녕하세요", None, None, None),                          # 일반 메시지
        ("음악 추천 부탁합니다", None, None, None),                 # 일반 메시지 (특수문자 없음)
        ("긴급 질문입니다", None, None, None),                     # 일반 메시지 (특수문자 없음)
        ("@jammin-i 안녕하세요", True, "high", "mention"),         # 멘션 (유일한 AI 트리거)
        ("이 노래 제목이 뭔가요?", None, None, None),              # 일반 메시지 (? 제거)
        ("추천 팝송", None, None, None),                          # 일반 메시지 (# 제거)
    ]
    
    passed = 0
    failed = 0
    
    for i, (message, should_trigger, expected_priority, expected_type) in enumerate(test_cases, 1):
        result = consumer.check_ai_trigger(message)
        
        if should_trigger is None:
            # 트리거되지 않아야 함
            if result is None:
                print(f"✅ [{i}] '{message}' → 트리거 없음 (정상)")
                passed += 1
            else:
                print(f"❌ [{i}] '{message}' → 예상: 트리거 없음, 실제: {result}")
                failed += 1
        else:
            # 트리거되어야 함
            if result and result.get('trigger') == should_trigger:
                if (result.get('priority') == expected_priority and 
                    result.get('type') == expected_type):
                    print(f"✅ [{i}] '{message}' → {expected_type}({expected_priority}) (정상)")
                    passed += 1
                else:
                    print(f"❌ [{i}] '{message}' → 우선순위/타입 불일치")
                    print(f"    예상: {expected_type}({expected_priority})")
                    print(f"    실제: {result.get('type')}({result.get('priority')})")
                    failed += 1
            else:
                print(f"❌ [{i}] '{message}' → 트리거 실패: {result}")
                failed += 1
    
    print("\n" + "=" * 50)
    print(f"📊 테스트 결과: 통과 {passed}개, 실패 {failed}개")
    
    if failed == 0:
        print("🎉 모든 테스트 통과!")
    else:
        print("⚠️ 일부 테스트 실패")
    
    return failed == 0

def test_system_prompt_generation():
    """시스템 프롬프트 생성 테스트"""
    
    print("\n🧪 시스템 프롬프트 생성 테스트 시작")
    print("=" * 50)
    
    consumer = StreamingChatConsumer()
    
    trigger_types = ['mention', 'command', 'question', 'urgent', 'general']
    streamer_id = "jammin-i"
    
    for trigger_type in trigger_types:
        prompt = consumer.get_streaming_system_prompt(trigger_type, streamer_id)
        
        # 기본 체크
        if streamer_id in prompt and len(prompt) > 50:
            print(f"✅ {trigger_type}: {len(prompt)} 문자 (정상)")
        else:
            print(f"❌ {trigger_type}: 프롬프트 생성 실패")
            return False
    
    print("🎉 시스템 프롬프트 생성 테스트 통과!")
    return True

if __name__ == "__main__":
    print("🚀 스트리밍 채팅 기능 테스트")
    print()
    
    # AI 트리거 감지 테스트
    trigger_test_pass = test_ai_trigger_detection()
    
    # 시스템 프롬프트 생성 테스트  
    prompt_test_pass = test_system_prompt_generation()
    
    print("\n" + "=" * 70)
    if trigger_test_pass and prompt_test_pass:
        print("🎉 전체 테스트 성공! 스트리밍 채팅 기능이 정상 작동합니다.")
        exit(0)
    else:
        print("❌ 일부 테스트 실패. 코드를 확인해주세요.")
        exit(1)