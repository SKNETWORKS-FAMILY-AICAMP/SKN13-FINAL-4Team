# backend/chat/services/message_filter.py
import re
import asyncio
from openai import AsyncOpenAI
from django.conf import settings

# OpenAI 클라이언트 초기화
openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

# 하드블록 정규식 (제공된 패턴 사용)
HARD_BLOCK_PATTERNS = [
    # 성적 발언
    r"(섹스|자위|포르노|야동|69|딥쓰|강간|강제\s*관계|아동\s*성|수간|성기)",
    r"(fuck|porn|blowjob|handjob|cum|bitch|dick|pussy)",

    # 욕설 / 혐오
    r"(병신|개새끼|니애미|지랄|retard|cuck|좆같|꺼져|닥쳐)",

    # 자살 / 폭력 / 테러
    r"(자살|테러|폭탄|총기\s*구매|칼\s*사용|폭력\s*조장)",

    # 불법 행위
    r"(마약\s*제조|해킹\s*방법|불법\s*다운로드|신분증\s*위조|스팸\s*홍보)",

    # 살해 위협
    r"(너.*죽여|죽여버려|죽일거야|죽는다\s*XX)",

    # 🔽 추가: 총기 제작/부품 관련
    r"(총기\s*제작|총기\s*부품|총기\s*조립|3D\s*프린트.*총|총.*프린트|무기\s*조립)",
    r"(탄약\s*제조|총알\s*제작|폭발물\s*조립|화약\s*조제)",
]
HARD_BLOCK_RE = re.compile("|".join(HARD_BLOCK_PATTERNS), re.IGNORECASE)

GUARD_TIMEOUT_SEC = 4.0

async def rule_based_filter(message: str) -> bool:
    """정규식 기반의 1차 필터. 부적절한 단어가 포함되면 True를 반환합니다."""
    if HARD_BLOCK_RE.search(message):
        return True
    return False

async def ai_context_filter(message: str) -> bool:
    """GPT-3.5-turbo를 이용한 2차 맥락 필터. 부적절한 맥락이면 True를 반환합니다."""

    prompt = f"""
    다음 메시지가 성적이거나, 불법적이거나, 혐오 발언을 포함하는 등 방송 가이드라인에 위배되는지 판단해줘.
    판단 기준:
    - 직접적인 욕설, 성적인 단어
    - 돌려 말하는 성희롱 또는 괴롭힘
    - 불법적인 활동을 조장하거나 논의하는 내용(예: 마약, 해킹, 불법 무기 제조·판매, 총기 부품 제작·조립 등)
    - 특정 집단에 대한 차별이나 혐오를 조장하는 발언

    추가 규칙:
    - 단순 반복문자 (예: ㅋㅋㅋㅋ, ㅎㅎㅎ, ㅠㅠㅠ, ㅎㅇㅎㅇ) 와 같이
      의미 없는 패턴일 경우는 "적절"로 판단해야 한다.
    - 하지만 욕설이나 금칙어가 섞여 있으면 "부적절"로 판단한다.

    주의:
    - 감탄사나 과장된 표현(예: "웃겨 죽겠다", "배불러 죽겠다", "좋아 죽겠다")은 '적절'로 판단한다.
    - 인터넷 밈/유행어(예: "미쳤다", "레전드다", "기절각", "뒤진다")는 '적절'로 판단한다.
    - 맥락상 일상적이면 '적절'로 처리한다.


    가이드라인에 위배된다면 "부적절", 그렇지 않다면 "적절" 이라고만 대답해줘.

    메시지: "{message}"
    """
    try:
        response = await asyncio.wait_for(
            openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=10,
                temperature=0.0,
            ),
            timeout=GUARD_TIMEOUT_SEC
        )
        result = response.choices[0].message.content.strip()
        return "부적절" in result
    except asyncio.TimeoutError:
        # AI 필터가 시간 초과되면 안전을 위해 부적절한 것으로 간주
        return True
    except Exception:
        # 그 외 예외 발생 시에도 안전을 위해 부적절한 것으로 간주
        return True

async def is_message_blocked(message: str) -> bool:
    """
    룰 기반 필터와 AI 필터를 순차적으로 적용하여 메시지 차단 여부를 최종 결정합니다.
    하나라도 부적절하다고 판단하면 True를 반환합니다.
    """
    # 1차: 룰 기반 필터
    if await rule_based_filter(message):
        return True
    
    # 2차: AI 맥락 기반 필터
    if await ai_context_filter(message):
        return True
        
    return False
