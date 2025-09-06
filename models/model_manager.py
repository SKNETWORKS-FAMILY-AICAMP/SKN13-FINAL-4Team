import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel, PeftConfig
from typing import Optional
import logging
import os
from ..config.base import config

logger = logging.getLogger(__name__)

class ModelManager:
    """모델 로딩 및 관리"""
    
    def __init__(self):
        self.model: Optional[AutoModelForCausalLM] = None
        self.base_model: Optional[AutoModelForCausalLM] = None
        self.tokenizer: Optional[AutoTokenizer] = None
        self.is_loaded = False
        self.model_name = ""
        
    def load_model(self):
        """모델 로드 - HuggingFace Hub + LoRA Adapter 지원"""
        try:
            # 기본 모델 이름 결정 (하위 호환성)
            base_model_name = getattr(config, 'base_model_name', config.model_path)
            adapter_path = getattr(config, 'adapter_path', None)
            
            logger.info(f"Loading base model: {base_model_name}")
            
            # 1. 토크나이저 로드 (HuggingFace Hub에서)
            self.tokenizer = AutoTokenizer.from_pretrained(base_model_name)
            if self.tokenizer.pad_token is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token
            
            # GPU 메모리 제한 설정
            if hasattr(config, 'gpu_memory_limit') and config.gpu_memory_limit and torch.cuda.is_available():
                torch.cuda.set_per_process_memory_fraction(
                    config.gpu_memory_limit / 1024 / 8  # 8GB 기준 비율 계산
                )
            
            # 2. 기본 모델 로드 (HuggingFace Hub에서)
            self.base_model = AutoModelForCausalLM.from_pretrained(
                base_model_name,
                device_map="auto" if torch.cuda.is_available() else None,
                torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
                low_cpu_mem_usage=True,
                trust_remote_code=True
            )
            
            # 3. LoRA Adapter 적용 (있는 경우)
            if adapter_path and os.path.exists(adapter_path):
                logger.info(f"Loading LoRA adapter: {adapter_path}")
                self.model = PeftModel.from_pretrained(
                    self.base_model, 
                    adapter_path
                )
                self.model_name = f"{base_model_name} + {adapter_path}"
            else:
                logger.info("No adapter found or specified, using base model only")
                self.model = self.base_model
                self.model_name = base_model_name
            
            self.model.eval()  # 추론 모드로 설정
            self.is_loaded = True
            
            logger.info(f"Model loaded successfully: {self.model_name}")
            logger.info(f"Streamer ID: {config.streamer_id}")
            
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