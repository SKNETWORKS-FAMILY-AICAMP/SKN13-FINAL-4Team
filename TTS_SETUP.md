# TTS 엔진 설정 가이드

## 개요
이 프로젝트는 3가지 TTS 엔진을 지원합니다:
- **OpenAI TTS**: 고품질, 안정적 (기본값)
- **MeloTTS**: 실시간 스트리밍 지원
- **Coqui TTS**: 오픈소스, 커스터마이징 가능

## 1. OpenAI TTS 설정

### 필요사항
- OpenAI API 키

### 설정 방법
1. `.env.local` 파일 생성
```bash
REACT_APP_OPENAI_API_KEY=your_openai_api_key_here
```

## 2. MeloTTS 설정

### 필요사항
- Python 3.8+
- MeloTTS 라이브러리

### 설치 방법
```bash
# MeloTTS 설치
pip install melo-tts

# WebSocket 서버용 라이브러리
pip install websockets asyncio
```

### 서버 실행
```python
# melotts_server.py
import asyncio
import websockets
import json
from melo.api import TTS

async def handle_tts_request(websocket, path):
    tts_model = TTS(language='ko')
    
    async for message in websocket:
        try:
            data = json.loads(message)
            text = data.get('text', '')
            voice = data.get('voice', 'default')
            speed = data.get('speed', 1.0)
            
            # TTS 생성
            audio_data = tts_model.tts_to_bytes(text, voice, speed)
            
            # 오디오 데이터 전송
            await websocket.send(audio_data)
            
        except Exception as e:
            await websocket.send(json.dumps({"error": str(e)}))

# 서버 시작
start_server = websockets.serve(handle_tts_request, "localhost", 8765)
asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
```

```bash
# 서버 실행
python melotts_server.py
```

## 3. Coqui TTS 설정

### 필요사항
- Python 3.8+
- Coqui TTS 라이브러리

### 설치 방법
```bash
# Coqui TTS 설치
pip install TTS

# Flask 서버용
pip install flask flask-cors
```

### 서버 실행
```python
# coqui_server.py
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
from TTS.api import TTS
import io
import base64

app = Flask(__name__)
CORS(app)

# TTS 모델 초기화
tts = TTS("tts_models/ko/css10/vits")

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"})

@app.route('/api/models', methods=['GET'])
def get_models():
    return jsonify({"models": tts.list_models()})

@app.route('/api/tts', methods=['POST'])
def generate_tts():
    data = request.json
    text = data.get('text', '')
    model_name = data.get('model_name', 'tts_models/ko/css10/vits')
    speaker_idx = data.get('speaker_idx', 0)
    speed = data.get('speed', 1.0)
    
    try:
        # TTS 생성
        wav = tts.tts(text=text, speaker=speaker_idx, speed=speed)
        
        # WAV 데이터를 바이트로 변환
        audio_buffer = io.BytesIO()
        # WAV 데이터 저장 로직 구현
        
        return Response(
            audio_buffer.getvalue(),
            mimetype='audio/wav'
        )
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/tts-stream', methods=['POST'])
def generate_streaming_tts():
    data = request.json
    text = data.get('text', '')
    
    def generate():
        try:
            # 청크 단위로 TTS 생성 및 스트리밍
            chunks = text.split('.')
            for chunk in chunks:
                if chunk.strip():
                    wav = tts.tts(text=chunk.strip())
                    # WAV 데이터를 청크로 전송
                    yield wav.tobytes()
        except Exception as e:
            yield json.dumps({"error": str(e)}).encode()
    
    return Response(
        stream_with_context(generate()),
        mimetype='audio/wav'
    )

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=True)
```

```bash
# 서버 실행
python coqui_server.py
```

## 4. 환경 변수 설정

`.env.local` 파일에 모든 TTS 서버 URL을 설정:

```bash
# OpenAI TTS
REACT_APP_OPENAI_API_KEY=your_openai_api_key_here

# MeloTTS WebSocket 서버
REACT_APP_MELOTTS_SERVER_URL=ws://localhost:8765

# Coqui TTS HTTP 서버
REACT_APP_COQUI_SERVER_URL=http://localhost:5002
```

## 5. 사용 방법

1. 프론트엔드 애플리케이션 실행
```bash
npm start
```

2. 설정 패널에서 TTS 엔진 선택
3. 각 엔진의 상태 확인 버튼으로 연결 상태 점검
4. 음성 설정 및 테스트

## 6. 트러블슈팅

### OpenAI TTS
- API 키가 올바른지 확인
- 사용량 한도 확인

### MeloTTS
- WebSocket 서버가 실행 중인지 확인
- 포트 8765가 사용 가능한지 확인
- 방화벽 설정 확인

### Coqui TTS
- HTTP 서버가 실행 중인지 확인
- 포트 5002가 사용 가능한지 확인
- 모델 다운로드가 완료되었는지 확인

## 7. 성능 최적화

### MeloTTS 최적화
- GPU 사용 활성화
- 모델 캐싱
- 청크 크기 조정

### Coqui TTS 최적화
- 더 빠른 모델 사용
- 스트리밍 청크 크기 조정
- 서버 캐싱 구현