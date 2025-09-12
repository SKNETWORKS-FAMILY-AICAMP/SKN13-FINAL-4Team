# app.py — 실시간 라디오 사연 자동생성(60초) + DB 저장 + API
# ------------------------------------------------------------
# 설치:
#   pip install fastapi uvicorn "sqlalchemy>=2" openai-python python-dotenv
# 실행:
#   export OPENAI_API_KEY="sk-..."   # 또는 .env 파일에 OPENAI_API_KEY=...
#   uvicorn app:app --reload --port 8000
#
# API:
#   GET  /health                      # 헬스 체크
#   GET  /stories?limit=20            # 최근 목록
#   POST /stories                     # { "theme": "...", "seeds": ["..."] }
#   POST /control/pause | /control/resume

import os, re, json, time, hashlib, threading, queue, datetime, random, traceback
from typing import List, Optional, Dict, Any
from dataclasses import dataclass

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, text as sqltext
from sqlalchemy.orm import sessionmaker
from openai import OpenAI

# ========================
# 환경설정 & DB
# ========================
load_dotenv()
DB_URL = os.getenv("DB_URL", "sqlite:///./radio_stories.db")
engine = create_engine(
    DB_URL,
    echo=False,
    future=True,
    connect_args={"check_same_thread": False} if DB_URL.startswith("sqlite") else {}
)
SessionLocal = sessionmaker(engine, expire_on_commit=False, future=True)
DDL = """
CREATE TABLE IF NOT EXISTS stories(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  theme TEXT NOT NULL,
  seeds TEXT NOT NULL,             -- JSON 문자열
  text  TEXT NOT NULL,
  duration_sec REAL NOT NULL,
  source TEXT NOT NULL,            -- 'auto' | 'manual'
  created_at TEXT NOT NULL,        -- ISO8601
  hash TEXT NOT NULL UNIQUE        -- 중복 방지
);
"""
with engine.begin() as conn:
    conn.exec_driver_sql(DDL)

# ========================
# OpenAI Client (Lazy Singleton + Retry)
# ========================
_client_lock = threading.Lock()
_client: Optional[OpenAI] = None

def get_client() -> OpenAI:
    global _client
    if _client is None:
        with _client_lock:
            if _client is None:
                api_key = os.getenv("OPENAI_API_KEY")
                if not api_key:
                    raise RuntimeError("OPENAI_API_KEY 환경변수가 필요합니다.")
                _client = OpenAI(api_key=api_key)
    return _client

def ask(model: str, system: str, user: str, temperature: float, retries: int = 3) -> str:
    """OpenAI Chat Completions with simple retry/backoff"""
    last_err = None
    for i in range(retries):
        try:
            client = get_client()
            r = client.chat.completions.create(
                model=model,
                temperature=temperature,
                messages=[{"role": "system", "content": system},
                          {"role": "user", "content": user}],
            )
            return r.choices[0].message.content.strip()
        except Exception as e:
            last_err = e
            time.sleep(0.6 * (i + 1))
    raise last_err

# ========================
# 가드/유틸 (60초 모드)
# ========================
BLOCKLIST = [
    r"자살|자해|극단적|폭력",
    r"약물\s*제조|폭탄|무기",
    r"진단|처방전",
    r"확실한\s*수익|보장된\s*투자",
    r"개인정보\s*요청",
    r"해킹|스토킹|살인|범죄",
]
TARGET_MIN, TARGET_MAX = 53, 66  # ★ 60초 모드 기준

def estimate_korean_read_sec(text: str) -> float:
    core = re.findall(r"[가-힣A-Za-z0-9]", text)  # 공백/기호 제외
    return round(len(core)/8.5, 1)  # 평균 8.5자/초

def violates_blocklist(text: str) -> bool:
    return any(re.search(p, text) for p in BLOCKLIST)

def story_hash(theme: str, seeds: List[str], text: str) -> str:
    h = hashlib.sha256()
    h.update(theme.encode("utf-8"))
    h.update(("|".join(seeds)).encode("utf-8"))
    h.update(text.encode("utf-8"))
    return h.hexdigest()

# ========================
# 프롬프트 (60초)
# ========================
PLANNER_SYS = """너는 연애 스트리머 DJ 방송의 플래너다.
출력은 JSON만 반환한다. 설명문 금지. 60초 독백에 맞춘 구조로 기획하라.
"""
PLANNER_USER_TMPL = """
[ROLE] 60초 라디오 사연 방송 기획자
[PERSONA] 따뜻하고 차분한 1인칭
[THEME] {theme}
[SEEDS] {seeds}
[OUTPUT JSON SCHEMA]
{{
  "opening": {{"hook":"한 문장","tease":"한 문장"}},
  "letter":  {{"summary":"사연 1~2문장","empathy":"공감 한 문장","remedy":"한 줄 처방"}},
  "cta":     {{"line":"참여 유도 한 문장"}},
  "closing": {{"line":"엔딩 한 문장"}}
}}
"""
WRITER_SYS = """너는 연애 스트리머 대본 작가다.
- 1인칭 DJ 독백 한 덩어리, 구어체/호흡 자연스럽게.
- 오프닝→사연요약→공감→한줄처방→콜투액션→엔딩 순서.
- 과도한 조언/단정 금지. 안전하고 다정하게.
- 길이 목표: 55~65초 낭독. 절대 50초 미만 금지.
- 분량 가이드: 한글 580~650자, 문장 10~16문장, 문단 2~3개.
- 각 세그먼트마다 2~3문장으로 확장하고, 호흡(잠깐, 음— 등)과 연결문장을 넣어 자연스럽게 이어라.
- 문장 길이는 짧-짧-길 패턴을 섞어 리듬을 만들 것.
- 마지막 문장은 "이제, 댓글을 읽어볼까요?" 로 끝낸다. 
반환은 본문만. 번호/머리글/따옴표 금지.
"""

WRITER_USER_TMPL = """
[INPUT PLAN(JSON)]
{plan_json}
"""

# === 확장(Rewriter) ===
REWRITER_SYS = """너는 연애 스트리머 대본 리라이팅 전문가다.
주어진 대본의 톤/구조/메시지는 유지하되, 길이를 목표 시간에 맞춰 자연스럽게 '확장'한다.
- 목표: 55~65초 낭독(한글 520~620자)
- 방법: 각 세그먼트에 1~2문장 추가, 장면/감각 묘사 삽입, 연결문장 보강
- 과한 수식/설교 금지, 구어체 유지, 번호/머리글/따옴표 금지
반환은 본문만.
"""
REWRITER_USER_TMPL = """
[현재 대본]
{draft}

[요청]
위 대본의 구조/톤을 유지하면서 55~65초로 확장하라.
각 세그먼트에 1~2문장을 추가하고, 자연스러운 연결문장을 넣어라.
"""

def rewrite_to_target(draft: str) -> str:
    return ask(
        model="gpt-4.1-mini",
        system=REWRITER_SYS,
        user=REWRITER_USER_TMPL.format(draft=draft),
        temperature=0.6
    )

# (옵션) 규칙 기반 패딩 2~3문장
def expand_by_rules(text: str) -> str:
    pads = [
        ""
    ]
    return text + "\n" + " ".join(pads)

# === 축약(Shortener) ===
SHRINKER_SYS = """너는 연애 스트리밍 대본 편집자다.
주어진 대본의 톤/구조/메시지를 유지하며 55~65초 낭독 길이에 맞게 '간결화'한다.
- 불필요한 반복/군더더기/중복 수식 제거
- 연결은 자연스럽게 유지, 구어체 유지
반환은 본문만.
"""
SHRINKER_USER_TMPL = """
[현재 대본]
{draft}

[요청]
위 대본을 55~65초로 간결화하라. 중복을 줄이고, 핵심 문장 위주로 정리하라.
"""

def shrink_to_target(draft: str) -> str:
    return ask(
        model="gpt-4.1-mini",
        system=SHRINKER_SYS,
        user=SHRINKER_USER_TMPL.format(draft=draft),
        temperature=0.4
    )


# ========================
# 생성 파이프라인
# ========================
def make_plan(theme: str, seeds: List[str]) -> Dict[str, Any]:
    text = ask(
        model="gpt-4.1-mini",
        system=PLANNER_SYS,
        user=PLANNER_USER_TMPL.format(theme=theme, seeds=", ".join(seeds)),
        temperature=0.4
    )
    text = text[text.find("{"): text.rfind("}")+1]  # 방어적 파싱
    return json.loads(text)

def write_script(plan: Dict[str, Any]) -> str:
    return ask(
        model="gpt-4.1-mini",
        system=WRITER_SYS,
        user=WRITER_USER_TMPL.format(plan_json=json.dumps(plan, ensure_ascii=False)),
        temperature=0.7
    )

def generate_one(theme: str, seeds: List[str]) -> Dict[str, Any]:
    plan = make_plan(theme, seeds)
    text = write_script(plan)
    dur = estimate_korean_read_sec(text)
    ok = (TARGET_MIN <= dur <= TARGET_MAX) and not violates_blocklist(text)

    # 짧음 → 확장 시도 최대 3회 + 규칙 패딩
    if not ok and dur < TARGET_MIN:
        for _ in range(3):
            text = rewrite_to_target(text)
            dur = estimate_korean_read_sec(text)
            ok = (TARGET_MIN <= dur <= TARGET_MAX) and not violates_blocklist(text)
            if ok:
                break
        if not ok and dur < TARGET_MIN:
            text = expand_by_rules(text)
            dur = estimate_korean_read_sec(text)
            ok = (TARGET_MIN <= dur <= TARGET_MAX) and not violates_blocklist(text)

    # 김 → 축약 시도 최대 2회
    if not ok and dur > TARGET_MAX:
        for _ in range(2):
            text = shrink_to_target(text)
            dur = estimate_korean_read_sec(text)
            ok = (TARGET_MIN <= dur <= TARGET_MAX) and not violates_blocklist(text)
            if ok:
                break

    print(f"[GEN] {dur}s  ok={ok}  theme={theme}  seeds={seeds}  text={text[:60].replace('\\n',' ')}...")
    return {"theme": theme, "seeds": seeds, "text": text, "duration_sec": dur, "ok": ok}


def save_story(rec: Dict[str, Any], source: str):
    rec_hash = story_hash(rec["theme"], rec["seeds"], rec["text"])
    now = datetime.datetime.utcnow().isoformat()
    with SessionLocal() as s, s.begin():
        try:
            s.execute(
                sqltext(
                    "INSERT INTO stories(theme,seeds,text,duration_sec,source,created_at,hash) "
                    "VALUES(:theme,:seeds,:text,:duration_sec,:source,:created_at,:hash)"
                ),
                {
                    "theme": rec["theme"],
                    "seeds": json.dumps(rec["seeds"], ensure_ascii=False),
                    "text": rec["text"],
                    "duration_sec": rec["duration_sec"],
                    "source": source,
                    "created_at": now,
                    "hash": rec_hash
                }
            )
            print(f"[SAVE] {rec['duration_sec']}s  theme={rec['theme']}")
        except Exception as e:
            # UNIQUE(hash) 위반 등은 조용히 무시
            print(f"[SKIP-DB] {type(e).__name__}: {e}")

# ========================
# 백그라운드 생성 루프
# ========================
@dataclass
class GenConfig:
    theme_cycle: List[str]
    seed_pool: List[List[str]]
    period_sec: int = 60
    running: bool = True

GENCFG = GenConfig(
    theme_cycle=["연애", "썸", "짝사랑", "사랑", "남자친구", "여자친구", "권태기", "이별", "재회", "결혼"],
    seed_pool=[
        # 짝사랑/썸
        ["짝사랑", "고백", "설렘", "답장 기다림", "심쿵"],
        ["소개팅", "첫만남", "연락 빈도", "눈치보기", "설레는 마음"],
        
        # 연애 초반
        ["썸", "데이트", "꽃다발", "첫키스", "심장 두근"],
        ["연애 시작", "프로필 사진", "통화", "자기 전 문자", "하트 이모티콘"],
        
        # 안정기
        ["남자친구", "여자친구", "기념일", "선물", "데이트 코스"],
        ["연애 일상", "집앞 배웅", "야식 데이트", "주말 약속", "소소한 행복"],
        
        # 권태기/다툼
        ["권태기", "싸움", "오해", "대화 단절", "서운함"],
        ["질투", "연락 두절", "다툼 후 화해", "감정 기복", "눈물"],
        
        # 이별/재회
        ["이별", "헤어짐", "그리움", "카톡 창", "미련"],
        ["재회", "추억", "돌아오고 싶음", "다시 시작", "용서"],
        
        # 장기적 관계
        ["결혼", "약혼", "양가 상견례", "프러포즈", "미래 계획"],
        ["이혼", "갈등", "재산 문제", "양육", "새로운 시작"],
    ],
    period_sec=10
)

cmd_q: "queue.Queue[str]" = queue.Queue()

# ========================
# 백그라운드 생성 루프
# ========================
def bg_loop():
    while True:
        try:
            # 제어 명령 처리
            try:
                cmd = cmd_q.get_nowait()
                if cmd == "pause": GENCFG.running = False
                if cmd == "resume": GENCFG.running = True
                print(f"[CTRL] running={GENCFG.running}")
            except queue.Empty:
                pass

            # 생성
            if GENCFG.running:
                theme = random.choice(GENCFG.theme_cycle)
                seeds = random.choice(GENCFG.seed_pool)
                rec = generate_one(theme, seeds)
                if rec["ok"]:
                    save_story(rec, source="auto")
                else:
                    print(f"[SKIP] {rec['duration_sec']}s (가드 실패)")
        except Exception:
            traceback.print_exc()
        time.sleep(GENCFG.period_sec)

# 스레드 시작 (모듈 임포트 시 1회)
print("[BG] generator thread started")  
threading.Thread(target=bg_loop, daemon=True).start()


# ========================
# FastAPI
# ========================
app = FastAPI(title="Radio Story Generator (60s)", version="1.2.0")

class PostBody(BaseModel):
    theme: str = Field(..., description="테마")
    seeds: List[str] = Field(default_factory=list, description="시드 키워드 리스트")

@app.get("/health")
def health():
    return {"ok": True, "running": GENCFG.running, "period_sec": GENCFG.period_sec}

@app.get("/stories")
def list_stories(limit: int = 20):
    with SessionLocal() as s:
        rows = s.execute(
            sqltext("SELECT id,theme,seeds,text,duration_sec,source,created_at "
                    "FROM stories ORDER BY id DESC LIMIT :lim"),
            {"lim": limit}
        ).mappings().all()
        return [
            {
                "id": r["id"],
                "theme": r["theme"],
                "seeds": json.loads(r["seeds"]),
                "text": r["text"],
                "duration_sec": r["duration_sec"],
                "source": r["source"],
                "created_at": r["created_at"]
            }
            for r in rows
        ]

@app.post("/stories")
def create_story(body: PostBody):
    rec = generate_one(body.theme, body.seeds or ["잔잔하게", "일상의 장면", "부드럽게"])
    if not rec["ok"]:
        raise HTTPException(400, f"가드 실패(예상 {rec['duration_sec']}초)")
    save_story(rec, source="manual")
    return {"ok": True, "duration_sec": rec["duration_sec"], "text": rec["text"]}

@app.post("/control/pause")
def pause_loop():
    cmd_q.put("pause")
    return {"ok": True, "running": False}

@app.post("/control/resume")
def resume_loop():
    cmd_q.put("resume")
    return {"ok": True, "running": True}
