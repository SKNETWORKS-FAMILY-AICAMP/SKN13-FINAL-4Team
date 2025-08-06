# chat/test_websocket.py
import asyncio
import websockets
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_websocket_ai():
    """WebSocket을 통한 AI 응답 테스트"""
    uri = "ws://localhost:8000/ws/chat/lobby/"
    
    try:
        logger.info(f"WebSocket 연결 시도: {uri}")
        async with websockets.connect(uri) as websocket:
            logger.info("WebSocket 연결 성공!")
            
            # 테스트 메시지 전송
            test_message = {
                "message": "안녕하세요, WebSocket 테스트입니다!",
                "sender": "test_user"
            }
            
            logger.info(f"메시지 전송: {test_message}")
            await websocket.send(json.dumps(test_message))
            
            # 응답 대기 (사용자 메시지 에코백)
            response1 = await websocket.recv()
            logger.info(f"응답 1 (사용자 메시지): {response1}")
            
            # AI 응답 대기 (타임아웃 설정)
            try:
                logger.info("AI 응답 대기 중...")
                ai_response = await asyncio.wait_for(websocket.recv(), timeout=30.0)
                logger.info(f"✅ AI 응답 수신: {ai_response}")
                
                # JSON 파싱
                ai_data = json.loads(ai_response)
                if ai_data.get('sender') == 'ai':
                    logger.info(f"AI 메시지 내용: {ai_data.get('message')}")
                else:
                    logger.warning(f"예상하지 못한 송신자: {ai_data.get('sender')}")
                    
            except asyncio.TimeoutError:
                logger.error("❌ AI 응답 타임아웃 (30초)")
            except json.JSONDecodeError as e:
                logger.error(f"❌ JSON 파싱 오류: {e}")
            except Exception as e:
                logger.error(f"❌ AI 응답 처리 오류: {e}")
                
    except websockets.exceptions.ConnectionClosed as e:
        logger.error(f"❌ WebSocket 연결 종료: {e}")
    except Exception as e:
        logger.error(f"❌ WebSocket 연결 실패: {e}")

if __name__ == "__main__":
    asyncio.run(test_websocket_ai())