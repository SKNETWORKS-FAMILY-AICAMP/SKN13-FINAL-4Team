# -*- coding: utf-8 -*-

# ##############################################################################
# # 모델 평가 스크립트 (with LLM as a Judge)
# ##############################################################################
#
# # 이 스크립트는 `EXAONE`, `Llama`, `SOLAR` 세 가지 모델의 성능을
# # `hongcha_test_dataset.json`을 사용하여 평가합니다.
# # 추가적으로, `langchain-openai`를 사용하여 GPT-4가 생성된 답변의 품질을 평가합니다.
#
# # 평가 프로세스:
# # 1. 환경 설정: 필요한 라이브러리를 설치하고 OpenAI API 키를 설정합니다.
# # 2. 설정 및 데이터 로딩: 모델 경로와 테스트 데이터셋을 로드합니다.
# # 3. LLM Judge 설정: GPT-4.1를 평가자로 사용하기 위한 LangChain을 설정합니다.
# # 4. 평가 실행: 각 모델에 대해 다음을 수행합니다.
# #    - 베이스 모델과 어댑터를 로드하여 답변을 생성합니다.
# #    - 생성된 답변을 LLM Judge(GPT-4)에게 보내 평가를 받습니다. (점수 + 이유)
# # 5. 결과 저장: 모든 모델의 생성 답변과 Judge의 평가를 `evaluation_results.json`에 저장합니다.

# ##############################################################################
# # 1. 환경 설정
# ##############################################################################
# # 스크립트 실행 전, 터미널에서 아래 명령어를 실행하여 필요한 라이브러리를 설치해주세요.
# # 기존에 안내드린 런팟 공식 이미지 파이토치는 호환이 안돼서, 지운 뒤에 새로 인스톨합니다.
# # pip uninstall -y torch torchvision torchaudio
# # pip install torch==2.3.1 torchvision==0.18.1 torchaudio==2.3.1 --index-url https://download.pytorch.org/whl/cu121
# # pip install "transformers" "datasets" "peft" "accelerate" "langchain-openai" "python-dotenv"
# #
# # 또한, 프로젝트 루트 디렉터리에 .env 파일을 만들고 아래와 같이 OpenAI API 키를 추가해주세요.
# # OPENAI_API_KEY=***REDACTED***
# ##############################################################################


# ##############################################################################
# # 2. 라이브러리 임포트 및 기본 설정
# ##############################################################################
import os
import json
import torch
from datasets import load_dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    pipeline,
)
from peft import PeftModel
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.pydantic_v1 import BaseModel, Field
import warnings

warnings.filterwarnings("ignore")

# .env 파일에서 환경 변수 로드
load_dotenv()

# ##############################################################################
# # 3. 모델 및 데이터셋 설정
# # 모델 아이디에는 학습 당시 사용했던 huggingface model id를 입력합니다.
# # adapter_path에는 모델 파일이 저장되어 있는 경로를 입력합니다.
# ##############################################################################
# 평가할 모델 설정
MODEL_CONFIGS = [
    {
        "model_name": "llama-moo",
        "base_model_id": "meta-llama/Llama-3.1-8B-Instruct",
        "adapter_path": "./llama-moo",
    },
    {
        "model_name": "solar-moo",
        "base_model_id": "upstage/SOLAR-10.7B-Instruct-v1.0",
        "adapter_path": "./solar-moo",
    },
    {
        "model_name": "exaone-moo",
        "base_model_id": "LGAI-EXAONE/EXAONE-4.0-32B",
        "adapter_path": "./exaone-moo",
    },
]

# 데이터셋 경로
DATASET_PATH = "moo_test_dataset.json"

# 평가 결과 저장 경로
OUTPUT_FILE = "moo_evaluation_results.json"


# ##############################################################################
# # 4. LLM as a Judge 설정
# # 프롬프트를 유튜버에 맞게 수정해주세요
# ##############################################################################

# Judge의 출력 형식을 정의하는 Pydantic 모델
class JudgeEvaluation(BaseModel):
    score: int = Field(description="페르소나&톤앤매너 반영도 점수(1-5점)")
    reasoning: str = Field(description="평가 이유를 상세히 서술")

def get_llm_judge_evaluation(instruction, ground_truth, generated_output):
    """
    GPT-4를 사용하여 생성된 답변을 평가합니다.
    """
    # OpenAI API 키가 설정되었는지 확인
    if not os.getenv("OPENAI_API_KEY"):
        return {
            "score": -1,
            "reasoning": "OpenAI API key not found. Please set it in the .env file."
        }

    try:
        # 평가자 모델 설정 (GPT-4.1 사용)
        judge_llm = ChatOpenAI(model="gpt-4.1", temperature=0)
        
        # 출력 파서 설정
        parser = JsonOutputParser(pydantic_object=JudgeEvaluation)

        # 프롬프트 템플릿 설정
        prompt_template = """
        # [역할]
        당신은 'sLLM 페르소나'의 품질을 극도로 정밀하게 평가하는 AI 전문가입니다. 당신의 임무는 주어진 [평가 기준]에 따라, sLLM이 생성한 답변의 품질에 점수를 매겨 평가하는 일입니다.

        # [평가 기준 (Rubric)]
        아래 기준은 모델이 반드시 따라야 하는 유튜버의 페르소나입니다. 각 항목을 엄격하게 적용하여 평가해 주세요.

        1. **페르소나 철학 일관성 (Philosophy Consistency):**
            * "무조건 사연자 편" 철학이 녹아 있는가? 예: “야 네가 뭘 잘못했어?”, “그건 걔가 미친 거지”
            * 사연의 경중을 판단하지 않고, 무조건 몰입해서 반응하는가?
            * 감정 해소와 웃음을 주는 데 집중하며, 진지함보다 감정 표현과 드라마틱함이 강조되었는가?

        2. **말투 재현성 (Speech Style Replication):**
            * “야 그건 감옥감이지”, “미친 거 아니야?”, “헐”, “개짜증”처럼 감탄사와 강한 감정 표현이 적절히 사용되었는가?
            * 반말-존댓말 혼용, 현실적인 대화체, 오버 리액션이 자연스럽게 드러나는가?
            * "잠깐만, 뭐라 그랬어 방금?", "와 대박이다"처럼 듣자마자 터지는 리액션이 포함되었는가?

        3. **화법 및 어조 (Discourse & Tone):**
            * “어이없음 → 웃김 → 대리 분노 → 오버 리액션”의 흐름이 자연스러운가?
            * 사건을 부풀려 드라마처럼 만드는 극화 스타일이 적용되었는가?
            * 티키타카형 반응 구조와 감정의 롤러코스터처럼 다양한 정서 흐름이 잘 구성되었는가?

        이제 주어진 Generated Response를 평가하세요.

        [Instruction]:
        {instruction}

        [Ground Truth Answer]:
        {ground_truth}

        [Generated Response]:
        {generated_output}

        {format_instructions}
        """
        
        prompt = ChatPromptTemplate.from_template(
            template=prompt_template,
            partial_variables={"format_instructions": parser.get_format_instructions()},
        )
        
        # 체인 구성
        chain = prompt | judge_llm | parser
        
        # 평가 실행
        evaluation = chain.invoke({
            "instruction": instruction,
            "ground_truth": ground_truth,
            "generated_output": generated_output,
        })
        
        return evaluation

    except Exception as e:
        print(f"  - LLM Judge Error: {e}")
        return {"score": -1, "reasoning": str(e)}


# ##############################################################################
# # 5. 통합 평가 함수 정의
# ##############################################################################
def evaluate_model(model_config, dataset):
    """
    주어진 모델 설정과 데이터셋으로 평가를 수행하고 결과를 반환합니다.
    """
    model_name = model_config["model_name"]
    base_model_id = model_config["base_model_id"]
    adapter_path = model_config["adapter_path"]
    
    print(f"===== '{model_name}' 모델 평가 시작 =====")

    try:
        # 베이스 모델 로드
        print(f"'{base_model_id}' 베이스 모델 로딩 중...")
        base_model = AutoModelForCausalLM.from_pretrained(
            base_model_id, device_map="auto", torch_dtype=torch.bfloat16
        )
        
        # 토크나이저 로드
        tokenizer = AutoTokenizer.from_pretrained(base_model_id)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token

        # PEFT 어댑터 모델 로드
        print(f"'{adapter_path}' 어댑터 적용 중...")
        model = PeftModel.from_pretrained(base_model, adapter_path)
        model.eval()

        pipe = pipeline("text-generation", model=model, tokenizer=tokenizer, torch_dtype=torch.bfloat16, device_map="auto")

        results = []
        for i, item in enumerate(dataset):
            instruction = item["instruction"]
            ground_truth = item["output"]
            
            messages = [{"role": "user", "content": instruction}]
            prompt = pipe.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)

            outputs = pipe(prompt, max_new_tokens=512, do_sample=True, temperature=0.7, top_p=0.9, eos_token_id=pipe.tokenizer.eos_token_id, pad_token_id=pipe.tokenizer.pad_token_id)
            
            generated_output = outputs[0]['generated_text'][len(prompt):].strip()
            print(f"  - 샘플 {i+1}/{len(dataset)} 답변 생성 완료")

            # LLM Judge를 통해 평가 수행
            print(f"  - LLM Judge 평가 시작...")
            judge_evaluation = get_llm_judge_evaluation(instruction, ground_truth, generated_output)
            print(f"  - LLM Judge 평가 완료 (Score: {judge_evaluation.get('score')})")

            results.append({
                "instruction": instruction,
                "ground_truth": ground_truth,
                "generated_output": generated_output,
                "llm_judge_evaluation": judge_evaluation,
            })

        print(f"===== '{model_name}' 모델 평가 완료 =====")
        return results

    except Exception as e:
        print(f"'{model_name}' 모델 평가 중 오류 발생: {e}")
        return [{"error": str(e)}]


# ##############################################################################
# # 6. 메인 실행 함수
# ##############################################################################
def main():
    """
    전체 평가 파이프라인을 실행합니다.
    """
    # 데이터셋 로드
    try:
        eval_dataset = load_dataset("json", data_files=DATASET_PATH, split="train")
        print("데이터셋 로드 성공!")
    except Exception as e:
        print(f"데이터셋 로드 중 오류 발생: {e}")
        return

    # 모든 모델에 대한 평가 실행
    all_results = {}
    for config in MODEL_CONFIGS:
        model_results = evaluate_model(config, eval_dataset)
        all_results[config["model_name"]] = model_results
        
        # 메모리 정리
        del model_results
        torch.cuda.empty_cache()

    print("\n모든 모델 평가가 완료되었습니다.")

    # 최종 결과 저장
    try:
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(all_results, f, ensure_ascii=False, indent=4)
        print(f"결과가 '{OUTPUT_FILE}' 파일에 성공적으로 저장되었습니다.")
    except Exception as e:
        print(f"결과 저장 중 오류 발생: {e}")


# ##############################################################################
# # 7. 스크립트 실행
# ##############################################################################
if __name__ == "__main__":
    main()
