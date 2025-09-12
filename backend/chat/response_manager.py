# backend/chat/response_manager.py
import asyncio
import time
import logging
from typing import Optional, Callable, Any

logger = logging.getLogger(__name__)

class ResponseManager:
    """
    단일 응답 생성을 보장하는 매니저
    
    AI 스트리머가 동시에 여러 개의 응답을 생성하는 것을 방지합니다.
    우선순위 기반으로 기존 응답을 취소하고 새로운 응답을 생성합니다.
    """
    
    def __init__(self):
        self._response_lock = asyncio.Lock()
        self._current_response_task: Optional[asyncio.Task] = None
        self._is_responding = False
        self._last_response_time = 0
        self._response_source = None
        self._response_count = 0
        self._cancelled_count = 0
        
    async def generate_response_exclusive(self, responder_func: Callable, state: Any, source: str = "unknown"):
        """
        단일 응답 생성 보장
        
        Args:
            responder_func: Responder.generate_final_response 함수
            state: AgentState 또는 응답 생성에 필요한 상태
            source: 응답 소스 ("chat", "superchat", "idle", "story")
            
        Returns:
            Any: responder_func의 반환값 (예: 상태 dict)
        """
        async with self._response_lock:
            # 기존 응답 진행 중인 경우 우선순위 체크
            if self._is_responding:
                current_priority = self._get_priority(self._response_source)
                new_priority = self._get_priority(source)
                
                logger.info(f"🔄 응답 충돌 감지: 현재={self._response_source}(우선순위={current_priority}) vs 새요청={source}(우선순위={new_priority})")
                
                if new_priority <= current_priority:
                    logger.info(f"⚠️ 낮은 우선순위로 인한 응답 거부: {source}")
                    return False
                    
                # 높은 우선순위인 경우 기존 응답 취소
                if self._current_response_task and not self._current_response_task.done():
                    logger.info(f"🚫 높은 우선순위로 기존 응답 취소: {self._response_source} -> {source}")
                    self._current_response_task.cancel()
                    self._cancelled_count += 1
                    
                    # 기존 작업이 취소될 때까지 잠시 대기
                    try:
                        await asyncio.wait_for(self._current_response_task, timeout=1.0)
                    except (asyncio.CancelledError, asyncio.TimeoutError):
                        pass
                    
            # 새로운 응답 생성 시작
            self._is_responding = True
            self._response_source = source
            self._last_response_time = time.time()
            self._response_count += 1
            
            logger.info(f"🎬 응답 생성 시작: {source} (총 {self._response_count}번째)")
            
            try:
                # 응답 생성 작업 시작
                self._current_response_task = asyncio.create_task(
                    self._wrapped_responder_func(responder_func, state, source)
                )
                result = await self._current_response_task
                
                logger.info(f"✅ 응답 생성 완료: {source}")
                return result
                
            except asyncio.CancelledError:
                logger.info(f"🚫 응답 생성 취소됨: {source}")
                return None
            except Exception as e:
                logger.error(f"❌ 응답 생성 실패: {source} - {e}")
                return None
            finally:
                # 상태 초기화
                self._is_responding = False
                self._response_source = None
                self._current_response_task = None
                
    async def _wrapped_responder_func(self, responder_func: Callable, state: Any, source: str):
        """Responder 함수를 래핑하여 추가 로깅 및 에러 처리"""
        try:
            start_time = time.time()
            
            # 실제 응답 생성 함수 호출 및 결과 반환
            result = await responder_func(state)
            
            processing_time = time.time() - start_time
            logger.info(f"⏱️ 응답 처리 시간: {source} - {processing_time:.2f}초")
            return result
            
        except asyncio.CancelledError:
            logger.info(f"🔄 응답 함수 내부에서 취소됨: {source}")
            raise
        except Exception as e:
            logger.error(f"❌ 응답 함수 실행 중 오류: {source} - {e}")
            raise
                
    def _get_priority(self, source: str) -> int:
        """
        응답 소스별 우선순위 반환
        
        Args:
            source: 응답 소스
            
        Returns:
            int: 우선순위 (숫자가 높을수록 우선순위 높음)
        """
        priority_map = {
            "superchat": 3,     # 슈퍼챗이 최고 우선순위
            "chat": 2,          # 일반 채팅
            "story": 1,         # 사연 읽기
            "idle": 1,          # 자율 발화 (가장 낮은 우선순위)
            "system": 0         # 시스템 메시지
        }
        return priority_map.get(source, 0)
        
    def is_busy(self) -> bool:
        """
        현재 응답 생성 중인지 확인
        
        Returns:
            bool: 응답 생성 중이면 True
        """
        return self._is_responding
        
    def get_current_source(self) -> Optional[str]:
        """
        현재 응답 생성 중인 소스 반환
        
        Returns:
            str: 현재 응답 소스, 응답 중이 아니면 None
        """
        return self._response_source if self._is_responding else None
        
    def time_since_last_response(self) -> float:
        """
        마지막 응답으로부터 경과 시간
        
        Returns:
            float: 경과 시간 (초)
        """
        return time.time() - self._last_response_time if self._last_response_time > 0 else 0
        
    def get_status(self) -> dict:
        """
        현재 ResponseManager 상태 반환 (디버깅용)
        
        Returns:
            dict: 상태 정보
        """
        return {
            "is_responding": self._is_responding,
            "current_source": self._response_source,
            "last_response_time": self._last_response_time,
            "time_since_last": self.time_since_last_response(),
            "total_responses": self._response_count,
            "cancelled_responses": self._cancelled_count,
            "success_rate": ((self._response_count - self._cancelled_count) / max(self._response_count, 1)) * 100
        }
        
    async def cancel_current_response(self, reason: str = "manual_cancel") -> bool:
        """
        현재 진행 중인 응답을 수동으로 취소
        
        Args:
            reason: 취소 이유
            
        Returns:
            bool: 취소 성공 여부
        """
        if self._is_responding and self._current_response_task:
            logger.info(f"🚫 수동 응답 취소: {self._response_source} (이유: {reason})")
            self._current_response_task.cancel()
            self._cancelled_count += 1
            return True
        return False
        
    def reset_stats(self):
        """통계 초기화 (디버깅용)"""
        self._response_count = 0
        self._cancelled_count = 0
        self._last_response_time = 0
        logger.info("📊 ResponseManager 통계 초기화됨")