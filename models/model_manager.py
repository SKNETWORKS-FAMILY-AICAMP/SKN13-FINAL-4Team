import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from typing import Optional
import logging
from ..config.base import config

logger = logging.getLogger(__name__)

class ModelManager:
    """모델 로딩 및 관리"""
    
    def __init__(self):
        self.model: Optional[AutoModelForCausalLM] = None
        self.tokenizer: Optional[AutoTokenizer] = None
        self.is_loaded = False
        
    def load_model(self):
        """모델 로드"""
        try:
            logger.info(f"Loading model from {config.model_path}")
            
            # 토크나이저 로드
            self.tokenizer = AutoTokenizer.from_pretrained(config.model_path)
            
            # 모델 로드
            self.model = AutoModelForCausalLM.from_pretrained(
                config.model_path,
                device_map="auto",
                torch_dtype=torch.float16,  # 메모리 절약
                low_cpu_mem_usage=True
            )
            
            # GPU 메모리 제한 설정
            if config.gpu_memory_limit and torch.cuda.is_available():
                torch.cuda.set_per_process_memory_fraction(
                    config.gpu_memory_limit / 1024 / 8  # 8GB 기준 비율 계산
                )
            
            self.is_loaded = True
            logger.info(f"Model loaded successfully for streamer: {config.streamer_id}")
            
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            self.is_loaded = False
            raise
    
    def generate_text(self, formatted_prompt: str, max_tokens: int = None, temperature: float = None) -> tuple[str, int]:
        """텍스트 생성"""
        if not self.is_loaded:
            raise RuntimeError("Model not loaded")
        
        max_tokens = max_tokens or config.max_tokens
        temperature = temperature or config.temperature
        
        # 토크나이즈
        inputs = self.tokenizer(formatted_prompt, return_tensors="pt").to(self.model.device)
        
        # 생성
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                temperature=temperature,
                do_sample=temperature > 0,
                pad_token_id=self.tokenizer.eos_token_id
            )
        
        # 디코드
        generated_text = self.tokenizer.decode(
            outputs[0][inputs['input_ids'].shape[1]:], 
            skip_special_tokens=True
        )
        
        # 토큰 수 계산
        tokens_used = outputs.shape[1] - inputs['input_ids'].shape[1]
        
        return generated_text.strip(), tokens_used
    
    def get_memory_usage(self) -> Optional[float]:
        """GPU 메모리 사용량 반환 (MB)"""
        if torch.cuda.is_available():
            return torch.cuda.memory_allocated() / 1024 / 1024
        return None

# 전역 모델 매니저 인스턴스
model_manager = ModelManager()