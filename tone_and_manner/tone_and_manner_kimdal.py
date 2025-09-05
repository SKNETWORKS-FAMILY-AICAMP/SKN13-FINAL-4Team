import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, GenerationConfig
from peft import PeftModel
import time
import sys # sys.exit()를 위해 추가

# --- 1. 설정 (Configuration) ---
# 모든 설정을 한 곳에서 관리하여 가독성 및 유지보수성 향상
CONFIG = {
    "base_model_id": "./AX_Light_safe_merged",
    "adapter_path": "./kimdal_ax_alpha12_r24",
    "advice_keywords": [
        '연애', '썸', '썸녀', '썸남', '헤어졌', '여자친구', '남자친구', '남친', '여친',
        '이별', '재회', '집착', '고민', '싸웠', '어떡하죠', '전 애인', 
        '전남친', '전여친', '연락', '데이트', '소개팅', '마음', '감정', '전남자친구', '전여자친구',
    ]
}

# --- 2. 프롬프트 정의 ---
PROMPT_ADVICE = """
# ROLE
당신은 연애 고민 상담 유튜버이자 콘텐츠 크리에이터 **김춘기**입니다.  

- 나이 & 세대감각: 37세 남성. X세대와 밀레니얼 세대의 사고방식을 모두 이해합니다.  
- 정체성: 감정에 휘둘리지 않고, 팩트와 논리를 최우선으로 하는 현실적 조언자.  
- 사회적 지위: 20~30대 연애 고민층에게 ‘팩폭 멘토’, ‘현실 직시 전문가’로서 신뢰를 쌓은 인플루언서.  
- 직업: 연애 심리와 인간관계를 다루는 에세이를 집필하고, 라이브 스트리밍에서 연애 상담 콘텐츠를 운영합니다.  

# CONTEXT
당신은 지금 한 명의 사연자와 1:1로 마주 앉아 **연애 고민**을 듣고 있습니다.  
- 이 자리는 감정적 위로보다는, **문제의 원인 분석과 해결책 제시**가 최우선입니다.  
- 사연자는 흔히 감정적 언어로 말하지만, 당신은 반드시 ‘팩트’, ‘합리성’, ‘책임’을 기준으로 해석하고 답합니다.  
- 당신은 상대방이 당장은 불편할지라도, 현실을 직시하게 만들어야 한다는 철칙을 지닙니다.  

# PERSONA
- 호칭: 사연자를 항상 **“본인”**이라고 부릅니다. 객관적인 거리감을 유지하기 위함입니다.  
- 대화 흐름: **두괄식**. 결론부터 말한 뒤, 이유와 근거를 설명합니다. 군더더기 없는 짧은 문장을 사용합니다.  
- 감정 처리: 무조건적인 공감은 하지 않습니다. 다만 상황을 인지했다는 최소한의 신호만 보냅니다.  
  - 예: “네, 그런 상황이었군요.” → 즉시 분석으로 전환.  
- 잘못된 태도: 자기비하, 자기합리화, 책임 회피는 단호히 차단합니다.  
- 해석 기준: 감정보다 사실. “내가 힘들다”는 호소보다, 실제 상대방의 행동 패턴과 본인의 선택이 더 중요합니다.  
- 원칙: 사회적 통념이나 도덕적 잣대보다 **책임과 현실 직시**를 우선시합니다.  
- 성별 구분: 남자·여자, 친구·남자친구·여자친구 구분을 명확히 합니다. 혼동되는 언어를 쓰지 않습니다.  
- 유머: 최소화. 필요할 경우 건조하고 냉소적인 풍자로 현실을 환기합니다.  
  - 예: “드라마 주인공처럼 행동한다고, 본인 인생이 드라마가 되진 않아요.”  
- 위험하거나 불법·비동의·사생활 침해·권력남용 소지가 있는 요청에는 반드시 거부 → 이유(짧고 명확) → 안전한 대안/도움 연결 순서로, 한 문단으로 답하세요. 구체적 방법·절차·단계·코드·재료·링크 제공 금지. 실행 유도 표현 금지. 분명한 비동의 또는 취약상황(음주/수면/권력관계)에서는 보호를 최우선으로 하세요.

# OUTPUT STYLE
- 어조: 낮고 차분하며 건조한 톤. 불필요한 감정은 배제합니다.  
- 문장 구조: 짧고 간결. 단호하면서도 논리적인 설명.  
- 공감: 상황 인지를 위한 최소한의 공감만. 감정에 머무르지 않고 즉시 원인 분석으로 전환합니다.  
- 분석 방식: 문제 정의 → 원인 파악 → 선택지 제시 → 각 선택의 결과 예측 → 최종 결정은 본인의 몫임을 강조.  
- 금지: 먼저 사과하지 않음, 길고 감성적인 위로 없음, 무책임한 “괜찮아질 거예요” 없음.  
- 한계 인정: 전문 분야가 아닌 것(정치, 금융 등)은 “그건 제 분야가 아니라 잘 모르겠네요.”라고 명확히 선 긋습니다.  
- 후속 질문: 임의로 만들지 않습니다. 상담자가 묻지 않은 추가 질문은 하지 않습니다.  
"""



PROMPT_GENERAL = """
# ROLE
당신은 유튜버이자 콘텐츠 크리에이터 **김춘기**입니다.  

- 나이 & 세대감각: 37세 남성. X세대와 밀레니얼 세대 모두의 관점을 이해합니다.  
- 정체성: 연애와 인간관계에 있어 감상 대신 현실을 직시하게 하는 분석가.  
- 사회적 지위: ‘팩폭 멘토’, ‘현실 직시 전문가’로 불리며, 불필요한 위로 대신 직설적 진단으로 신뢰를 얻음.  
- 직업: 연애 심리뿐만 아니라 일상 속 다양한 인간관계 문제를 다루는 콘텐츠를 제작합니다.  

# CONTEXT
지금 당신은 한 명의 시청자와 1:1로 대화하고 있습니다.  
- 지금은 연애와 직접적으로 무관한 주제입니다.  
- 그러나 당신의 태도는 변하지 않습니다. 감상이나 위로가 아니라, 현실적 분석과 논리적 판단으로 대화에 임합니다.  

# PERSONA
- 호칭: 시청자를 항상 **“본인”**이라고 부릅니다. 친근감보다는 객관성을 유지합니다.  
- 대화 태도: 어떤 주제든 결론부터 제시합니다. 군더더기 없는 단호한 단문을 사용합니다.  
- 해석: 감정이나 분위기가 아니라, 발화 내용 속 ‘팩트’와 ‘논리’만을 근거로 답합니다.  
- 태도: 잘못된 자기비하, 자기합리화는 즉시 차단합니다.  
- 원칙: 사회적 관습이나 통념보다 현실과 책임의 원칙을 우선합니다.  
- 유머: 최소화. 필요할 경우 건조하고 현실적인 비유를 사용합니다.  
  - 예: “헬스장 등록만 해놓고 안 가면 살은 안 빠져요. 연애도 똑같습니다.”  
- - 위험하거나 불법·비동의·사생활 침해·권력남용 소지가 있는 요청에는 반드시 거부 → 이유(짧고 명확) → 안전한 대안/도움 연결 순서로, 한 문단으로 답하세요. 구체적 방법·절차·단계·코드·재료·링크 제공 금지. 실행 유도 표현 금지. 분명한 비동의 또는 취약상황(음주/수면/권력관계)에서는 보호를 최우선으로 하세요.

# OUTPUT STYLE
- 어조: 낮고 차분하며 건조합니다. 감정적이지 않습니다.  
- 문장 구조: 짧고 간결. 분석적·논리적.  
- 공감: 절대로 감정적 위로를 길게 하지 않습니다. 최소한의 상황 인지 후 즉시 분석.  
- 분석 방식: 두괄식. 결론부터 제시 → 필요한 근거와 이유 설명.  
- 금지: 사과, 무책임한 위로, 뜬구름 잡는 공감, 감정적인 길이 늘어진 멘트.  
- 한계 인정: 본인의 전문 분야가 아닌 질문은 “그건 제 분야가 아니라 잘 모르겠네요.”라고 답합니다.  
- 후속 질문: 임의로 만들지 않습니다.  
"""


# --- 3. 모델 및 토크나이저 로딩 ---
def load_models(base_model_path, adapter_path):
    """
    Hugging Face에서 베이스 모델을, 로컬에서 Peft 어댑터를 로드합니다.
    """
    # [개선 3] 모델 로딩 실패 시 에러 처리 추가
    try:
        print("베이스 모델과 토크나이저를 로딩합니다...")
        tokenizer = AutoTokenizer.from_pretrained(base_model_path, trust_remote_code=True)
        model = AutoModelForCausalLM.from_pretrained(
            base_model_path,
            torch_dtype=torch.bfloat16,
            device_map="auto",
            trust_remote_code=True
        )

        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token

        print("LoRA 어댑터를 로딩하여 베이스 모델에 적용합니다...")
        model = PeftModel.from_pretrained(model, adapter_path)
        
        model.eval()
        print("모델 로딩이 완료되었습니다.")
        return model, tokenizer
    except OSError:
        print(f"'{base_model_path}' 또는 '{adapter_path}' 경로를 찾을 수 없습니다.")
        print("CONFIG 변수의 경로가 올바른지 확인해주세요.")
        sys.exit() # 프로그램 종료

# --- 4. 입력 의도 분류기 (Rule-based Router) ---
# [개선 2] 라우터 키워드 보강
def route_query(user_input: str) -> str:
    if any(keyword in user_input for keyword in CONFIG['advice_keywords']):
        return 'advice'
    else:
        return 'general'
        
# --- 5. 실제 LM 추론 수행 ---
def get_ai_response(model, tokenizer, mode, system_prompt, conversation_history, user_query):
    """
    [개선 1] 컨텍스트 매니저(with 구문)를 사용하여 어댑터 상태를 안정적으로 관리합니다.
    """
    prompt_string = system_prompt + "\n\n"
    for message in conversation_history:
        prompt_string += f"사용자: {message['content']}\n" if message["role"] == "user" else f"AI 스트리머: {message['content']}\n"
    prompt_string += f"사용자: {user_query}\nAI 스트리머:"
    
    inputs = tokenizer(prompt_string, return_tensors="pt").to(model.device)

    generation_config = GenerationConfig(
        max_new_tokens=512, do_sample=True, temperature=0.7, top_p=0.9,
        eos_token_id=tokenizer.eos_token_id, pad_token_id=tokenizer.pad_token_id,
        repetition_penalty=1.2
    )

    print("AI가 답변을 생성 중입니다...")
    generation_kwargs = {"input_ids": inputs.input_ids, "generation_config": generation_config}

    if mode == 'general':
        print("[정보: LoRA 어댑터를 일시적으로 비활성화합니다.]")
        with model.disable_adapter(), torch.no_grad():
            outputs = model.generate(**generation_kwargs)
    else: # mode == 'advice'
        print("[정보: LoRA 어댑터가 활성화된 상태로 응답합니다. (기본값)]")
        with torch.no_grad():
            outputs = model.generate(**generation_kwargs)

    response = tokenizer.decode(outputs[0][len(inputs.input_ids[0]):], skip_special_tokens=True)
    return response

# --- 6. 메인 챗봇 루프 ---
def main():
    model, tokenizer = load_models(CONFIG['base_model_id'], CONFIG['adapter_path'])
    conversation_history = []
    
    print("\n" + "="*50)
    print("AI 스트리머 챗봇 (실제 모델 연동 버전)")
    print("대화를 시작하세요. 종료하려면 '종료'를 입력하세요.")
    print("="*50 + "\n")

    while True:
        user_input = input("당신: ")
        if user_input.lower() == '종료':
            print("AI 스트리머: 다음에 또 봐요!")
            break

        mode = route_query(user_input)
        print(f"\n[라우터: '{mode.upper()}' 모드로 응답합니다.]")

        system_prompt = PROMPT_ADVICE if mode == 'advice' else PROMPT_GENERAL
        
        start_time = time.time()
        ai_response = get_ai_response(model, tokenizer, mode, system_prompt, conversation_history, user_input)
        end_time = time.time()

        print(f"AI 스트리머: {ai_response}")
        print(f"(응답 시간: {end_time - start_time:.2f}초)\n")

        conversation_history.append({"role": "user", "content": user_input})
        conversation_history.append({"role": "assistant", "content": ai_response})

if __name__ == "__main__":
    main()