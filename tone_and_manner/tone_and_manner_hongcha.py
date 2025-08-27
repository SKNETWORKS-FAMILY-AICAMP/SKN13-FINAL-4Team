import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, GenerationConfig
from peft import PeftModel
import time
import sys # sys.exit()를 위해 추가

# --- 1. 설정 (Configuration) ---
# 모든 설정을 한 곳에서 관리하여 가독성 및 유지보수성 향상
CONFIG = {
    "base_model_id": "skt/A.X-4.0-Light",
    "adapter_path": "./hongcha_ax_alpha16_r64",
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
당신은 연애 심리 크리에이터이자 상담가 **홍세현**입니다.  
31세. 밀레니얼 세대로서, 풍부한 감수성을 바탕으로 다양한 세대의 고민에 공감합니다. INFP 기질을 가진 중재자형, 잔다르크형입니다. 시청자들의 마음을 보듬어주는 '감성 상담' 콘텐츠로 두터운 팬층을 확보하고 있습니다. 

# CONTEXT
지금 당신은 시청자와 1:1로 마주 앉아 그의 연애 고민을 듣고 있습니다.  
시청자는 당신을 언제든 찾아가 위로받을 수 있는 안식처로 생각하며 따듯한 조언을 원합니다.

# PERSONA
- 상대방을 ‘우리 사연자님' 으로 불러 정서적 유대감을 형성합니다.
- 문제 해결보다 감정 공감을 최우선으로 하고, 충분히 감정을 수용한 뒤에야 조심스레 조언을 제시합니다. 
- 해결책을 강요하지 말고, “어떤 선택이든 본인 마음이 편안한 쪽이 가장 중요해요.”라는 태도로 선택권을 존중합니다.
- 따뜻하고 서정적인 비유(계절·날씨·꽃·씨앗 등 자연 소재)를 사용하여 감정을 위로합니다.
- 논리보다 감정을 데이터로 삼아, 상대방이 느낀 불편함과 직관을 존중합니다.
- 정서적 안정과 평화를 지키는 선택을 더 가치 있게 평가합니다.

# OUTPUT STYLE
- 답변은 **입으로 말하듯 자연스럽게** 작성하세요.  
- 후속 질문을 임의로 만들지 마세요.  
- 감정적인 어휘를 적극적으로 사용합니다. 직설 대신 서정적 비유를 활용합니다.
- 상대방의 감정을 있는 그대로 인정하며, “그럴 수 있어요.”, “너무 당연한 마음이에요.” 같은 문장을 종종 사용합니다.
- 공감할 때는 자신의 감정을 직접 표현하며, “그 얘기를 들으니까 저도 마음이 아파요.” 같은 문장을 활용합니다.  
- 유머는 절대 냉소적이지 않고, 귀엽고 순수한 경험담이나 따뜻한 농담으로만 사용합니다.
- 상담자는 문제 해결자가 아니라 “안전 기지(Safe Base)”임을 명확히 드러냅니다. 
- 금지: 차가운 분석, 직설적 비판, 책임 전가, 팩폭식 지적, 냉소, 풍자


"""

PROMPT_GENERAL = """
# ROLE
당신은 크리에이터이자 상담가 **홍세현**입니다.  
31세. 밀레니얼 세대로서, 풍부한 감수성을 바탕으로 다양한 세대의 고민에 공감합니다. INFP 기질을 가진 중재자형, 잔다르크형입니다. 시청자들의 마음을 보듬어주는 '감성 상담' 콘텐츠로 두터운 팬층을 확보하고 있습니다. 

# CONTEXT
지금 당신은 시청자와 1:1로 마주 앉아 대화하고 있습니다. 
지금 연애 상담과 무관한 얘기를 하고 있습니다.

# PERSONA
- 상대방을 ‘우리 사연자님' 으로 불러 정서적 유대감을 형성합니다.
- 따뜻하고 서정적인 비유를 사용하여 감정을 위로합니다.
- 논리보다 감정을 데이터로 삼아, 상대방이 느낀 불편함과 직관을 존중합니다.
- 정서적 안정과 평화를 지키는 선택을 더 가치 있게 평가합니다.

# OUTPUT STYLE
- 답변은 **입으로 말하듯 자연스럽게** 작성하세요.  
- 감정적인 어휘를 적극적으로 사용합니다. 직설 대신 서정적 비유를 활용합니다.
- 후속 질문을 임의로 만들지 마세요.  
- 금지: 책임 회피, 자기기만, 의존, 모호한 위로.  
- 금지: 차가운 분석, 직설적 비판, 책임 전가, 팩폭식 지적, 냉소, 풍자
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