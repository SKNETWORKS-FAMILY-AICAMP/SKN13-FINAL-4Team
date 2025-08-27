# 🛠️ AI 통합 개발 도구

이 디렉터리에는 AI 통합 기능 개발 및 테스트를 위한 도구들이 포함되어 있습니다.

## 📁 파일 설명

### `test_ai.py`
**용도:** AI 서비스 단독 테스트  
**실행:** `python test_ai.py`  
**기능:**
- OpenAI API 연결 테스트
- AI 응답 생성 테스트
- 서비스 가용성 확인

### `test_websocket.py`
**용도:** WebSocket AI 통합 테스트  
**실행:** `python test_websocket.py`  
**기능:**
- WebSocket 연결 테스트
- AI 자동 응답 기능 검증
- 타임아웃 및 오류 처리 테스트

## 🚀 사용 방법

### Docker 컨테이너 내에서 실행
```bash
# AI 서비스 테스트
docker-compose exec backend python chat/dev_tools/test_ai.py

# WebSocket 테스트
docker-compose exec backend python chat/dev_tools/test_websocket.py
```

### 로컬에서 실행 (환경 설정 필요)
```bash
cd backend
python chat/dev_tools/test_ai.py
```

## 🔍 문제 해결

### AI 서비스 테스트 실패 시
1. OpenAI API 키 확인: `.env` 파일의 `OPENAI_API_KEY`
2. 네트워크 연결 확인
3. Backend 서비스 실행 상태 확인

### WebSocket 테스트 실패 시
1. Backend 서버 실행 확인 (port 8000)
2. Redis 서비스 실행 확인
3. Django Channels 설정 확인

---

**참고:** 프로덕션 환경에서는 이 디렉터리를 제외하고 배포하세요.