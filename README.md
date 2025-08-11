# LLM (Love Language Model)  
**AI 인플루언서 연애 상담 스트리밍 플랫폼**  

---

## 1. 개요  

### 1.1 프로젝트 배경 및 필요성  
연애는 시대와 세대를 막론하고 변하지 않는 인간의 본질적인 관심사입니다. 기존 연애 서비스는 **심리 상담** 중심(전문성 높음·접근성 낮음·비용 부담) 또는 **콘텐츠 소비** 중심(일방향·맞춤 피드백 부족)에 치우쳐 있습니다.  
**LLM(Love Language Model)** 은 AI 인플루언서 캐릭터 중심의 맞춤형 연애 상담을 제공하여, 양방향 소통·실시간 스트리밍·팬덤 형성을 통한 차별화된 경험을 제공합니다.  

특징:  
- 네 명의 성격·스타일이 뚜렷한 AI 인플루언서 제공  
- 동일 사연에도 각기 다른 반응과 언어 스타일  
- 팬덤 기반 IP 확장 및 수익화  

---

## 2. 프로젝트 목표
- **목표**: 현대인의 외로움·관계 고민 해결, 신뢰할 수 있는 디지털 연애 멘토 창조  

핵심 가치:  
1. **일관성 있는 상담 품질** – AI는 감정 기복 없이 항상 일정 품질 유지  
2. **지속가능한 운영** – 악성 댓글 등 감정 노동에서 자유  
3. **공감+분석 결합** – 따뜻한 공감과 데이터 기반 해결책 동시 제공  
4. **스트리밍 포맷** – 실시간 1:N 소통·참여 중심 커뮤니티 형성  
5. **익명성 보장** – 깊은 고민도 안전하게 공유 가능  


### 2.1 기대 효과  
- **시장성**: 연애 리얼리티·상담 콘텐츠 인기 입증  
- **수익화**: 프리미엄 상담, 후원 채팅, 2차 콘텐츠 제작(IP 확장)  
- **글로벌 진출**: 다국어 서비스로 전 세계 시장 공략  

---

## 3. 시장 분석 및 수익화 전략  

### 3.1 시장 현황  
- **연애 콘텐츠 인기 지속** (<솔로지옥>, <환승연애>, <나는솔로> 등)  
- **감정 기반 AI 수요 증가** – 챗봇을 넘어 정서적 지지 역할 확산


### 3.2 SWOT 분석  

| 구분 | 내용 |
|------|------|
| **S (강점)** | AI 캐릭터 기반 몰입형 상담, IP 확장 용이성, 데이터 기반 피드백 |
| **W (약점)** | 감정 이해 한계, 데이터 편향·윤리 문제, 개발·운영 비용 |
| **O (기회)** | 연애·결혼 시장 성장, AI 기술 발전, 글로벌 진출, 미디어 시너지 |
| **T (위협)** | 경쟁 심화, 기술 변화 적응 실패 위험 |


### 3.3 Business Model  
- **후원·프리미엄 구독** – 후원자 우선 반응·혜택 제공  
- **광고** – PPL·배너·감정 기반 타겟 광고  
- **DB/IP 사업** – 인기 사연 기반 웹툰·웹드라마·영상 채널  

---

## 4. 기술 스택

프로그래밍 언어 - Python, JavaScript   
개발 환경 - docker, ubuntu linux, AWS EC2, AWS ElastiCache, AWS RDS, AWS ELB   
웹서버 - Nginx   
프론트 - React   
웹소켓 - Django Channel(Daphne)   
서버 framework - Django   
LLM서버 framework - FastAPI   
DB - postgreSQL , redis   
AI/ML - Pytorch HuggingFace OpenAI Langchain Langgraph   

---

## 5. 데이터 전처리 

### 5.1 데이터셋 개요  

- **데이터 출처 및 수집 방법**:  
  - 유튜버 영상 다수 수집 → mp3 등 음성 파일 변환  
  - `faster-whisper` 라이브러리를 사용하여 자동 전사  

### 5.2 전처리 프로세스 개요  

1. 선정한 유튜버 영상 크롤링 → 음성 파일 변환  
2. 변환한 음성을 `faster-whisper`로 스크립트 전사  
3. 페르소나 외 인물 등장 시 해당 스크립트 삭제  
4. 페르소나 말투·화법 정의 → Few-shot Prompting으로 QA 데이터셋 변환

### 5.3 이상치 처리  
- **기준**: 페르소나 외 인물이 등장하는 영상  
- **처리 방식**:  
  - 화자가 혼재된 스크립트는 전량 삭제  
  - 단일 페르소나의 말투만 유지  
- **영향**:  
  - 학습 데이터의 톤앤매너 일관성 강화  
  - sLLM 파인튜닝 시 노이즈 최소화  

### 5.4 표준화  
- 텍스트 파일을 sLLM fine-tuning용 QA 데이터셋으로 변환  
- 각 스크립트를 GPT-4.1에 예시로 제공하여 Few-shot Prompting  
- **QA 구조**:  
  - **Q**: 스크립트를 기반으로 시청자가 할 법한 질문  
  - **A**: 스트리머가 톤앤매너를 반영해 답변  

- **사용 라이브러리**: `json.JSONDecodeError`, `openai`  

### 5.5 데이터 변환 및 생성  
- 최종 데이터셋은 `.json` 형식으로 저장  

---

## 6. ERD, 아키텍처

![ERD](https://private-user-images.githubusercontent.com/144427467/476421154-e3763a66-c994-4fd1-9e44-c04616180f11.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NTQ4ODQ5MDMsIm5iZiI6MTc1NDg4NDYwMywicGF0aCI6Ii8xNDQ0Mjc0NjcvNDc2NDIxMTU0LWUzNzYzYTY2LWM5OTQtNGZkMS05ZTQ0LWMwNDYxNjE4MGYxMS5wbmc_WC1BbXotQWxnb3JpdGhtPUFXUzQtSE1BQy1TSEEyNTYmWC1BbXotQ3JlZGVudGlhbD1BS0lBVkNPRFlMU0E1M1BRSzRaQSUyRjIwMjUwODExJTJGdXMtZWFzdC0xJTJGczMlMkZhd3M0X3JlcXVlc3QmWC1BbXotRGF0ZT0yMDI1MDgxMVQwMzU2NDNaJlgtQW16LUV4cGlyZXM9MzAwJlgtQW16LVNpZ25hdHVyZT05MWQ5NTZmZTNiODNhM2Q4ZmZjNGFiOGYyYmY0ZGExNjQzODZmYzM4M2M3MDM2OTBiNDNhN2U4MjhiNTU2ZWRhJlgtQW16LVNpZ25lZEhlYWRlcnM9aG9zdCJ9.Vg7eMQGWzV5wfhcdgSWhIYEf__AFTex1WdLmcIGdODQ)
![아키텍쳐](https://private-user-images.githubusercontent.com/144427467/476420891-dcfe99b2-789c-4931-8b1d-bfb2c17b91d4.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NTQ4ODQ4ODIsIm5iZiI6MTc1NDg4NDU4MiwicGF0aCI6Ii8xNDQ0Mjc0NjcvNDc2NDIwODkxLWRjZmU5OWIyLTc4OWMtNDkzMS04YjFkLWJmYjJjMTdiOTFkNC5wbmc_WC1BbXotQWxnb3JpdGhtPUFXUzQtSE1BQy1TSEEyNTYmWC1BbXotQ3JlZGVudGlhbD1BS0lBVkNPRFlMU0E1M1BRSzRaQSUyRjIwMjUwODExJTJGdXMtZWFzdC0xJTJGczMlMkZhd3M0X3JlcXVlc3QmWC1BbXotRGF0ZT0yMDI1MDgxMVQwMzU2MjJaJlgtQW16LUV4cGlyZXM9MzAwJlgtQW16LVNpZ25hdHVyZT03Y2QzYWFkOTNjZWY4ZjIwZTRhNTJjOTQxNzBmMWEyODgyYjVmZmQ1NWZhNWIzYzMzMWMzZWRlYWFjNzYxODY1JlgtQW16LVNpZ25lZEhlYWRlcnM9aG9zdCJ9.rFotEE4-BIFmcOBxPiiaTPAgSdjHOhyo-1ht86tbF98)

---

## 7. 모델


### 7.1 페르소나별 세부 성능 비교

#### (1) 페르소나 1 – 홍차

| 모델 | ROUGE-1 | ROUGE-2 | ROUGE-L | ROUGE-Lsum | BERT Precision | BERT Recall | BERT F1 | GPT Score |
|------|---------|---------|---------|------------|----------------|-------------|---------|-----------|
| **LLaMA** | 0.0333 | 0.0067 | 0.0333 | 0.0444 | 0.7296 | 0.6917 | 0.7101 | 3.17 |
| SOLAR | 0.0500 | 0.0067 | 0.0500 | 0.0500 | 0.7257 | 0.6771 | 0.7005 | 2.80 |
| EXAONE | 0.0356 | 0.0000 | 0.0356 | 0.0356 | 0.7386 | 0.7107 | 0.7243 | 3.30 |


#### (2) 페르소나 2 – 오마르

| 모델 | ROUGE-1 | ROUGE-2 | ROUGE-L | ROUGE-Lsum | BERT Precision | BERT Recall | BERT F1 | GPT Score |
|------|---------|---------|---------|------------|----------------|-------------|---------|-----------|
| **LLaMA** | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.7226 | 0.6820 | 0.7016 | 2.00 |
| SOLAR | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.7210 | 0.6785 | 0.6990 | 2.07 |
| EXAONE | 0.0333 | 0.0000 | 0.0333 | 0.0333 | 0.7204 | 0.6876 | 0.7035 | 2.13 |

#### (3) 페르소나 3 – 김달

| 모델 | ROUGE-1 | ROUGE-2 | ROUGE-L | ROUGE-Lsum | BERT Precision | BERT Recall | BERT F1 | GPT Score |
|------|---------|---------|---------|------------|----------------|-------------|---------|-----------|
| LLaMA | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.6570 | 0.6100 | 0.6326 | 1.03 |
| **SOLAR** | 0.0315 | 0.0211 | 0.0304 | 0.0315 | 0.7027 | 0.6945 | 0.6985 | 2.07 |
| EXAONE | 0.0111 | 0.0067 | 0.0111 | 0.0111 | 0.6689 | 0.6267 | 0.6470 | 1.20 |


#### (4) 페르소나 4 – 슈히

| 모델 | ROUGE-1 | ROUGE-2 | ROUGE-L | ROUGE-Lsum | BERT Precision | BERT Recall | BERT F1 | GPT Score |
|------|---------|---------|---------|------------|----------------|-------------|---------|-----------|
| LLaMA | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.7279 | 0.6946 | 0.7108 | 2.00 |
| **SOLAR** | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.7291 | 0.6959 | 0.7121 | 2.07 |
| EXAONE | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.7360 | 0.7049 | 0.7200 | 2.13 |

### 7.2 페르소나별 최종 선정

**페르소나1 (홍차)** – LLaMA  
- ROUGE, BERTScore, GPT Score 모두 균형 잡힌 성능

**페르소나2 (오마르)** – LLaMA  
- 성능 차이 미미하나, 응답 속도 우수

**페르소나3 (김달)** – SOLAR  
- 어휘 재현 및 내면 요소 반영 모두 우수

**페르소나4 (슈히)** – SOLAR  
- EXAONE보다 빠른 속도, 유사 성능 확보

---

## 8. 역할 분담  

| 분야 | 담당자 |
|------|--------|
| AI(자연어) | 박현아, 장진슬 |
| AI(멀티모달) | 구재회 |
| Backend & Server | 모지호 |
| Frontend & Backend | 이재범 |

---

## 9. 참고 자료  
- [1] SBSNOW – AI 플러팅 스킬 사례  
- [2] 전자신문 – 생성형 AI 이용자 통계  
- [3] CBS News – 10대 AI 컴패니언 이용 현황  
