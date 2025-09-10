# 💖 LLM (Love Language Model)  
**AI 인플루언서 연애 상담 스트리밍 플랫폼**

---

## 📌 목차
1. [프로젝트 개요 및 배경](#-프로젝트-개요-및-배경)  
2. [프로젝트 차별성](#-프로젝트-차별성)  
3. [시장 분석 및 수익화 전략](#-시장-분석-및-수익화-전략)  
4. [기술 스택](#-기술-스택)  
5. [데이터 전처리](#-데이터-전처리)  
6. [ERD & 아키텍처](#-erd--아키텍처)  
7. [모델 성능](#-모델-성능)  
8. [LangChain vs LangGraph](#-langchain-vs-langgraph)  
9. [서버 부하 테스트](#-서버-부하-테스트)  
10. [역할 분담](#-역할-분담)  
11. [참고 자료](#-참고-자료)  

---

## 📖 프로젝트 개요 및 배경  

### 1.1 프로젝트 개요
**LLM(Love Language Model)** 은 AI 인플루언서 캐릭터 중심의 맞춤형 연애 상담을 제공하여,  
양방향 소통·실시간 스트리밍·팬덤 형성을 통한 차별화된 경험을 제공한다.  

**특징**  
- 네 명의 성격·스타일이 뚜렷한 AI 인플루언서 제공  
- 동일 사연에도 각기 다른 반응과 언어 스타일  
- 팬덤 기반 IP 확장 및 수익화  

---

### 1.2.1 개인 미디어 시대, 스트리밍 플랫폼의 성장 
- 스마트폰 보급으로 개인 미디어 시대 본격화 → 유튜브는 TV를 넘어 대중의 주요 채널로 자리잡음  
- 한국 스마트폰 사용자 94%가 동영상 앱 이용, 사용시간 점유율 67.4%는 유튜브  
- 네이버 **치지직**: 2023년 말 첫선 → 1년 만에 월 250만 MAU, 파트너 스트리머 150명 확보  
- **SOOP** 또한 꾸준한 성장세 기록 → 평균·최고 시청자 수 모두 상승  

---

### 1.2.2 스트리머 형식의 가치 
- **실시간성**: 즉각적 대화와 정서적 유대감 형성  
- **몰입감**: 생동감 있는 현장감과 능동적 참여 구조  
- **커뮤니티 형성**: 시청자가 단순 소비자가 아닌 대화의 주체로 자리  

---

### 1.2.3 연애 도메인 
- 연애는 **시대·세대를 막론한 본질적 관심사**  
- 유튜브·스트리밍 플랫폼에서 연애 콘텐츠는 높은 시청률과 화제성 확보  
- **감정과 언어가 풍부한 도메인**으로 AI 학습·고도화에 적합  
- **보편성과 지속성** → 파생 콘텐츠(하이라이트·숏폼 등)로 확장 가능  

---

## 💡 프로젝트 차별성  

### 2.1 기존 연애 상담 서비스와의 비교  
- 심리 상담형: 전문성 높음, 그러나 접근성 낮고 비용 부담 큼  
- 콘텐츠 소비형: 접근성 높음, 그러나 일방향적이며 맞춤형 피드백 부족  

**👉 본 프로젝트 목표: 신뢰할 수 있는 디지털 연애 멘토 창조**  

**핵심 가치**  
1. 일관성 있는 상담 품질  
2. 지속가능한 운영 (감정 노동에서 자유)  
3. 공감 + 데이터 기반 분석 결합  
4. 스트리밍 포맷 (실시간 1:N 소통)  
5. 익명성 보장  

---

### 2.2 핵심 기능
1. **실시간성** – 웹소켓 기반 1:N 양방향 채팅  
2. **안정성** – Docker·AWS 기반 배포, 대규모 접속에도 안정적  
3. **개성화** – 페르소나별 말투·표현 반영, 몰입감 높은 경험  

---

## 📊 시장 분석 및 수익화 전략  

### 3.1 SWOT 분석  

| 강점(S) | 약점(W) |
|---------|---------|
| 맞춤형 AI 인플루언서 경험 | AI의 한계와 데이터·윤리 문제 |
| 높은 IP 확장성, 재생산성 | 유지·보수 비용 부담 |

| 기회(O) | 위협(T) |
|---------|---------|
| 연애·결혼 시장 잠재력 | 치열한 기존 경쟁자 존재 |
| 글로벌 진출·미디어 시너지 | 빠른 기술 변화에 대한 적응 필요 |

---

### 3.2 비즈니스 모델  
- 💸 **후원·프리미엄 구독** – 실시간 참여·후원 → 커뮤니티 강화  
- 📺 **광고** – 연애·라이프스타일 분야 브랜드 협업 광고  
- 🗂️ **DB/IP 사업** – 스트리밍 데이터 기반 파생 콘텐츠 제작  

---

## 🛠️ 기술 스택  

<p align="center">
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=Python&logoColor=white">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=JavaScript&logoColor=black">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=Docker&logoColor=white">
  <img src="https://img.shields.io/badge/Ubuntu-E95420?style=for-the-badge&logo=Ubuntu&logoColor=white">
  <img src="https://img.shields.io/badge/AWS EC2-FF9900?style=for-the-badge&logo=amazon-ec2&logoColor=white">
  <img src="https://img.shields.io/badge/AWS ElastiCache-FF4F8B?style=for-the-badge&logo=amazonaws&logoColor=white">
  <img src="https://img.shields.io/badge/AWS RDS-527FFF?style=for-the-badge&logo=amazon-rds&logoColor=white">
  <img src="https://img.shields.io/badge/AWS ELB-FF9900?style=for-the-badge&logo=awselasticloadbalancing&logoColor=white">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Nginx-009639?style=for-the-badge&logo=nginx&logoColor=white">
  <img src="https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=React&logoColor=black">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Django-092E20?style=for-the-badge&logo=django&logoColor=white">
  <img src="https://img.shields.io/badge/Django Channels-44B78B?style=for-the-badge&logo=django&logoColor=white">
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=PostgreSQL&logoColor=white">
  <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=Redis&logoColor=white">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/PyTorch-EE4C2C?style=for-the-badge&logo=PyTorch&logoColor=white">
  <img src="https://img.shields.io/badge/HuggingFace-FFB000?style=for-the-badge&logo=huggingface&logoColor=black">
  <img src="https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=OpenAI&logoColor=white">
  <img src="https://img.shields.io/badge/LangChain-00A98F?style=for-the-badge&logoColor=white">
  <img src="https://img.shields.io/badge/LangGraph-8A2BE2?style=for-the-badge&logoColor=white">
</p>

---

## 🗂️ 데이터 전처리  

- 유튜브 영상 → mp3 변환 → **faster-whisper** 전사  
- 스크립트 정제 (페르소나 외 대화 직접 수정·삭제)  
- QA 데이터셋 변환 (Few-shot Prompting 활용)  
- JSON 포맷 저장  

---

## 🗄️ ERD & 아키텍처  

![ERD](https://github.com/user-attachments/assets/2de4f245-a2b7-4080-96c1-ff07bdb633aa)  
![아키텍쳐](https://github.com/user-attachments/assets/bf9c1fff-3a84-43e5-aa87-092bb552a2d1)  

---

## 🤖 모델 성능  

- A.X 모델은 EXAONE 대비 **최대 5배 빠른 속도** 확보 (평균 3초 내외)  
- 성능·정확도는 유사 수준, 그러나 **실시간 상호작용 최적화**  
- 사용자 경험(즉시성·몰입감) 개선  

📊 세부 지표는 본문 표 참조  

---

## ⚡ LangChain vs LangGraph  

- 소규모 배치: LangChain 11.72s → LangGraph 9.35s  
- 미디엄 배치: LangChain 27.57s → LangGraph 20.50s  
- 대규모 배치: LangChain 49.63s → LangGraph 45.10s  
- **평균 18.3% 속도 개선**  

👉 **실시간 스트리밍 환경에서 응답성 강화, 대규모 운영 확장성 확보**  

---

## 🔥 서버 부하 테스트  
(추후 이미지 및 결과 삽입 예정)  

---

## 👥 역할 분담  

| 분야 | 담당자 |
|------|--------|
| AI (자연어) | 박현아, 장진슬 |
| AI (멀티모달) | 구재회 |
| Backend & Server | 모지호 |
| Frontend & Backend | 이재범 |

---

## 📚 참고 자료  
- [1] SBSNOW – AI 플러팅 스킬 사례  
- [2] 전자신문 – 생성형 AI 이용자 통계  
- [3] CBS News – 10대 AI 컴패니언 이용 현황  

---
