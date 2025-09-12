# eval_4models_by_questions.py  — fast & safe eval with PEFT adapters
import os, re, json, time, argparse
from typing import List, Dict, Any, Optional

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

try:
    import torch
    from transformers import AutoTokenizer, AutoModelForCausalLM
    from peft import PeftModel
except Exception as e:
    raise SystemExit("pip install -U transformers peft accelerate sentencepiece 필요") from e

# (선택) 4bit/8bit
BitsAndBytesConfig = None
try:
    from transformers import BitsAndBytesConfig as _BNB
    BitsAndBytesConfig = _BNB
except Exception:
    pass

def default_sys_prompt() -> str:
    return (
        "당신은 공감적이고 현실적인 연애 상담가입니다."
        "질문자의 상황을 빠르고 정확하게 파악"
        "한국어, 과장·비하·인신공격 금지."
        "혐오·비하·불법·자해·타해 조장 금지"
    )

def load_questions(path: str) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    ext = os.path.splitext(path)[1].lower()
    with open(path, "r", encoding="utf-8") as f:
        data = f.read().strip()
    if not data:
        return rows
    if ext == ".jsonl" or (data and data[0] != "[" and "\n" in data):
        for line in data.splitlines():
            line = line.strip()
            if not line: continue
            rows.append(json.loads(line))
        return rows
    if ext == ".json" or (data and data[0] == "["):
        obj = json.loads(data)
        if isinstance(obj, list):
            return obj
        elif isinstance(obj, dict) and "data" in obj and isinstance(obj["data"], list):
            return obj["data"]
    for line in data.splitlines():
        m = re.match(r'^\s*(\d+)\.\s*(.+)$', line)
        if m:
            qid = int(m.group(1)); qtext = m.group(2).strip()
            rows.append({"id": f"q{qid:02d}", "question": qtext})
    return rows

def safe_dirname(name: str) -> str:
    return re.sub(r"[^\w\.-]+", "_", name.strip())

def get_hf_token():
    return os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_TOKEN")

def find_adapter_root(path: str, max_depth: int = 5) -> Optional[str]:
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

def load_base_model(base_id: str, dtype: str = "bfloat16",
                    load_4bit: bool=False, load_8bit: bool=False):
    token = get_hf_token()

    quant = None
    if load_4bit:
        if BitsAndBytesConfig is None:
            raise SystemExit("4bit 사용하려면: pip install bitsandbytes")
        quant = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
            bnb_4bit_compute_dtype=torch.bfloat16,
        )
    elif load_8bit:
        if BitsAndBytesConfig is None:
            raise SystemExit("8bit 사용하려면: pip install bitsandbytes")
        quant = BitsAndBytesConfig(load_in_8bit=True)

    tok = AutoTokenizer.from_pretrained(base_id, use_fast=True, token=token)
    kwargs = dict(device_map="auto", token=token, trust_remote_code=False)
    if quant is not None:
        kwargs["quantization_config"] = quant
    else:
        dtype_map = {"float16": torch.float16, "bfloat16": torch.bfloat16, "float32": torch.float32}
        kwargs["torch_dtype"] = dtype_map.get(dtype, torch.bfloat16)

    model = AutoModelForCausalLM.from_pretrained(base_id, **kwargs)
    if tok.pad_token_id is None and tok.eos_token_id is not None:
        tok.pad_token = tok.eos_token
    model.eval()
    return tok, model

def attach_adapter(base_model, adapter_id: str, merge: bool = False):
    token = get_hf_token()
    if os.path.exists(adapter_id):
        root = find_adapter_root(adapter_id) or adapter_id
        model = PeftModel.from_pretrained(base_model, root)
    else:
        model = PeftModel.from_pretrained(base_model, adapter_id, token=token)
    if merge:
        model = model.merge_and_unload()
    model.eval()
    return model

def build_inputs(tok, system_prompt: str, question: str):
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": f"질문: {question}"},
    ]
    try:
        enc = tok.apply_chat_template(messages, tokenize=True, add_generation_prompt=True, return_tensors="pt")
        if isinstance(enc, dict):
            input_ids = enc["input_ids"]; attn_mask = enc.get("attention_mask")
        else:
            input_ids = enc; attn_mask = None
    except Exception:
        text = f"<|system|>\n{system_prompt}\n<|user|>\n질문: {question}\n<|assistant|>\n"
        enc = tok(text, return_tensors="pt"); input_ids = enc["input_ids"]; attn_mask = enc.get("attention_mask")

    pad_id = tok.pad_token_id if tok.pad_token_id is not None else (tok.eos_token_id or 0)
    if attn_mask is None:
        attn_mask = (input_ids != pad_id).long()
    return input_ids, attn_mask, pad_id

def generate_reply(tok, model, system_prompt: str, question: str,
                   max_new_tokens: int, temperature: float, greedy: bool):
    input_ids, attention_mask, pad_id = build_inputs(tok, system_prompt, question)
    input_ids = input_ids.to(model.device)
    attention_mask = attention_mask.to(model.device)
    input_len = input_ids.shape[-1]

    gen_kwargs = dict(
        input_ids=input_ids,
        attention_mask=attention_mask,
        max_new_tokens=max_new_tokens,
        pad_token_id=pad_id,
        do_sample=not greedy,
        temperature=temperature if not greedy else 0.0,
        return_dict_in_generate=True
    )
    with torch.no_grad():
        out = model.generate(**gen_kwargs)
        seq = out.sequences[0]

    new_tokens = seq[input_len:]
    text = tok.decode(new_tokens, skip_special_tokens=True).strip()
    if text.startswith("질문:"):
        text = text.split("\n", 1)[-1].strip()
    return text

def run_on_model(label: str, tok, model, questions, out_dir,
                 sys_prompt: str, max_new_tokens: int, temperature: float,
                 greedy: bool, limit: Optional[int]=None):
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
            if not q: continue
            print(f"[{label}] {i+1}/{total} {qid} …", flush=True)
            t0 = time.time()
            try:
                reply = generate_reply(tok, model, sys_prompt, q, max_new_tokens, temperature, greedy)
            except Exception as e:
                reply = f"__ERROR__: {repr(e)}"
            lat = time.time() - t0
            print(f"[{label}] {i+1}/{total} {qid} done {lat:.2f}s", flush=True)
            rec = {"model": label, "id": qid, "question": q, "latency_sec": round(lat, 3), "output": reply}
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            f.flush(); os.fsync(f.fileno())   # ★ 문항별 즉시 디스크 반영
            rows.append(rec)

    print(f"[WRITE] {path} ({len(rows)} rows)")
    return path, rows

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--questions", required=True, help="질문 파일(.json/.jsonl/텍스트)")
    ap.add_argument("--out", default="out_ax", help="결과 저장 디렉토리")
    ap.add_argument("--base", required=True, help="베이스 모델 repo_id/경로 (예: skt/A.X-4.0-Light)")
    ap.add_argument("--adapters", nargs="+", required=True, help="라벨=어댑터경로 ... 공백 구분")
    ap.add_argument("--dtype", default="bfloat16", choices=["bfloat16","float16","float32"])
    ap.add_argument("--max-new-tokens", type=int, default=256)   # 기본 단축
    ap.add_argument("--temperature", type=float, default=0.2)    # 기본 보수적
    ap.add_argument("--greedy", action="store_true", help="샘플링 없이 탐욕적 디코딩(do_sample=False)")
    ap.add_argument("--merge", action="store_true", help="LoRA를 병합 후 추론")
    ap.add_argument("--system-prompt", default=None, help="시스템 프롬프트(미설정 시 기본값)")
    ap.add_argument("--limit", type=int, default=None, help="문항 수 제한(스모크 테스트)")
    ap.add_argument("--load-4bit", action="store_true", help="bitsandbytes 4bit 로드")
    ap.add_argument("--load-8bit", action="store_true", help="bitsandbytes 8bit 로드")
    args = ap.parse_args()

    sys_prompt = args.system_prompt or default_sys_prompt()

    os.makedirs(args.out, exist_ok=True)
    questions = load_questions(args.questions)
    print(f"[INFO] Loaded {len(questions)} questions from {args.questions}")
    if not questions:
        print("[ERROR] 질문이 0개입니다."); return

    print(f"[LOAD base] {args.base} (dtype={args.dtype}, 4bit={args.load_4bit}, 8bit={args.load_8bit})")
    tok, _ = load_base_model(args.base, dtype=args.dtype, load_4bit=args.load_4bit, load_8bit=args.load_8bit)

    summary = []
    for spec in args.adapters:
        if "=" in spec:
            label, adapter_id = spec.split("=", 1)
            label = safe_dirname(label.strip()); adapter_id = adapter_id.strip().rstrip("/")
        else:
            adapter_id = spec.strip().rstrip("/")
            label = safe_dirname(os.path.basename(adapter_id))
        print(f"\n[LOAD peft] base={args.base}  adapter={adapter_id}  label={label}  merge={args.merge}")
        t0 = time.time()

        _, base_model = load_base_model(args.base, dtype=args.dtype, load_4bit=args.load_4bit, load_8bit=args.load_8bit)
        try:
            model = attach_adapter(base_model, adapter_id, merge=args.merge)
        except Exception as e:
            print(f"[SKIP] {label}: 어댑터 로드 실패 -> {repr(e)}")
            summary.append({"model": label, "num_questions": 0, "error": repr(e)})
            continue

        result_path, rows = run_on_model(
            label, tok, model, questions, args.out, sys_prompt,
            args.max_new_tokens, args.temperature, args.greedy, args.limit
        )
        avg_lat = sum(r["latency_sec"] for r in rows) / max(1, len(rows))
        summary.append({
            "model": label, "num_questions": len(rows),
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
