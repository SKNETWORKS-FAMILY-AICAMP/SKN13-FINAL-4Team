# LLM 추론 서버

AI 스트리머를 위한 로컬 LLM 추론 서버입니다. EXAONE-4.0-1.2B 모델을 사용하여 실시간 텍스트 생성을 제공합니다.

## 🚀 빠른 시작

### 1. 의존성 설치

```bash
cd inference/
pip install -r requirements.txt
```

### 2. 모델 준비

EXAONE-4.0-1.2B 모델을 다음 위치에 배치하세요:
```
inference/
├── omar_exaone_4.0_1.2b/
│   ├── config.json
│   ├── pytorch_model.bin (또는 .safetensors)
│   ├── tokenizer.json
│   └── ...
```

### 3. 환경 설정

```bash
# .env 파일 생성
cp .env.example .env

# 필요한 경우 환경변수 수정
# STREAMER_ID, PORT, MODEL_PATH 등
```

### 4. 서버 실행

#### 단일 서버 (개발용)
```bash
python scripts/run_dev.py
```

#### 4개 서버 동시 실행 (테스트용)
```bash
python scripts/run_all_dev.py
```

## 🧪 테스트

### 통합 테스트 실행
```bash
# 모든 서버 테스트
python scripts/test_integration.py

# 단일 서버 테스트
python scripts/test_integration.py --single
```

### 수동 테스트
```bash
# 헬스체크
curl http://localhost:8001/health

# 텍스트 생성
curl -X POST http://localhost:8001/generate \
  -H "Content-Type: application/json" \
  -d '{
    "system_prompt": "당신은 친근한 AI입니다.",
    "user_prompt": "안녕하세요!",
    "max_tokens": 100
  }'
```

## 📝 API 문서

### 엔드포인트

- `POST /generate` - 텍스트 생성
- `GET /health` - 헬스체크
- `GET /metrics` - 모니터링 메트릭스
- `POST /context/clear` - 컨텍스트 초기화

### 요청 예시

```python
import httpx

async with httpx.AsyncClient() as client:
    response = await client.post("http://localhost:8001/generate", json={
        "system_prompt": "당신은 도움이 되는 AI입니다.",
        "user_prompt": "파이썬에서 비동기 프로그래밍이란?",
        "max_tokens": 200,
        "temperature": 0.7
    })
    result = response.json()
    print(result["text"])
```

## ⚙️ 설정

### 환경변수

| 변수명 | 기본값 | 설명 |
|--------|--------|------|
| `ENVIRONMENT` | `development` | 실행 환경 |
| `STREAMER_ID` | `streamer1` | 스트리머 식별자 |
| `HOST` | `localhost` | 서버 호스트 |
| `PORT` | `8001` | 서버 포트 |
| `MODEL_PATH` | `./omar_exaone_4.0_1.2b` | 모델 경로 |
| `MAX_TOKENS` | `512` | 최대 토큰 수 |
| `TEMPERATURE` | `0.2` | 생성 온도 |
| `GPU_DEVICE` | `0` | 사용할 GPU 번호 |
| `GPU_MEMORY_LIMIT` | - | GPU 메모리 제한(MB) |
| `LOG_LEVEL` | `INFO` | 로그 레벨 |

### GPU 최적화

RTX 3070 (8GB VRAM) 환경에서의 권장 설정:
```bash
GPU_MEMORY_LIMIT=7000  # 7GB로 제한
```

## 🐳 Docker 실행

### 개발 환경
```bash
docker build -f docker/Dockerfile.dev -t inference-server:dev .
docker run -p 8001:8001 --gpus all inference-server:dev
```

### 운영 환경
```bash
docker build -f docker/Dockerfile.prod -t inference-server:prod .
docker run -p 8001:8001 --gpus all \
  -e STREAMER_ID=streamer1 \
  -e MODEL_PATH=/app/models/streamer1 \
  inference-server:prod
```

## 📊 모니터링

### 헬스체크 확인
```bash
curl http://localhost:8001/health
```

### 메트릭스 조회
```bash
curl http://localhost:8001/metrics
```

### 로그 확인
로그는 콘솔과 파일(`logs/inference.log`)에 기록됩니다.

## 🚨 문제 해결

### 일반적인 문제

#### 1. 모델 로드 실패
```
❌ Failed to load model: [Errno 2] No such file or directory
```
**해결**: `MODEL_PATH` 환경변수를 올바른 모델 경로로 설정하세요.

#### 2. GPU 메모리 부족
```
❌ CUDA out of memory
```
**해결**: `GPU_MEMORY_LIMIT`을 더 낮은 값으로 설정하거나, 다른 GPU 프로세스를 종료하세요.

#### 3. 포트 충돌
```
❌ Address already in use
```
**해결**: 다른 포트를 사용하거나, 기존 프로세스를 종료하세요.

### 디버깅

개발 모드에서 상세한 로그를 확인하려면:
```bash
LOG_LEVEL=DEBUG python scripts/run_dev.py
```

## 🔄 메인 서버 연동

Django 메인 서버에서 이 추론 서버를 사용하려면:

1. `backend/config/settings.py`에 서버 URL 추가
2. `backend/chat/services/inference_client.py`가 자동으로 연동
3. OpenAI API 폴백 기능 내장

자세한 내용은 `INFERENCE_SERVER_ARCHITECTURE.md` 문서를 참조하세요.

## 📈 성능 최적화

### RTX 3070 기준 성능
- **모델 크기**: ~2.4GB (FP16)
- **예상 속도**: ~30-50 tokens/sec
- **메모리 사용량**: ~3-4GB VRAM

### 최적화 팁
1. `torch_dtype=torch.float16` 사용 (메모리 절약)
2. `low_cpu_mem_usage=True` 설정
3. 불필요한 프로세스 종료
4. 배치 처리 고려 (향후 확장)

## 🛡️ 보안

### 운영 환경 고려사항
- API 키 기반 인증 구현 권장
- HTTPS 사용
- 방화벽 설정
- 리소스 제한 설정

## 📞 지원

문제가 발생하면 다음을 확인하세요:
1. 로그 파일 (`logs/inference.log`)
2. 헬스체크 상태 (`/health`)
3. GPU 메모리 사용량
4. 모델 파일 존재 여부