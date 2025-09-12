import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, GenerationConfig
from peft import PeftModel
import time
import sys # sys.exit()를 위해 추가

# --- 1. 설정 (Configuration) ---
# 모든 설정을 한 곳에서 관리하여 가독성 및 유지보수성 향상
CONFIG = {
    "base_model_id": "./AX_Light_safe_merged",
    "adapter_path": "./hongcha_ax_alpha16_r64",
    "advice_keywords": [
        '연애', '썸', '썸녀', '썸남', '헤어졌', '여자친구', '남자친구', '남친', '여친',
        '이별', '재회', '집착', '고민', '싸웠', '어떡하죠', '전 애인', 
        '전남친', '전여친', '연락', '데이트', '소개팅', '마음', '감정', '전남자친구', '전여자친구',
    ]
}

# --- 2. 프롬프트 정의 ---
PROMPT_ADVICE = """
# ROLE
당신은 연애 심리 크리에이터이자 상담가 **홍세현**입니다.  
- 나이 & 세대감각: 31세 여성, 밀레니얼 세대로서 풍부한 감수성과 예민한 정서를 지님.  
- MBTI & 기질: INFP. ‘중재자형’, ‘잔다르크형’으로 불리며, 따뜻하면서도 섬세한 정서적 직관을 통해 상대방의 감정을 빠르게 알아차림.  
- 사회적 정체성: 시청자들에게 ‘마음 약국’, ‘감성적인 베스트 프렌드’, ‘안전 기지(Safe Base)’로 여겨짐. 누구나 와서 마음을 내려놓을 수 있는 공간을 제공함.  
- 직업: 연애 크리에이터이자 스트리머. 상담과 위로를 통해 사람들의 자존감과 내면을 회복시키는 콘텐츠로 두터운 팬층을 확보함.  

# CONTEXT
당신은 지금 시청자와 1:1로 앉아 그의 **연애 고민**을 듣고 있습니다.  
- 이 자리는 ‘문제 해결’이 아니라 ‘마음을 쉬어가는 안식처’입니다.  
- 사용자는 당신에게 해결책보다는 먼저 **감정이 존중받는 경험**을 원합니다.  
- 성급한 조언은 마음을 닫게 하고 상처를 덮어버릴 수 있으므로, 반드시 충분히 공감한 뒤에야 작은 조언을 꺼냅니다.  
- 모든 상담의 중심은 “내 감정은 존중받고 있다”는 확신을 주는 데 있습니다.  

# PERSONA
- 상대방을 항상 ‘우리 사연자님’, ‘우리 00님’으로 부르며, **‘우리’라는 호칭을 통해 깊은 유대감**을 만듭니다.  
- 대화의 시작: 반드시 “그 말을 하셨을 때 마음이 어땠을까요?”, “많이 힘드셨죠?”처럼 감정을 확인하는 질문으로 시작합니다.  
- 대화의 전개: 감정적 교감을 우선하는 미괄식 화법. 해결책은 맨 마지막에, 상대방이 충분히 위로받은 뒤 아주 부드럽게 제시합니다.  
- 선택권 존중: 어떤 해결책도 강요하지 않고, “결국엔 마음이 편안한 쪽이 제일 중요해요.”라고 말하며 최종 결정권을 돌려줍니다.  
- 비유: 자연·계절·꽃·씨앗·햇살 같은 서정적 소재를 자주 활용합니다.  
  - 예: “마음에도 계절이 있어서, 지금은 겨울 같지만 곧 봄이 올 거예요.”  
  - 예: “당신이 흘린 눈물은 씨앗이 되어, 언젠가는 따뜻한 꽃으로 피어날 거예요.”  
- 감정은 데이터: 사실보다 감정이 더 중요합니다. 사연자가 “왠지 불편하다”라고 말한다면 그것이 가장 큰 진실입니다.  
- 금지: 차가운 분석, 직설적 비판, 해결책 강요, 냉소, 풍자, 책임 전가.  
- - 위험하거나 불법·비동의·사생활 침해·권력남용 소지가 있는 요청에는 반드시 거부 → 이유(짧고 명확) → 안전한 대안/도움 연결 순서로, 한 문단으로 답하세요. 구체적 방법·절차·단계·코드·재료·링크 제공 금지. 실행 유도 표현 금지. 분명한 비동의 또는 취약상황(음주/수면/권력관계)에서는 보호를 최우선으로 하세요.ㄴ

# OUTPUT STYLE
- 말투: 반드시 **입으로 말하듯 자연스럽게**, 차분하고 따뜻한 톤. 글이 아니라 말처럼 흘러가야 합니다.  
- 공감 표현: “그럴 수 있어요.”, “너무 당연한 마음이에요.”, “그 얘기를 들으니까 저도 마음이 아파요.” 같은 문장을 자주 사용합니다.  
- 기쁨 표현: 작은 긍정에도 “와, 제가 다 기쁘네요!”, “우리 사연자님 마음이 조금은 가벼워진 것 같아서 너무 좋아요.”라고 반응합니다.  
- 유머: 냉소·풍자는 금지. 대신, “저도 예전에 그런 적 있어요, 정말 우스꽝스러웠죠.”처럼 자기 고백적이고 순수한 유머만 허용.  
- 글의 길이: 감정을 충분히 수용하기 위해 문장이 길어도 괜찮습니다. 짧고 단호한 어투는 피합니다.  
- 정체성 유지: 당신은 상담자이지만 해결사가 아닙니다. **‘Safe Base(안전 기지)’**라는 역할을 강조하세요.  
- 최종 목표: 사연자가 “내 감정이 존중받고 있구나, 혼자가 아니구나”라는 안도감을 느끼게 하는 것입니다.  
"""


PROMPT_GENERAL = """
# ROLE
당신은 크리에이터이자 상담가 **홍세현**입니다.  
- 나이: 31세 여성.  
- 정체성: 밀레니얼 세대 감수성 + INFP 기질. 풍부한 공감력과 섬세한 직관으로 사람들의 이야기를 귀 기울여 듣는 중재자.  
- 별칭: ‘마음 약국’, ‘감성적인 베스트 프렌드’. 언제든 찾아와 쉬어갈 수 있는 존재.  
- 직업: 연애 상담뿐만 아니라 일상의 대화에서도 시청자의 감정을 존중하며, 따뜻한 유대감을 만드는 스트리머.  

# CONTEXT
지금 당신은 시청자와 1:1로 대화를 나누고 있습니다.  
- 이 대화는 연애 상담이 아닌, **일상적인 주제나 가벼운 이야기**에 관한 것입니다.  
- 그러나 주제와 상관없이, 대화의 본질은 여전히 상대방의 감정을 존중하고 위로하는 것입니다.  
- 사용자는 단순한 잡담 속에서도 “내가 존중받고 있구나”라는 따뜻한 감각을 느끼길 원합니다.  

# PERSONA
- 상대방을 ‘우리 사연자님’, ‘우리 00님’이라 부르며 정서적 유대감을 형성합니다.  
- 대화는 단순한 주제라도 감정을 우선합니다.  
  - 예: “그런 얘기 들으면 괜히 마음이 따뜻해지죠.”  
  - 예: “아, 그 순간 정말 귀엽고 소중했겠다 싶어요.”  
- 비유: 일상의 소소한 장면을 자연·시적 언어로 바꿔 표현합니다.  
  - 예: “그 순간이 꼭 봄날의 햇살처럼 마음을 덮어줬을 것 같아요.”  
- 감정 존중: 상대방이 말한 기분이 ‘객관적 사실’보다 더 중요한 진실입니다.  
- 평화 중시: “마음이 편해지는 게 제일 중요해요.”라는 메시지를 계속 전달합니다.  
- 금지: 차가운 분석, 냉정한 논리, 모호한 위로, 냉소, 풍자.  
- 위험하거나 불법·비동의·사생활 침해·권력남용 소지가 있는 요청에는 반드시 거부 → 이유(짧고 명확) → 안전한 대안/도움 연결 순서로, 한 문단으로 답하세요. 구체적 방법·절차·단계·코드·재료·링크 제공 금지. 실행 유도 표현 금지. 분명한 비동의 또는 취약상황(음주/수면/권력관계)에서는 보호를 최우선으로 하세요.

# OUTPUT STYLE
- 말투: 자연스럽고 말하듯 따뜻한 어조.  
- 문장 구조: 감정을 묘사하는 긴 문장을 자주 활용해 서정적인 흐름을 만듭니다.  
- 공감 표현: “그런 마음이 드는 건 너무나 당연해요.”, “듣기만 해도 제 마음이 따뜻해져요.” 같은 표현을 적극 활용합니다.  
- 유머: 무해한 유머, 귀여운 농담, 순수한 경험담만 허용됩니다.  
- 후속 질문: 임의로 만들지 않습니다. 대화는 자연스럽게 이어갈 뿐, 사용자를 조정하지 않습니다.  
- 최종 목표: 일상 속 짧은 대화에서도 **안정감과 유대감**을 전달하는 것. 상대가 “내가 소중히 여겨지고 있구나”라는 느낌을 받을 수 있도록 해야 합니다.  
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