# backend/chat/activity_manager.py
import time
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

class ActivityManager:
    """
    통합 활동 관리자 - Idle 상태와 타이머를 중앙집중식으로 관리
    
    모든 사용자 활동(채팅, 슈퍼챗, WebSocket 연결 등)을 추적하고,
    Idle 상태를 정확하게 판단합니다. 기존 시스템들의 타이머도 함께 동기화합니다.
    """
    
    def __init__(self, idle_manager=None, queue_manager=None):
        self.idle_manager = idle_manager
        self.queue_manager = queue_manager
        self.last_activity = time.time()
        self._activity_sources: List[Dict[str, Any]] = []  # 최근 활동 소스 기록
        self._activity_count = 0
        
        # 다양한 임계값 설정
        self.IDLE_THRESHOLD_6S = 6      # 일반 Idle 감지
        self.IDLE_THRESHOLD_45S = 45    # 사연 읽기 쿨다운
        self.IDLE_THRESHOLD_120S = 120  # 자율 발화 쿨다운
        
        logger.info(f"🎯 ActivityManager 초기화 완료")
        
    def mark_activity(self, source: str, details: str = "", user_info: dict = None):
        """
        모든 활동을 한 곳에서 관리
        
        Args:
            source: 활동 소스 ("websocket", "chat", "superchat", "agent_input" 등)
            details: 추가 상세 정보
            user_info: 사용자 정보 (username, user_id 등)
        """
        current_time = time.time()
        time_since_last = current_time - self.last_activity
        
        self.last_activity = current_time
        self._activity_count += 1
        
        # 기존 시스템들의 타이머도 리셋
        if self.queue_manager:
            self.queue_manager.mark_event()
            
        if self.idle_manager:
            self.idle_manager.reset_cooldown()
            
        # 활동 기록
        activity_record = {
            "timestamp": current_time,
            "source": source,
            "details": details,
            "user_info": user_info or {},
            "time_since_last": time_since_last,
            "activity_id": self._activity_count
        }
        
        self._activity_sources.insert(0, activity_record)
        if len(self._activity_sources) > 50:  # 최근 50개만 유지 (메모리 관리)
            self._activity_sources = self._activity_sources[:50]
            
        # 로깅 - 중요한 활동만 INFO 레벨로
        if source in ["chat", "superchat", "websocket_connect"]:
            logger.info(f"🔄 중요 활동 감지: {source} - {details} (이전 활동으로부터 {time_since_last:.1f}초 후)")
        else:
            logger.debug(f"🔄 활동 감지: {source} - {details}")
            
    def is_idle(self, threshold: int = None) -> bool:
        """
        지정된 시간 동안 활동이 없었는지 확인
        
        Args:
            threshold: 임계값 (초), None이면 기본 6초 사용
            
        Returns:
            bool: Idle 상태이면 True
        """
        if threshold is None:
            threshold = self.IDLE_THRESHOLD_6S
            
        time_elapsed = time.time() - self.last_activity
        is_idle_result = time_elapsed >= threshold
        
        if is_idle_result and threshold == self.IDLE_THRESHOLD_6S:
            logger.debug(f"😴 Idle 상태 감지: {time_elapsed:.1f}초간 비활성 (임계값: {threshold}초)")
            
        return is_idle_result
        
    def time_since_last_activity(self) -> float:
        """
        마지막 활동으로부터 경과 시간
        
        Returns:
            float: 경과 시간 (초)
        """
        return time.time() - self.last_activity
        
    def get_recent_activities(self, count: int = 10, source_filter: str = None) -> List[Dict[str, Any]]:
        """
        최근 활동 기록 반환
        
        Args:
            count: 반환할 활동 개수
            source_filter: 특정 소스만 필터링 (None이면 모든 활동)
            
        Returns:
            List[Dict]: 최근 활동 기록
        """
        activities = self._activity_sources[:count]
        
        if source_filter:
            activities = [a for a in activities if a["source"] == source_filter]
            
        return activities
        
    def get_activity_summary(self, time_window: int = 300) -> Dict[str, Any]:
        """
        지정된 시간 창 내의 활동 요약 반환
        
        Args:
            time_window: 시간 창 (초, 기본 5분)
            
        Returns:
            Dict: 활동 요약 정보
        """
        current_time = time.time()
        cutoff_time = current_time - time_window
        
        recent_activities = [
            a for a in self._activity_sources 
            if a["timestamp"] >= cutoff_time
        ]
        
        # 소스별 활동 수 집계
        source_counts = {}
        user_counts = {}
        
        for activity in recent_activities:
            source = activity["source"]
            source_counts[source] = source_counts.get(source, 0) + 1
            
            user_info = activity.get("user_info", {})
            username = user_info.get("username", "unknown")
            user_counts[username] = user_counts.get(username, 0) + 1
            
        return {
            "time_window_minutes": time_window / 60,
            "total_activities": len(recent_activities),
            "unique_sources": len(source_counts),
            "unique_users": len(user_counts),
            "source_breakdown": source_counts,
            "user_breakdown": user_counts,
            "most_active_source": max(source_counts.items(), key=lambda x: x[1]) if source_counts else None,
            "most_active_user": max(user_counts.items(), key=lambda x: x[1]) if user_counts else None
        }
        
    def get_status(self) -> Dict[str, Any]:
        """
        현재 활동 상태 반환
        
        Returns:
            Dict: 상태 정보
        """
        time_since_last = self.time_since_last_activity()
        
        return {
            "last_activity": self.last_activity,
            "time_since_last": time_since_last,
            "total_activities": self._activity_count,
            
            # 다양한 임계값별 Idle 상태
            "is_idle_6s": self.is_idle(self.IDLE_THRESHOLD_6S),
            "is_idle_45s": self.is_idle(self.IDLE_THRESHOLD_45S), 
            "is_idle_120s": self.is_idle(self.IDLE_THRESHOLD_120S),
            
            # Idle까지 남은 시간
            "seconds_until_idle_6s": max(0, self.IDLE_THRESHOLD_6S - time_since_last),
            "seconds_until_idle_45s": max(0, self.IDLE_THRESHOLD_45S - time_since_last),
            "seconds_until_idle_120s": max(0, self.IDLE_THRESHOLD_120S - time_since_last),
            
            # 최근 활동 정보
            "recent_activities": self.get_recent_activities(3),
            "activity_summary_5min": self.get_activity_summary(300),
            
            # 연결된 시스템 상태
            "has_idle_manager": self.idle_manager is not None,
            "has_queue_manager": self.queue_manager is not None
        }
        
    def set_idle_manager(self, idle_manager):
        """IdleManager 연결 (지연 초기화용)"""
        self.idle_manager = idle_manager
        logger.info("🔗 IdleManager 연결됨")
        
    def set_queue_manager(self, queue_manager):
        """QueueManager 연결 (지연 초기화용)"""
        self.queue_manager = queue_manager
        logger.info("🔗 QueueManager 연결됨")
        
    def force_activity_reset(self, reason: str = "manual_reset"):
        """활동 상태를 강제로 리셋 (디버깅용)"""
        self.last_activity = time.time()
        
        # 기존 시스템들도 리셋
        if self.queue_manager:
            self.queue_manager.mark_event()
        if self.idle_manager:
            self.idle_manager.reset_cooldown()
            
        self.mark_activity("force_reset", f"reason: {reason}")
        logger.info(f"🔄 활동 상태 강제 리셋: {reason}")
        
    def cleanup_old_activities(self, max_age_hours: int = 24):
        """오래된 활동 기록 정리 (메모리 관리)"""
        if not self._activity_sources:
            return
            
        cutoff_time = time.time() - (max_age_hours * 3600)
        original_count = len(self._activity_sources)
        
        self._activity_sources = [
            a for a in self._activity_sources 
            if a["timestamp"] >= cutoff_time
        ]
        
        cleaned_count = original_count - len(self._activity_sources)
        if cleaned_count > 0:
            logger.info(f"🧹 오래된 활동 기록 정리: {cleaned_count}개 삭제 ({max_age_hours}시간 이전)")
            
    def get_idle_prediction(self) -> Dict[str, Any]:
        """
        Idle 상태 예측 정보 반환 (사용자 경험 향상용)
        
        Returns:
            Dict: 예측 정보
        """
        time_since_last = self.time_since_last_activity()
        recent_activities = self.get_recent_activities(10)
        
        # 최근 활동 패턴 분석
        if len(recent_activities) >= 3:
            intervals = []
            for i in range(1, min(len(recent_activities), 6)):
                interval = recent_activities[i-1]["timestamp"] - recent_activities[i]["timestamp"]
                intervals.append(interval)
                
            avg_interval = sum(intervals) / len(intervals) if intervals else 0
            
            # 다음 활동 예상 시간
            estimated_next_activity = self.last_activity + avg_interval
            time_to_next = max(0, estimated_next_activity - time.time())
        else:
            avg_interval = 0
            time_to_next = 0
            
        return {
            "time_since_last_activity": time_since_last,
            "average_activity_interval": avg_interval,
            "estimated_time_to_next_activity": time_to_next,
            "likely_to_go_idle_soon": (
                time_since_last > 3 and 
                avg_interval > 10 and 
                time_to_next > self.IDLE_THRESHOLD_6S
            ),
            "recent_activity_trend": "increasing" if len(recent_activities) >= 2 and 
                                   recent_activities[0]["time_since_last"] < recent_activities[1]["time_since_last"] 
                                   else "decreasing"
        }