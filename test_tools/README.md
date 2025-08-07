# 🧪 Backend Test Tools

스트리밍 채팅 기능 테스트를 위한 도구들입니다.

## 🔧 테스트 스크립트

### 1. `websocket_connection_test.py`
**용도**: WebSocket 연결 및 실시간 통신 테스트

```bash
# 실행 방법
cd backend
python test_tools/websocket_connection_test.py
```

**테스트 내용**:
- WebSocket 연결 성공 여부
- AI 트리거 시스템 (@, !, #, ?, !!) 동작 확인
- 메시지 송수신 플로우 검증
- AI 응답 생성 및 브로드캐스팅 테스트

### 2. `streaming_unit_test.py`  
**용도**: 스트리밍 채팅 핵심 로직 단위 테스트

```bash
# 실행 방법 
cd backend
python test_tools/streaming_unit_test.py
```

**테스트 내용**:
- AI 트리거 감지 로직 검증
- 우선순위 시스템 테스트 (high/medium/low)
- 시스템 프롬프트 생성 기능 확인
- 트리거 타입별 분류 정확성

## 🚀 사용 시나리오

### 개발 중 기능 검증
```bash
# 코드 변경 후 단위 테스트
python test_tools/streaming_unit_test.py

# WebSocket 연결 테스트
python test_tools/websocket_connection_test.py
```

### 디버깅
- WebSocket 연결 이슈 진단
- AI 트리거 감지 문제 해결
- 메시지 브로드캐스팅 오류 추적

### CI/CD 통합
- 자동화된 기능 테스트
- 배포 전 핵심 기능 검증
- 회귀 테스트 실행

## ⚠️ 주의사항

1. **서버 실행 필요**: 테스트 전 Django 서버가 실행 중이어야 함
2. **인증 제한**: WebSocket 테스트는 JWT 토큰이 필요할 수 있음  
3. **환경 설정**: OpenAI API 키 등 환경변수 설정 필요

## 🔄 테스트 결과 해석

### 성공 케이스
```
✅ [1] '안녕하세요' → 트리거 없음 (정상)
✅ [2] '@jammin-i 안녕하세요' → mention(high) (정상)
🎉 모든 테스트 통과!
```

### 실패 케이스  
```
❌ [2] '@jammin-i 안녕하세요' → 트리거 실패: None
⚠️ 일부 테스트 실패
```

---

**마지막 업데이트**: 2025-08-07