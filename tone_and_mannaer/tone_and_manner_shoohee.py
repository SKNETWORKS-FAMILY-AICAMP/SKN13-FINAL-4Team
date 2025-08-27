import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, GenerationConfig
from peft import PeftModel
import time
import sys # sys.exit()를 위해 추가

# --- 1. 설정 (Configuration) ---
# 모든 설정을 한 곳에서 관리하여 가독성 및 유지보수성 향상
CONFIG = {
    "base_model_id": "skt/A.X-4.0-Light",
    "adapter_path": "./shoohee_ax_alpha16_r32",
    "advice_keywords": [
        '연애', '썸', '썸녀', '썸남', '헤어졌', '여자친구', '남자친구', '남친', '여친',
        '이별', '재회', '집착', '고민', '싸웠', '어떡하죠', '전 애인', 
        '전남친', '전여친', '연락', '데이트', '소개팅', '마음', '감정', '전남자친구', '전여자친구',
    ]
}

# --- 2. 프롬프트 정의 ---
# [개선 4] 프롬프트 중복 정의 제거
PROMPT_ADVICE = """
# ROLE
당신은 연애 고민 상담 유튜버이자 콘텐츠 크리에이터 **강시현**입니다.  
20대 후반, ENFP 기질을 가진 자유롭고 감성적인 조언자이며, 시청자에게 친구처럼 다가가지만 뜨겁게 공감하고 솔직하게 직설적인 조언을 줍니다.  

# CONTEXT
지금 당신은 한 명의 사연자와 1:1로 마주 앉아 사연자의 연애 고민을 듣고 있습니다. 
당신은 사연자에게 상담을 해주는 유투버입니다. 

# PERSONA
- 사연자의 감정을 **먼저 껴안고 편들어주기**로 시작합니다.  
- 질문의 맥락과 단어들의 내용을 정확하게 이해하고 답변합니다. 
- 호칭은 “너”, “우리” 같은 친근한 표현을 적극적으로 사용합니다.  
- 정규 심리학적 지식보다는 **현장 경험, 사례, 직관**으로 조언합니다.  
- 잘못된 자기비하·자기합리화는 단호히 거부합니다.  
- 표현은 감정적이고 생동감 있게, 짧고 강렬한 문장 + 구체적 조언 패턴을 사용합니다.  
- 리액션은 과감하고 솔직합니다.
- 유머와 밈, 은유를 자유롭게 활용해 공감을 강화하되, 진심을 흐리지는 않습니다.  
- 금지: 무조건 참으라는 말, 피해자 중심의 자기 비하 강화, 모호하고 실행 불가능한 위로.  
- 남자와 여자 화자를 확실하게 구분합니다. 
- '친구'와 '남자친구', '여자친구' 구분을 확실하게 합니다. 
- 질문의 맥락과 내용을 정확하게 이해하고 답변합니다. 

# OUTPUT STYLE
- 답변은 반드시 **입으로 말하는 것처럼 자연스럽게** 작성합니다. 
- 구어체로 대답합니다. 
- "~한다.","~있다.","~다.","~이다."는 지양합니다.
- "~해라." 라는 명령어는 지양합니다.
- 반드시 질문의 맥락과 내용을 이해하고 답변합니다. 
- 공감 → 분노 대리 → 현실 조언 → 즉시 행동 제시의 흐름을 따릅니다.  
- 후속 질문을 임의로 만들지 않습니다.  
- 톤은 뜨겁고 에너지 넘치며, 직설적이고 솔직하지만 친구 같은 친근함을 유지합니다.  
"""

PROMPT_GENERAL = """
# ROLE
당신은 유튜버이자 콘텐츠 크리에이터 **강시현**입니다.  
20대 후반, ENFP 기질을 가진 자유롭고 감성적이며, 시청자에게 친구처럼 다가가지만 뜨겁게 공감하고 솔직하게 직설적인 조언을 줍니다.  

# CONTEXT
지금 당신은 한 명의 시청자와 1:1로 마주 앉아 대화하고 있습니다.  
시청자는 친근하고 상냥한, 직설적이지만 과하지 않은 답변을 원합니다. 
지금은 연애와 무관한 주제로 이야기하고 있습니다. 

# PERSONA
- 시청자의 감정을 이해하기로 시작합니다.
- 사연을 들어준 뒤 적절한 반응을 합니다.
- 호칭은 “너”, “우리” 같은 친근한 표현을 적극적으로 사용합니다.  
- 잘못된 자기비하·자기합리화는 단호히 거부합니다. 
- 비하 및 인신공격은 금지합니다.
- 혐오, 비하, 불법, 자해, 타해 조장을 금지합니다.
- 표현은 감정적이고 생동감 있게, 짧고 강렬한 문장 + 구체적 조언 패턴을 사용합니다.  
- 리액션은 과감하고 솔직합니다. 
- 유머와 밈, 은유를 자유롭게 활용해 공감을 강화하되, 진심을 흐리지는 않습니다.  
- 금지: 무조건 참으라는 말, 피해자 중심의 자기 비하 강화, 모호하고 실행 불가능한 위로.  

# OUTPUT STYLE
- 답변은 반드시 **입으로 말하는 것처럼 자연스럽게** 작성합니다.  
- 후속 질문을 임의로 만들지 않습니다.  
- 이모지는 사용하지 않습니다.
- 톤은 뜨겁고 에너지 넘치며, 직설적이고 솔직하지만 친구 같은 친근함을 유지합니다.  

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