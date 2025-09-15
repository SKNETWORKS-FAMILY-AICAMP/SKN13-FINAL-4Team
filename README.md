# 💖 LLM (Love Language Model)
AI 인플루언서 연애 상담 스트리밍 플랫폼

---


## 📌 목차
1. [프로젝트 개요 및 배경](#1-프로젝트-개요-및-배경)
2. [프로젝트 차별성](#2-프로젝트-차별성)
3. [시장 분석 및 수익화 전략](#3-시장-분석-및-수익화-전략)
4. [기술 스택](#4-기술-스택)
5. [데이터 전처리](#5-데이터-전처리)
6. [ERD & 아키텍처](#6-erd--아키텍처)
7. [모델 성능](#7-모델-성능)
8. [LangChain vs LangGraph](#8-langchain-vs-langgraph)
9. [서버 부하 테스트](#9-서버-부하-테스트)
10. [역할 분담](#10-역할-분담)
11. [참고 자료](#11-참고-자료)


---

## 1) 프로젝트 개요 및 배경

### 1.1 프로젝트 개요
**LLM(Love Language Model)** 은 AI 인플루언서 캐릭터 중심의 맞춤형 연애 상담과 양방향 소통·실시간 스트리밍·팬덤 형성을 통한 차별화된 경험을 제공

**핵심 포인트**
- 4인 페르소나: 뚜렷한 성격/가치관/어조/금기어
- 상황 적응: 같은 사연에도 서로 다른 관점, 어휘, 톤으로 응답
- 라이브, 클립/숏폼 등 IP 확장을 통한 수익화 

---

### 1.2.1 개인 미디어 전환, 스트리밍의 부상
- 스마트폰 보급 이후 시청 중심은 TV에서 개인 미디어로 이동.(한국 스마트폰 사용자 중 94%가 동영상 앱을 이용, 유튜브가 압도적인 1위-사용시간 점유율 67.4%)
- 유튜브가 사용시간 점유율에서 1위를 장기 유지하고, 신흥 스트리밍(치지직, SOOP)의 빠른 성장과 시청자 수 확대, 경쟁력 강화 
**개인화·실시간·참여형** 포맷이 표준이 된다.
<img width="550" height="1024" alt="Image" src="https://github.com/user-attachments/assets/d15d44df-be53-4518-b5a2-6abf1916187d" />
<img width="550" height="369" alt="Image" src="https://github.com/user-attachments/assets/58f1be6e-0f62-4fda-8864-54b941d49da0" />

### 1.2.2 스트리머 포맷의 가치
- **실시간성** → 즉각 반응과 정서적 상호작용을 통한 유대감 형성
- **강한 몰입감** → 라이브 특유의 현장감, 시청자의 능동적 콘텐츠 참여, 채팅/후원/참여형 미션
- **커뮤니티 형성** → 스트리머와 시청자 간의 상호작용 속에서 공동체적 경험이 강화, 시청자가 단순한 수용자를 넘어 대화의 주체

### 1.2.3 연애 도메인
연애는 시대와 세대를 막론하고 변하지 않는 인간의 본질적인 관심사 
실제로 유튜브와 라이브 스트리밍 플랫폼에서 연애 콘텐츠는 유튜브/스트리밍에서 꾸준히 높은 시청률과 화제성을 보임

- **감정과 언어가 풍부한 도메인** → 감정·언어 자극이 풍부한 도메인이라 **자연어 처리·공감형 응답** 발전에 유리
- **주제의 보편성과 지속성** → 연애는 시대와 세대를 막론하고 꾸준히 회자되는 주제로, 콘텐츠 생산의 지속 가능성이 높음
- **2차 콘텐츠로 확장** → 상담 클립, 하이라이트, 숏폼 등 다양한 형태의 파생 콘텐츠 제작이 가능해 서비스 확장성과 활용성이 큼 

> MZ 세대의 관심사, AI 기술 발전의 학습 가치, 콘텐츠 산업적 확장성이라는 세 가지 측면에서 모두 전략적 타당성 有

---

## 2) 프로젝트 차별성

### 2.1 기존 서비스와의 대비
- 심리상담형: 전문성 높음 / 접근성 낮음 / 비용 부담 큼
- 소비형 콘텐츠: 접근성 높음 / 일방향 / 맞춤 피드백 부족

LLM은 두 영역의 장점을 묶는다. **맞춤 대화의 전문성**과 **스트리밍의 즉시성/참여성**을 결합

**핵심 가치**
1. 일관 품질: 감정 기복 없이 일정한 상담 품질 유지
2. 지속 운영: 감정노동/악성댓글로부터 자유, 무한 확장을 통한 경제성 창출 
3. 재미+분석: 다양한 톤과 데이터 기반 해결책을 동시 제공
4. 스트리밍 포맷: 실시간 1:N 소통, 참여 중심 커뮤니티 형성
5. 익명성: 깊은 고민을 안전하게 공유 가능한 환경

### 2.2 핵심 기능
1) **실시간성·개성화**
- 웹소켓 기반 1:N 양방향 채팅
- 일방향 상담이 아닌, 실시간 시청자 참여와 반응
- 페르소나별 말투/화법/비언어 신호 구현 → 실제 대화 같은 몰입

2) **안정 배포·환경 설정**
- Docker + AWS 인프라, 자동화 배포 파이프라인
- 고접속 상황에서도 끊김 없는 상담 

3) **콘텐츠 전환**
- 라이브 로그 → 클립/숏폼/리뷰/하이라이트로 자동 전환
- IP/콜라보 확장 전제

**기대 효과**
- 시장성: 연애 리얼리티/상담 장르의 검증된 수요 흡수
- 수익화: 후원·프리미엄·광고·2차 제작으로 다변화
- 글로벌: 다국어 전개로 확장 

---

## 3) 시장 분석 및 수익화 전략

### 3.1 SWOT
| 구분 | 요약 |
|---|---|
| S | 맞춤형 AI 인플루언서 경험, 콘텐츠의 재생산성과 IP 확장성 높아 2차 제작/브랜드 확장성 |
| W | AI 한계·윤리/데이터 이슈, 유지보수 비용 지속 발생 |
| O | 연애·결혼 시장 잠재력, AI 발전에 따른 새로운 가치 창출 가능, 글로벌·미디어 시너지 |
| T | 치열한 경쟁, 기술 변화 속도에 대한 대응 리스크 |

### 3.2 비즈니스 모델
- **후원·프리미엄**: 실시간 공감/도움에 즉시 후원. 커뮤니티 결속 강화
- **광고**: 다양한 브랜드와의 협업을 통해 안정적인 광고 매출. 연애·라이프스타일과 관련된 제품·서비스와의 높은 적합성을 바탕으로 맞춤형 광고 집행
- **DB/IP**: 상담 로그 기반 2차 제작(클립/숏폼/큐레이션) → 조회/매출·IP 가치 누적

다각화된 구조는 단기 매출과 장기 자산(IP/커뮤니티)을 동시에 꾀함

---

## 4) 기술 스택

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

- 언어: Python, JavaScript  
- 프레임워크: Django(웹/어드민), Django Channels(Daphne, 웹소켓), FastAPI(LLM 서버)  
- 프론트: React  
- 인프라: Docker, Ubuntu, AWS(EC2/ElastiCache/RDS/ELB), Nginx  
- 데이터베이스/캐시: PostgreSQL, Redis  
- AI/ML: PyTorch, HuggingFace, OpenAI, LangChain, LangGraph

---

## 5) 데이터 전처리

### 5.1 데이터셋 개요
유튜브 연애 상담 영상 크롤링 → mp3 등 음성 변환 → `faster-whisper`로 자동 전사 → 텍스트 스크립트 확보

### 5.2 프로세스
1. 영상 수집/변환
2. `faster-whisper` 전사
3. 스크립트 정제: 페르소나 외 화자 등장 구간을 **직접 검토**하며 수정·삭제
4. 페르소나 말투/화법 정의 → Few-shot Prompting으로 QA 데이터셋 변환

### 5.3 이상치 처리
- 기준: 페르소나 외 인물 등장
- 방식: 전량 삭제가 아니라 **문장 단위로 수작업 정제**
- 효과: 톤앤매너 일관성 강화, 파인튜닝 노이즈 최소화

### 5.4 표준화
- sLLM 파인튜닝용 QA 구조로 변환  
  - Q: 전사 스크립트 기반, 시청자 관점에서 자연스러운 질문  
  - A: 페르소나 톤/화법을 반영한 응답  
- 사용 라이브러리 예: `openai`, 에러 핸들링용 `json.JSONDecodeError`

### 5.5 산출
- 최종 데이터셋: `.json` 저장 (학습/검증/추가 생성에 재사용)

---

## 6) ERD & 아키텍처
![ERD](https://github.com/user-attachments/assets/2de4f245-a2b7-4080-96c1-ff07bdb633aa)
![아키텍처](https://github.com/user-attachments/assets/bf9c1fff-3a84-43e5-aa87-092bb552a2d1)
<!-- 아키텍처 다이어그램: 클라이언트 ↔ Nginx ↔ Django/Channels & FastAPI ↔ PostgreSQL/Redis -->

---

## 7) 모델 성능

### 7.1 해석
평가 지표: ROUGE-Lsum, BERT F1, GPT Score, Time.  
A.X는 정확도 지표에서 타 모델과 근접하거나 유사한 수준을 유지하면서, **응답 시간(평균 ~3초 내외)** 에서 두드러진 우위
- 실시간 스트리밍 특성상 속도는 사용 경험을 좌우
- 즉시성은 몰입/체류/후원 전환에 직결

### 7.2 페르소나별 세부 성능
#### (1) 페르소나 1 - 홍세현
| 모델 | ROUGE-Lsum | BERT F1 | GPT Score | Time |
|---|---:|---:|---:|---:|
| **A.X** | 0.0444 | 0.7101 | 3.17 | 3.98 |
| LLaMA | 0.0444 | 0.7101 | 3.17 | 5.92 |
| SOLAR | 0.0500 | 0.7005 | 2.80 | 28.58 |
| EXAONE | 0.0356 | 0.7243 | 3.30 | 15.06 |

#### (2) 페르소나 2 — 오율
| 모델 | ROUGE-Lsum | BERT F1 | GPT Score | Time |
|---|---:|---:|---:|---:|
| **A.X** | 0.0333 | 0.7003 | 3.73 | 2.97 |
| LLaMA | 0.0000 | 0.7016 | 2.00 | 2.93 |
| SOLAR | 0.0000 | 0.6990 | 2.07 | 8.42 |
| EXAONE | 0.0000 | 0.7035 | 2.13 | 11.13 |

#### (3) 페르소나 3 — 김춘기
| 모델 | ROUGE-Lsum | BERT F1 | GPT Score | Time |
|---|---:|---:|---:|---:|
| **A.X** | 0.0639 | 0.6707 | 2.70 | 3.92 |
| LLaMA | 0.0000 | 0.6236 | 1.03 | 1.65 |
| SOLAR | 0.0315 | 0.6985 | 2.07 | 13.70 |
| EXAONE | 0.0111 | 0.6470 | 1.20 | 10.10 |

#### (4) 페르소나 4 — 강시현
| 모델 | ROUGE-Lsum | BERT F1 | GPT Score | Time |
|---|---:|---:|---:|---:|
| **A.X** | 0.0000 | 0.7183 | 2.00 | 2.72 |
| LLaMA | 0.0000 | 0.7108 | 2.07 | 2.58 |
| SOLAR | 0.0000 | 0.7121 | 2.13 | 7.25 |
| EXAONE | 0.0000 | 0.7200 | 3.17 | 10.35 |

 
A.X = 정확도 유사 수준 + **속도 우위** → 스트리밍 상담에 최적

---

## 8) LangChain vs LangGraph

같은 조건에서 LangGraph가 모든 배치 크기에서 더 빠르게 응답
- 3×3 메시지: LangChain 11.72s → LangGraph 9.35s  
- 7×2 메시지: LangChain 27.57s → LangGraph 20.50s  
- 15×1 메시지: LangChain 49.63s → LangGraph 45.10s  
평균 **18.3% 속도 개선**
>>**실시간 반응성**을 확보하려면 LangGraph 선택이 합리적


---

## 9) 서버 부하 테스트
![서버부하테스트1](https://github.com/user-attachments/assets/cc7299e7-3aa9-4168-9105-67a490c72e03)
### 9.1 부하 테스트 (Locust)

테스트 조건: 동시 접속 사용자 120명, 분당 25명씩 서버에 투입, 점진적 증가 시나리오

TPS(Total Requests per Second): 초당 최대 30 RPS 유지

응답 시간: 평균 2~3초, 피크 시 6~8초까지 상승

에러율: 동시접속 100명 지점부터 요청 실패율 급격 상승 → 리소스 한계 구간 도달 확인

➡ 결론: 100명 까지 동시 사용자까지 안정적 처리 가능, 100명 이상 구간에서 에러율 상승 → 추후 쿼리와 인덱스 시스템 개선 필요


![서버부하테스트2](https://github.com/user-attachments/assets/3a97fd2d-3c6e-43e7-8e2f-fdc399cacca3)

![서버부하테스트3](https://github.com/user-attachments/assets/dce0dd61-ae9f-49c6-bc5a-427d9ae1818a)

### 9.2 AWS 모니터링 결과 (CloudWatch)

EC2 인스턴스 타입: t3.small

CPU 사용률: 최대 77.3%까지 상승

네트워크 I/O: 입력 약 33MB, 출력 약 20MB

DB 연결 수: 최대 30개 이상 증가 → 순간 부하 발생

Redis·RDS 부하: CPU 및 I/O 사용량 급등 패턴 확인


### 9.3 시사점

안정성: 중간 규모 트래픽까지는 무리 없이 대응 가능

확장성: 실시간 스트리밍 특성상, 갑작스러운 사용자 증가에 대비한 수평 확장(Auto Scaling) 필수

DB 최적화: 연결 풀 관리 및 캐시 최적화를 통해 병목 완화 가능


---

## 10) 역할 분담
| 분야 | 담당자 |
|---|---|
| AI(자연어) | 박현아, 장진슬 |
| AI(멀티모달) | 구재회 |
| Backend & Server | 모지호 |
| Frontend & Backend | 이재범 |

---

## 11) 참고 자료
- SBSNOW – AI 플러팅 스킬 사례
- 전자신문 – 생성형 AI 이용자 통계
- CBS News – 10대 AI 컴패니언 이용 현황
