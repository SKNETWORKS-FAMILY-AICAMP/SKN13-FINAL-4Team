import asyncio
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForCausalLM, TextStreamer
import torch
import threading

# --- 모델 및 토크나이저 로딩 ---
MODEL_PATH = "./omar_exaone_4.0_1.2b"

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForCausalLM.from_pretrained(MODEL_PATH, device_map="auto")

app = FastAPI()

class PromptRequest(BaseModel):
    prompt: str

# --- 스트리밍 응답 생성 함수 ---
class ThreadSafeStreamer(TextStreamer):
    def __init__(self, tokenizer):
        super().__init__(tokenizer, skip_prompt=True)
        self.queue = asyncio.Queue()
        self.stop_signal = object()
        self.loop = asyncio.get_running_loop()

    def on_finalized_text(self, text: str, stream_end: bool = False):
        self.loop.call_soon_threadsafe(self.queue.put_nowait, text)
        if stream_end:
            self.loop.call_soon_threadsafe(self.queue.put_nowait, self.stop_signal)

    def __aiter__(self):
        return self

    async def __anext__(self):
        result = await self.queue.get()
        if result is self.stop_signal:
            raise StopAsyncIteration
        return result

async def sllm_response_generator(prompt: str):
    """
    실제 sLLM 모델을 사용하여 토큰을 생성하고 스트리밍으로 반환하는 제너레이터 함수
    """
    streamer = ThreadSafeStreamer(tokenizer)
    
    # --- ✨ 프롬프트 형식 변환 코드 ---
    # 1. 대화 형식을 리스트로 정의합니다.
    messages = [{"role": "user", "content": prompt}]
    
    # 2. tokenizer의 apply_chat_template을 사용해 모델이 요구하는 형식으로 프롬프트를 변환합니다.
    #    이 기능은 모델 폴더의 chat_template.jinja 파일을 참조하여 자동으로 형식을 맞춰줍니다.
    formatted_prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    
    # 3. 변환된 프롬프트를 모델의 입력으로 사용합니다.
    inputs = tokenizer([formatted_prompt], return_tensors="pt").to(model.device)
    # --- ✨ 수정된 부분 끝 ---

    thread = threading.Thread(target=model.generate, kwargs={**inputs, "streamer": streamer, "max_new_tokens": 512})
    thread.start()

    async for text in streamer:
        yield text

@app.post("/stream-response/")
async def stream_response(request: PromptRequest):
    """
    클라이언트의 요청을 받아 스트리밍 응답을 시작하는 API 엔드포인트입니다.
    """
    return StreamingResponse(
        sllm_response_generator(request.prompt),
        media_type="text/event-stream"
    )

@app.get("/")
def health_check():
    return {"status": "ok"}

