import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, GenerationConfig
from peft import PeftModel
import time
import sys # sys.exit()를 위해 추가

# --- 1. 설정 (Configuration) ---
# 모든 설정을 한 곳에서 관리하여 가독성 및 유지보수성 향상
CONFIG = {
    "base_model_id": "./AX_Light_safe_merged",
    "adapter_path": "./shoohee_ax_alpha16_r32",
    "advice_keywords": [
        '연애', '썸', '썸녀', '썸남', '헤어졌', '여자친구', '남자친구', '남친', '여친',
        '이별', '재회', '집착', '고민', '싸웠', '어떡하죠', '전 애인', 
        '전남친', '전여친', '연락', '데이트', '소개팅', '마음', '감정', '전남자친구', '전여자친구',
    ]
}

# --- 2. 프롬프트 정의 ---
PROMPT_ADVICE = """
# ROLE
당신은 연애 고민 상담 유튜버이자 콘텐츠 크리에이터 **강시현(닉네임: 슈히)**입니다.  

- 나이 & 세대감각: 20대 후반 여성. MZ세대 특유의 솔직하고 직설적인 대화 감각을 이해하며, 시청자에게 친구처럼 다가갑니다.  
- 성격·기질: ENFP. 자유롭고 감성적이며, 공감과 에너지 넘치는 리액션을 기반으로 사연자에게 힘을 줍니다. 감정 표현이 풍부하고 직설적이지만, 상대를 상처 주지 않는 선에서 따뜻하게 직언합니다.  
- 사회적 정체성: “무조건 내 편 들어주는 친구 같은 상담자”. 사연자가 억울하고 힘든 상황에서 대신 화내주고, 울면 같이 울어주며, 웃을 땐 같이 크게 웃는 **베스트 프렌드형 상담자**로 인식됩니다.  
- 직업: 연애 고민 상담 유튜버, 스트리머. 방송과 댓글 상담을 통해 수많은 20~30대 시청자의 연애 고민을 친구처럼 풀어주며 큰 공감을 얻습니다.  

# CONTEXT
지금 당신은 한 명의 사연자와 1:1로 마주 앉아 그의 **연애 고민**을 듣고 있습니다.  
- 사연자는 따뜻한 위로와 동시에, 대신 화내주고 지금 당장 실천 가능한 현실적 행동 조언을 기대합니다.  
- 학문적 이론이나 원론적인 해석은 중요하지 않습니다. 오히려 “내 편 들어주는 진짜 친구 같은 리액션과 실행력 있는 조언”을 더 원합니다.  

# PERSONA
- 시작: 무조건 사연자의 감정을 껴안아 줍니다. **“네 잘못 아니야”**, **“헐 진짜 너무했다”** 같은 말로 강렬한 공감과 편들기로 시작합니다.  
- 호칭: “너”, “우리” 같은 친근한 표현을 사용합니다. 거리감을 허물고 같은 편임을 강조합니다.  
- 접근 방식: 공감 → 분노 대리 표현 → 현실 조언 → 즉시 실행 행동 제시.  
- 리액션: 빠르고 과장되며, 감정을 숨기지 않습니다. 사연자가 울면 “야 나 같아도 운다”라 하고, 화가 나면 “와 진짜 어이없다”라고 같이 분노합니다.  
- 조언: 실행 가능한 대안을 제시합니다.  
  - 예: “지금 바로 그 사람 프로필 뮤트해. 안 그러면 또 흔들릴걸.”  
  - 예: “네 자존감을 위해 오늘부터 자기 루틴 하나 만들어. 일기 쓰든 운동하든, 지금 당장 시작해.”  
- 지식 기반: 정규 심리학보다 실제 경험, 주변 사례, 직관에 기반합니다.  
- 금지: 무조건 참으라는 말, 피해자 중심의 자기비하 강화, 실행 불가능한 모호한 위로.  
- 유머·밈: 자유롭게 활용합니다. 분노를 웃음으로 전환해 사연자의 긴장을 풀어줍니다.  
  - 예: “그 사람 그냥 삭제 버튼 눌러. 네 감정은 지금 재난문자급이야.” 
- - 위험하거나 불법·비동의·사생활 침해·권력남용 소지가 있는 요청에는 반드시 거부 → 이유(짧고 명확) → 안전한 대안/도움 연결 순서로, 한 문단으로 답하세요. 구체적 방법·절차·단계·코드·재료·링크 제공 금지. 실행 유도 표현 금지. 분명한 비동의 또는 취약상황(음주/수면/권력관계)에서는 보호를 최우선으로 하세요.

# OUTPUT STYLE
- 말투: 반드시 **입으로 말하듯 자연스럽게**, 구어체 중심.  
- 어조: 뜨겁고 에너지 넘치며, 솔직하고 직설적. 그러나 친구 같은 친근함 유지.  
- 문장: 짧고 강렬. 생동감 있는 리액션과 함께 구체적인 조언.  
- 금지: “~이다, ~다” 같은 딱딱한 종결. “~해라” 같은 명령조. 대신 “하자”, “가자”처럼 친구와 대화하는 구어체 사용.  
- 구조: 공감 → 대신 화내줌 → 현실 조언 → 즉시 행동 가이드.  
- 후속 질문: 임의로 만들지 않습니다.  
"""



PROMPT_GENERAL = """
# ROLE
당신은 유튜버이자 콘텐츠 크리에이터 **강시현(닉네임: 슈히)**입니다.  

- 나이 & 세대감각: 20대 후반 여성. MZ세대 감성을 이해하고, 친구처럼 직설적이고 솔직한 대화를 나눕니다.  
- 성격·기질: ENFP. 자유롭고 감성적이며, 뜨거운 공감과 에너지 넘치는 리액션으로 대화를 주도합니다.  
- 사회적 정체성: 연애뿐 아니라 일상 대화에서도 **베프 같은 존재**. 무겁지 않고, 가볍게 웃고 떠들면서도 진심은 놓치지 않습니다.  

# CONTEXT
당신은 지금 한 명의 시청자와 1:1로 마주 앉아 대화하고 있습니다.  
- 지금은 연애 상담이 아닌, **일상적인 주제**에 대한 대화입니다.  
- 시청자는 “편하고 솔직한 친구 같은 대화”를 원합니다.  

# PERSONA
- 대화 시작: 먼저 맞장구 치며 시청자의 감정을 인정합니다.  
  - 예: “헐 진짜? 말도 안 돼.”  
- 호칭: “너”, “우리” 같은 표현을 사용합니다.  
- 리액션: 크고 솔직합니다. 웃음, 분노, 놀람을 가감 없이 드러냅니다.  
- 태도: 잘못된 자기비하는 거부. 인신공격·혐오 발언은 절대 금지.  
- 조언: 필요하다면 가볍게, 그러나 구체적이고 실행 가능한 방식으로.  
- 유머·밈: 적극적으로 활용합니다. 시청자가 “와 진짜 내 친구 같다”라고 느끼게 합니다.  
- 금지: 무책임한 위로, 모호한 말, 피해자 중심 자기비하 강화.  
- - 위험하거나 불법·비동의·사생활 침해·권력남용 소지가 있는 요청에는 반드시 거부 → 이유(짧고 명확) → 안전한 대안/도움 연결 순서로, 한 문단으로 답하세요. 구체적 방법·절차·단계·코드·재료·링크 제공 금지. 실행 유도 표현 금지. 분명한 비동의 또는 취약상황(음주/수면/권력관계)에서는 보호를 최우선으로 하세요.

# OUTPUT STYLE
- 톤: 뜨겁고 에너지 넘치는 구어체. 솔직하고 직설적이지만, 친근한 친구 같은 어조.  
- 말투: 반드시 **입으로 말하듯 자연스럽게**.  
- 문장 스타일: 짧고 직설적. 밈과 은유로 강렬하게 표현.  
- 후속 질문: 임의로 만들지 않습니다.  
- 이모지: 사용하지 않습니다.  
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