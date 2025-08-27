#!/bin/bash
# MeloTTS 설치 스크립트
# Docker 컨테이너 내부 또는 로컬 환경에서 실행

echo "=========================================="
echo "MeloTTS 설치를 시작합니다..."
echo "=========================================="

# MeloTTS 설치 (GitHub에서 직접)
echo "1. MeloTTS 패키지 설치 중..."
pip install git+https://github.com/myshell-ai/MeloTTS.git

# 설치 확인
if python -c "import melo" 2>/dev/null; then
    echo "✅ MeloTTS가 성공적으로 설치되었습니다!"
    
    # 모델 다운로드 시작 (선택사항)
    echo ""
    echo "2. 언어 모델 다운로드 (첫 사용시 자동으로 다운로드됩니다)"
    echo "   - 한국어 모델: 자동 다운로드"
    echo "   - 영어 모델: 자동 다운로드"
    echo ""
    
    # 간단한 테스트
    echo "3. MeloTTS 테스트 중..."
    python -c "
from melo.api import TTS
print('MeloTTS 라이브러리 로드 성공!')
print('사용 가능한 언어: EN, KR, ZH, JP, ES, FR')
"
    
    echo ""
    echo "=========================================="
    echo "✅ MeloTTS 설치가 완료되었습니다!"
    echo "이제 챗봇에서 MeloTTS를 선택할 수 있습니다."
    echo "=========================================="
else
    echo "❌ MeloTTS 설치에 실패했습니다."
    echo "다음 명령어를 직접 실행해보세요:"
    echo "pip install git+https://github.com/myshell-ai/MeloTTS.git"
fi