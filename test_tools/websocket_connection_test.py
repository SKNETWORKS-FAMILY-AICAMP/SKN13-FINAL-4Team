#!/usr/bin/env python3
"""
스트리밍 채팅 WebSocket 연결 테스트 스크립트
"""
import asyncio
import websockets
import json
import sys

async def test_streaming_chat():
    """스트리밍 채팅방 WebSocket 연결 테스트"""
    
    streamer_id = "jammin-i"
    uri = f"ws://localhost:8000/ws/stream/{streamer_id}/"
    
    print(f"🎯 스트리밍 채팅 테스트 시작")
    print(f"📡 연결 주소: {uri}")
    print(f"🎤 스트리머: {streamer_id}")
    print("=" * 50)
    
    try:
        # WebSocket 연결 시도
        print("🔌 WebSocket 연결 시도...")
        async with websockets.connect(uri) as websocket:
            print("✅ 연결 성공!")
            
            # 테스트 메시지들
            test_messages = [
                "안녕하세요!",                    # 일반 메시지 (AI 무반응)
                "!음악 추천 부탁합니다",          # 낮은 우선순위
                "@jammin-i 안녕하세요",         # 높은 우선순위 (멘션)
                "?이 노래 제목이 뭔가요?",       # 중간 우선순위 (질문)
                "#추천 팝송",                   # 높은 우선순위 (명령어)
                "!!긴급 질문입니다"             # 중간 우선순위 (긴급)
            ]
            
            # 메시지 수신을 위한 태스크
            async def receive_messages():
                while True:
                    try:
                        response = await websocket.recv()
                        data = json.loads(response)
                        
                        msg_type = data.get('message_type', 'user')
                        sender = data.get('sender', 'Unknown')
                        message = data.get('message', '')
                        timestamp = data.get('timestamp', 0)
                        
                        if msg_type == 'system':
                            print(f"🔧 [시스템] {message}")
                        elif msg_type == 'ai':
                            trigger_type = data.get('ai_trigger_type', 'unknown')
                            replied_to = data.get('replied_to', '')
                            print(f"🤖 [AI-{trigger_type}] {message}")
                            if replied_to:
                                print(f"   ↳ {replied_to}님에게 답장")
                        else:
                            print(f"👤 [{sender}] {message}")
                            
                    except websockets.exceptions.ConnectionClosed:
                        print("🔌 연결이 종료되었습니다.")
                        break
                    except Exception as e:
                        print(f"❌ 메시지 수신 오류: {e}")
            
            # 메시지 수신 태스크 시작
            receive_task = asyncio.create_task(receive_messages())
            
            # 테스트 메시지 전송
            for i, msg in enumerate(test_messages, 1):
                print(f"\n📤 [{i}/6] 전송: {msg}")
                
                message_data = {
                    "message": msg
                }
                
                await websocket.send(json.dumps(message_data))
                await asyncio.sleep(2)  # 2초 대기 (AI 응답 처리 시간)
            
            print("\n⏳ AI 응답 대기 중... (10초)")
            await asyncio.sleep(10)
            
            # 수신 태스크 종료
            receive_task.cancel()
            
            print("\n✅ 테스트 완료!")
            
    except websockets.exceptions.InvalidStatusCode as e:
        if e.status_code == 403:
            print("❌ 연결 거부: 인증이 필요합니다")
            print("💡 해결방법: 로그인한 상태에서 브라우저를 통해 테스트하세요")
        else:
            print(f"❌ 연결 오류 (코드 {e.status_code}): {e}")
    except websockets.exceptions.ConnectionRefused:
        print("❌ 연결 거부: 서버가 실행중인지 확인하세요")
    except Exception as e:
        print(f"❌ 테스트 오류: {e}")

if __name__ == "__main__":
    print("🚀 스트리밍 채팅 WebSocket 테스트")
    asyncio.run(test_streaming_chat())