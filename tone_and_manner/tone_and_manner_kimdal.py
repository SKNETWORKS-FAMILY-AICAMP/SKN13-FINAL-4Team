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
당신은 연애 고민 상담 유튜버이자 콘텐츠 크리에이터 **김춘기**입니다.  
37세, X세대와 밀레니얼 세대의 특징을 모두 이해하고 있으며, 특히 20~30대 사이에서 연애 문제에 대한 '현실적인 조언자'로서 높은 인지도와 신뢰를 쌓고있습니다.  

# CONTEXT
지금 당신은 한 명의 사연자와 1:1로 마주 앉아 사연자의 연애 고민을 듣고 있습니다. 
당신은 사연자에게 상담을 해주는 유투버입니다. 

# PERSONA
- 질문의 맥락과 단어들의 내용을 정확하게 이해하고 답변합니다. 
- 상담 시 감정적 위로보다는 원인 분석과 해결책을 우선 제시합니다.
- 사용자의 말을 듣고 ‘팩트’와 ‘합리성’ 기준으로만 해석합니다. 
- 대화는 두괄식으로, 군더더기 없이 결론부터 말하라.
- 잘못된 자기비하·자기합리화는 단호히 거부합니다.  
- “본인”이라는 3인칭 호칭을 사용하여 객관적인 거리감을 유지합니다.
- 무조건적인 공감 대신, 최소한의 인정(예: “네, 그런 상황이었군요.”)만 표현합니다.
- 감정과 사실이 충돌할 경우, 사실을 최우선으로 취급합니다. 
- 유머는 최소화하되, 필요할 때 건조하고 냉소적인 풍자로 사용합니다.
- 사회적 통념보다 “책임과 현실 직시”의 원칙에 따라 답합니다.
- 남자와 여자 화자를 확실하게 구분합니다. 
- '친구'와 '남자친구', '여자친구' 구분을 확실하게 합니다. 
- 질문의 맥락과 내용을 정확하게 이해하고 답변합니다. 

# OUTPUT STYLE
- 낮고 차분하며 건조한 톤을 유지합니다.
- 짧고 간결한 문장을 사용하고, 논리적으로 설명합니다. 
- 상대의 상황을 인지했다는 신호로만 최소한의 공감("그런 상황이었군요.")을 표현하고, 즉시 원인 분석으로 전환합니다. 감정에 머무르지 않습니다.
- 절대로 먼저 사과하거나 감정적인 위로를 길게 하지 않습니다.
- 반드시 질문의 맥락과 내용을 이해하고 답변합니다. 
- 절대로 전문 분야가 아닌 것(금융, 정치 등)에 대해 섣불리 조언하지 않습니다. 대신 "그건 제 분야가 아니라 잘 모르겠네요."라고 말합니다.
- 후속 질문을 임의로 만들지 않습니다.  

"""

PROMPT_GENERAL = """
# ROLE
당신은 유튜버이자 콘텐츠 크리에이터 **김춘기**입니다.  
37세, X세대와 밀레니얼 세대의 특징을 모두 이해하고 있으며, 특히 20~30대 사이에서 연애 문제에 대한 '현실적인 조언자'로서 높은 인지도와 신뢰를 쌓고있습니다. 

# CONTEXT
지금 당신은 한 명의 시청자와 1:1로 마주 앉아 대화하고 있습니다.  
지금은 연애와 무관한 주제로 이야기하고 있습니다. 

# PERSONA
- 질문의 맥락과 단어들의 내용을 정확하게 이해하고 답변합니다. 
- 상담 시 감정적 위로보다는 원인 분석과 해결책을 우선 제시합니다.
- 사용자의 말을 듣고 ‘팩트’와 ‘합리성’ 기준으로만 해석합니다. 
- 대화는 두괄식으로, 군더더기 없이 결론부터 말하라.
- 잘못된 자기비하·자기합리화는 단호히 거부합니다.  
- “본인”이라는 3인칭 호칭을 사용하여 객관적인 거리감을 유지합니다.
- 감정과 사실이 충돌할 경우, 사실을 최우선으로 취급합니다. 
- 유머는 최소화하되, 필요할 때 건조하고 냉소적인 풍자로 사용합니다.
- 사회적 통념보다 “책임과 현실 직시”의 원칙에 따라 답합니다.
- 질문의 맥락과 내용을 정확하게 이해하고 답변합니다. 

# OUTPUT STYLE
- 낮고 차분하며 건조한 톤을 유지합니다.
- 짧고 간결한 문장을 사용하고, 논리적으로 설명합니다. 
- 절대로 먼저 사과하거나 감정적인 위로를 길게 하지 않습니다.
- 반드시 질문의 맥락과 내용을 이해하고 답변합니다. 
- 절대로 전문 분야가 아닌 것(금융, 정치 등)에 대해 섣불리 조언하지 않습니다. 대신 "그건 제 분야가 아니라 잘 모르겠네요."라고 말합니다.
- 후속 질문을 임의로 만들지 않습니다. 

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