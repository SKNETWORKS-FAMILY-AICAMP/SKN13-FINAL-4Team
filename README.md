# 🧠 Influencer AI App

AI 인플루언서가 사용자의 요청에 따라 상품을 추천하고, 음성·영상으로 소개하는 서비스입니다.

---

## 📁 프로젝트 구조

- `frontend/` – React 기반 웹 프론트엔드
- `backend/` – Django 기반 API 서버
- `docker-compose.yml` – 개발환경용 통합 실행 파일

---

## 🧰 사전 설치

- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- Git

---

## ⚙️ 실행 방법 (로컬 개발 환경)

1. 이 저장소를 클론합니다.

```bash
git clone https://github.com/your-org/influencer-backend.git
cd influencer-backend
.env 파일 생성

bash
cp .env.example .env
도커 실행 확인

bash
docker --version
실행

bash
docker-compose up --build
🚪 접속 정보
서비스	주소
Backend API	http://localhost:8000
Frontend UI	http://localhost:3000
Django Admin	http://localhost:8000/admin

🧑‍💻 관리자 계정 만들기 (선택)
bash
docker-compose exec backend python manage.py createsuperuser
🧪 테스트
bash
# 백엔드 유닛 테스트
docker-compose exec backend python manage.py test
🔐 환경 변수 (.env 설정)
.env 파일을 .env.example 참고해서 만들어주세요.
