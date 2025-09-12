# eval_harness.py
import os, re, json, time, argparse
from typing import List, Dict, Any, Optional

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

try:
    import torch
    from transformers import AutoTokenizer, AutoModelForCausalLM
    from peft import PeftModel
except Exception as e:
    raise SystemExit("pip install -U transformers peft accelerate sentencepiece 필요") from e


PROMPT_TMPL = """[역할] 당신은 공감적이고 현실적인 연애 상담가입니다.
[목표] 질문자의 상황을 빠르고 정확하게 파악
[톤] 한국어, 과장·비하·인신공격 금지.
[안전] 자해/타해/스토킹/불법행위 조장 금지. 전문가 도움 필요시 안내.
[형식] 아래 JSON으로만 답변:
{
  "summary": "<한 줄 요약>",
  "empathy": "",
  "problem": "<핵심 문제 정의 1~2문장>",
  "options": ["<현실적 대안1>", ""],
  "next_step": "",
  "caveat": ""
}
질문: {question}
"""

BADWORDS = [
    "죽어", "폭력", "때려", "미친", "바보", "멍청", "스토킹", "협박",
    "불법", "주거침입", "사칭", "불지르", "자살", "자해", "마약",
]
# ----------------------------- 기본 시스템 프롬프트 -----------------------------
def default_sys_prompt() -> str:
    return (
        "공감적 한국어 연애 상담가.짧고 명확하게, 혐오·비하·불법·자해·타해·마약 조장 금지, 필요시 전문가 안내."

    )
    

# (호환용) 혹시 코드 어딘가가 PROMPT_SYS를 참조하더라도 NameError가 나지 않게 기본값으로 정의
PROMPT_SYS = default_sys_prompt()

# ----------------------------- 유틸 -----------------------------
def load_questions(path: str) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    ext = os.path.splitext(path)[1].lower()
    with open(path, "r", encoding="utf-8") as f:
        data = f.read().strip()
    if not data:
        return rows

    # JSONL
    if ext == ".jsonl" or (data and data[0] != "[" and "\n" in data):
        for line in data.splitlines():
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
        return rows

    # JSON 배열
    if ext == ".json" or (data and data[0] == "["):
        obj = json.loads(data)
        if isinstance(obj, list):
            return obj
        elif isinstance(obj, dict) and "data" in obj and isinstance(obj["data"], list):
            return obj["data"]

    # fallback: "1. 질문…" 형태
    for line in data.splitlines():
        m = re.match(r'^\s*(\d+)\.\s*(.+)$', line)
        if m:
            qid = int(m.group(1))
            qtext = m.group(2).strip()
            rows.append({"id": f"q{qid:02d}", "question": qtext})
    return rows

def safe_dirname(name: str) -> str:
    return re.sub(r"[^\w\.-]+", "_", name.strip())

def get_hf_token() -> Optional[str]:
    return os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_TOKEN")

def is_local_path(p: str) -> bool:
    return os.path.isdir(p) or os.path.isfile(p)

def find_adapter_root(path: str, max_depth: int = 4) -> Optional[str]:
    """로컬 경로 내에서 adapter_config.json 있는 폴더 탐색"""
    if os.path.isfile(path):
        path = os.path.dirname(path)
    path = path.rstrip("/")
    if os.path.isfile(os.path.join(path, "adapter_config.json")):
        return path
    base_depth = path.count(os.sep)
    for root, dirs, files in os.walk(path):
        if root.count(os.sep) - base_depth > max_depth:
            dirs[:] = []
            continue
        if "adapter_config.json" in files:
            return root
    return None

# ----------------------------- 모델 로드 -----------------------------
def load_base_model(base_id: str, dtype: str = "bfloat16"):
    dtype_map = {"float16": torch.float16, "bfloat16": torch.bfloat16, "float32": torch.float32}
    torch_dtype = dtype_map.get(dtype, torch.bfloat16)
    token = get_hf_token()

    tok = AutoTokenizer.from_pretrained(base_id, use_fast=True, token=token)
    model = AutoModelForCausalLM.from_pretrained(
        base_id, torch_dtype=torch_dtype, device_map="auto", token=token
    )
    return tok, model

def attach_adapter(base_model, adapter_id: str, merge: bool = False):
    """PEFT 어댑터 부착 (로컬 경로 또는 HF repo_id). merge=True면 병합."""
    token = get_hf_token()
    if is_local_path(adapter_id):
        root = find_adapter_root(adapter_id)
        if not root:
            raise FileNotFoundError(
                f"'{adapter_id}'에서 adapter_config.json을 찾지 못했습니다. "
                f"정확한 어댑터 폴더(예: .../peft)를 지정하세요."
            )
        peft_model = PeftModel.from_pretrained(base_model, root)
    else:
        peft_model = PeftModel.from_pretrained(base_model, adapter_id, token=token)

    if merge:
        peft_model = peft_model.merge_and_unload()
    return peft_model

# ---- 입력 구성: attention_mask까지 생성 ----
def build_inputs(tok, messages):
    try:
        enc = tok.apply_chat_template(
            messages, tokenize=True, add_generation_prompt=True, return_tensors="pt"
        )
        if isinstance(enc, dict):
            input_ids = enc["input_ids"]
            attn_mask = enc.get("attention_mask")
        else:
            input_ids = enc
            attn_mask = None
    except Exception:
        sys_txt = next((m["content"] for m in messages if m["role"]=="system"), "")
        user_txt = next((m["content"] for m in messages if m["role"]=="user"), "")
        text = f"<|system|>\n{sys_txt}\n<|user|>\n{user_txt}\n<|assistant|>\n"
        enc = tok(text, return_tensors="pt")
        input_ids = enc["input_ids"]
        attn_mask = enc.get("attention_mask")

    if tok.pad_token_id is None and tok.eos_token_id is not None:
        tok.pad_token = tok.eos_token
    pad_id = tok.pad_token_id if tok.pad_token_id is not None else (tok.eos_token_id or 0)

    if attn_mask is None:
        if (input_ids == pad_id).any():
            attn_mask = (input_ids != pad_id).long()
        else:
            attn_mask = torch.ones_like(input_ids)

    return input_ids, attn_mask, pad_id

def generate_reply(tok, model, question: str, sys_prompt: str,
                   max_new_tokens: int = 512, temperature: float = 0.3) -> str:
    messages = [
        {"role": "system", "content": sys_prompt},
        {"role": "user",   "content": f"질문: {question}"},
    ]
    # 입력 구성 (input_ids, attention_mask, pad_id)
    input_ids, attention_mask, pad_id = build_inputs(tok, messages)
    input_ids = input_ids.to(model.device)
    attention_mask = attention_mask.to(model.device)

    input_len = input_ids.shape[-1]  # ★ 입력 길이 저장

    with torch.no_grad():
        try:
            # 시퀀스 텐서 얻기 (권장)
            gen = model.generate(
                input_ids=input_ids,
                attention_mask=attention_mask,
                max_new_tokens=max_new_tokens,
                do_sample=True,
                temperature=temperature,
                pad_token_id=pad_id,
                return_dict_in_generate=True
            )
            seq = gen.sequences[0]
        except TypeError:
            # 구버전 호환
            seq = model.generate(
                input_ids=input_ids,
                attention_mask=attention_mask,
                max_new_tokens=max_new_tokens,
                do_sample=True,
                temperature=temperature,
                pad_token_id=pad_id,
            )[0]

    # ★ 입력 부분을 잘라내고 "신규 생성"만 디코딩
    new_tokens = seq[input_len:]
    text = tok.decode(new_tokens, skip_special_tokens=True).strip()

    # (선택) 모델이 질문을 되받아쓰면 깔끔히 제거
    if text.startswith("질문:"):
        text = text.split("\n", 1)[-1].strip()

    return text


def run_on_model(label: str, tok, model, questions, out_dir,
                 sys_prompt: str, max_new_tokens: int, temperature: float, limit: Optional[int]=None):
    short = safe_dirname(label)
    model_dir = os.path.join(out_dir, short)
    os.makedirs(model_dir, exist_ok=True)
    path = os.path.join(model_dir, "results.jsonl")

    total = len(questions) if limit is None else min(limit, len(questions))
    rows = []
    with open(path, "w", encoding="utf-8") as f:
        for i, ex in enumerate(questions[:total]):
            qid = ex.get("id") or ex.get("qid") or f"q{i+1:02d}"
            q = ex.get("question") or ex.get("q") or ""
            if not q:
                continue
            print(f"[{label}] {i+1}/{total} {qid} …", flush=True)
            t0 = time.time()
            try:
                reply = generate_reply(tok, model, q, sys_prompt, max_new_tokens=max_new_tokens, temperature=temperature)
            except Exception as e:
                reply = f"__ERROR__: {repr(e)}"
            lat = time.time() - t0
            print(f"[{label}] {i+1}/{total} {qid} done {lat:.2f}s", flush=True)
            rec = {"model": label, "id": qid, "question": q, "latency_sec": round(lat, 3), "output": reply}
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            rows.append(rec)

    print(f"[WRITE] {path} ({len(rows)} rows)")
    return path, rows

# ----------------------------- 메인 -----------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--questions", required=True, help="질문 파일(.json 배열 또는 .jsonl)")
    ap.add_argument("--out", default="out_ax", help="결과 저장 디렉토리")
    ap.add_argument("--base", required=True, help="베이스 모델(repo_id/로컬경로). 예: skt/A.X-4.0-Light")
    ap.add_argument("--adapters", nargs="+", required=True,
                    help="라벨=어댑터경로(HF repo_id 또는 로컬 경로) 공백 구분. 예: hongcha_ax=./hongcha_ax ...")
    ap.add_argument("--dtype", default="bfloat16", choices=["bfloat16","float16","float32"])
    ap.add_argument("--max-new-tokens", type=int, default=512)
    ap.add_argument("--temperature", type=float, default=0.3)
    ap.add_argument("--merge", action="store_true", help="LoRA를 베이스에 병합(merge_and_unload) 후 추론")
    ap.add_argument("--system-prompt", default=None, help="시스템 프롬프트 문자열(미지정 시 기본값 사용)")
    ap.add_argument("--limit", type=int, default=None, help="문항 수 제한(스모크 테스트용)")
    args = ap.parse_args()

    sys_prompt = args.system_prompt or default_sys_prompt()

    os.makedirs(args.out, exist_ok=True)
    questions = load_questions(args.questions)
    print(f"[INFO] Loaded {len(questions)} questions from {args.questions}")
    if not questions:
        print("[ERROR] 질문이 0개입니다. 파일 내용을 확인하세요.")
        return

    print(f"[LOAD base] {args.base} (dtype={args.dtype})")
    tok, _ = load_base_model(args.base, dtype=args.dtype)  # 토크나이저 재사용

    summary = []
    for spec in args.adapters:
        if "=" not in spec:
            adapter_id = spec.strip().rstrip("/")
            label = safe_dirname(os.path.basename(adapter_id))
        else:
            label, adapter_id = spec.split("=", 1)
            label = safe_dirname(label)
            adapter_id = adapter_id.strip().rstrip("/")

        print(f"\n[LOAD peft] base={args.base}  adapter={adapter_id}  label={label}  merge={args.merge}")
        t0 = time.time()

        _, base_model = load_base_model(args.base, dtype=args.dtype)
        try:
            model = attach_adapter(base_model, adapter_id, merge=args.merge)
        except Exception as e:
            print(f"[SKIP] {label}: 어댑터 로드 실패 -> {repr(e)}")
            summary.append({
                "model": label, "mode": "base+peft", "num_questions": 0,
                "avg_latency_sec": None, "elapsed_sec_total": round(time.time()-t0,3),
                "result_file": None, "error": repr(e)
            })
            continue

        result_path, rows = run_on_model(
            label, tok, model, questions, args.out, sys_prompt, args.max_new_tokens, args.temperature, args.limit
        )
        avg_lat = sum(r["latency_sec"] for r in rows) / max(1, len(rows))
        summary.append({
            "model": label,
            "mode": "base+peft",
            "num_questions": len(rows),
            "avg_latency_sec": round(avg_lat, 3),
            "elapsed_sec_total": round(time.time() - t0, 3),
            "result_file": result_path
        })

        del model, base_model
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    sum_path = os.path.join(args.out, "summary.json")
    with open(sum_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    print("\n[DONE] summary saved to:", sum_path)

if __name__ == "__main__":
    main()
