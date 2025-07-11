# Dockerfile (backend)

# 1. Python 기반 이미지 선택
FROM python:3.10-slim

# 2. 환경변수 설정
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 3. 작업 디렉토리 설정
WORKDIR /app

# 4. 의존성 파일 복사 후 설치
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

# 5. 모든 프로젝트 소스 복사
COPY . .

# 6. Gunicorn으로 Django 실행 (프로젝트 이름에 맞게!)
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "config.wsgi:application"]
