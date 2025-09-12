# 1. Python 기반 이미지 선택
FROM python:3.10

# 2. 환경변수 설정
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 3. 작업 디렉토리 설정 (오타 수정)
WORKDIR /app

# 3.5. 오디오 처리를 위한 시스템 패키지 설치
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

# 4. 의존성 파일 복사 후 설치
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

# 5. 설치 확인 (django-redis 특별 확인)
RUN python -c "import django_redis; print('django-redis installed successfully')"

# 6. 모든 프로젝트 소스 복사
COPY . .

# 7. Daphne로 Django Channels 실행
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "config.asgi:application"]