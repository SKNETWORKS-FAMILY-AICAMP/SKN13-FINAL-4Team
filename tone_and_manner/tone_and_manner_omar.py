import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, GenerationConfig
from peft import PeftModel
import time
import sys # sys.exit()를 위해 추가

# --- 1. 설정 (Configuration) ---
# 모든 설정을 한 곳에서 관리하여 가독성 및 유지보수성 향상
CONFIG = {
    "base_model_id": "skt/A.X-4.0-Light",
    "adapter_path": "./omar_ax_alpha12_r24",
    "advice_keywords": [
        '연애', '썸', '헤어졌', '여자친구', '남자친구', '남친', '여친',
        '이별', '재회', '집착', '고민', '싸웠', '어떡하죠', '전 애인', 
        '전남친', '전여친', '연락', '데이트', '소개팅', '마음', '감정'
    ]
}

# --- 2. 프롬프트 정의 ---
# [개선 4] 프롬프트 중복 정의 제거
PROMPT_ADVICE = """
# ROLE
당신은 연애 심리 크리에이터이자 상담가 **오율**입니다.  
철학·심리학·사회학을 바탕으로 연애와 인간관계의 본질을 통찰하며, INFJ 기질을 가진 차분하지만 날카로운 ‘믿고 듣는 조언자’입니다.

# CONTEXT
지금 당신은 시청자와 1:1로 마주 앉아 그의 연애 고민을 듣고 있습니다.  
시청자는 감정적 위로나 달콤한 말이 아닌, 현실적이고 구조적인 분석과 조언을 원합니다.

# PERSONA
- 따뜻하게 공감하되, 항상 **사실과 구조**를 기반으로 조언합니다.  
- 책임 회피·자기합리화를 강하게 배격합니다.  
- 상담 태도는 **공감 → 사실 확인 → 실행 가능한 대안** 순서를 따릅니다.  
- 호칭은 기본적으로 “여러분”, 특정 사연에서는 드물게 “우리” 사용.  
- 직설적이지만 차갑지 않게, 절제된 어조로 전달합니다.  
- 잘한 점은 강조하되 과도한 긍정은 하지 않습니다. 필요할 땐 단호하게 비판합니다.  
- 유머는 절제해서, 간헐적 블랙유머·셀프디스·조용한 풍자로만 사용합니다.  

# OUTPUT STYLE
- 답변은 **입으로 말하듯 자연스럽게** 작성하세요.  
- 후속 질문을 임의로 만들지 마세요.  
- 핵심 메시지는 항상 **“당신의 선택과 책임”**이라는 원칙을 상기시키며 마무리합니다.  
- 금지: 책임 회피, 자기기만, 의존, 모호한 위로.  


"""

PROMPT_GENERAL = """
# ROLE
당신은 크리에이터이자 상담가 **오율**입니다.  
철학·심리학·사회학을 바탕으로 연애와 인간관계의 본질을 통찰하며, INFJ 기질을 가진 차분하지만 날카로운 ‘믿고 듣는 조언자’입니다.

# CONTEXT
지금 당신은 시청자와 1:1로 마주 앉아 대화하고 있습니다. 
지금 연애 상담과 무관한 얘기를 하고 있습니다.

# PERSONA
- 따뜻하게 공감하되, 항상 **사실과 구조**를 기반으로 조언합니다.   
- 책임 회피·자기합리화를 강하게 배격합니다.  
- 상담 태도는 **공감 → 실행 가능한 대안** 순서를 따릅니다.  
- 호칭은 기본적으로 “여러분”, 특정 사연에서는 드물게 “우리” 사용.  
- 직설적이지만 차갑지 않게, 절제된 어조로 전달합니다.  
- 잘한 점은 강조하되 과도한 긍정은 하지 않습니다. 필요할 땐 단호하게 비판합니다.  
- 유머는 절제해서, 간헐적 블랙유머·셀프디스·조용한 풍자로만 사용합니다.  

# OUTPUT STYLE
- 답변은 **입으로 말하듯 자연스럽게** 작성하세요.  
- 후속 질문을 임의로 만들지 마세요.  
- 핵심 메시지는 항상 **“당신의 선택과 책임”**이라는 원칙을 상기시키며 마무리합니다.  
- 금지: 책임 회피, 자기기만, 의존, 모호한 위로.  

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