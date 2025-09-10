"""
스트리밍 도메인 모델
DDD 아키텍처 기반 StreamSession, MediaPacket, MediaTrack 구현
Queue 기반 순차 처리 시스템 포함
"""
from dataclasses import dataclass, field
import hashlib
import time
import asyncio
import logging
import weakref
from typing import Literal, Optional, Dict, Any, List, AsyncGenerator
from concurrent.futures import TimeoutError
from dataclasses import field as dataclass_field
import uuid

logger = logging.getLogger(__name__)

def now_ms() -> int:
    """현재 시간을 밀리초로 반환"""
    return int(time.perf_counter() * 1000)

@dataclass(frozen=True)
class MediaTrack:
    """미디어 트랙 값 객체"""
    kind: Literal["audio", "video", "subtitle"]
    pts_ms: int  # Presentation Time Stamp (상대적 시간, ms)
    dur_ms: int  # Duration (지속 시간, ms)
    payload_ref: str  # 미디어 데이터 참조 (URL 또는 데이터)
    codec: str  # 코덱 정보
    meta: Optional[Dict[str, Any]] = None  # 메타데이터
    
    def __post_init__(self):
        """유효성 검사"""
        if self.pts_ms < 0:
            raise ValueError(f"Invalid pts_ms: {self.pts_ms} (must be >= 0)")
        if self.dur_ms <= 0:
            raise ValueError(f"Invalid dur_ms: {self.dur_ms} (must be > 0)")
        if not self.payload_ref:
            raise ValueError("payload_ref cannot be empty")
        if not self.codec:
            raise ValueError("codec cannot be empty")

@dataclass(frozen=True)
class MediaPacket:
    """미디어 패킷 값 객체"""
    v: int  # 버전
    session_id: str  # 세션 ID
    seq: int  # 시퀀스 번호
    t0_ms: int  # 세션 시작 시점 (monotonic time ms)
    tracks: List[MediaTrack]  # 트랙 목록
    hash: str  # 패킷 해시 (무결성 검증용)
    
    def to_dict(self) -> Dict[str, Any]:
        """딕셔너리로 변환 (WebSocket 전송용)"""
        return {
            "v": self.v,
            "session_id": self.session_id,
            "seq": self.seq,
            "t0": self.t0_ms,
            "tracks": [
                {
                    "kind": track.kind,
                    "pts": track.pts_ms,
                    "dur": track.dur_ms,
                    "payload_ref": track.payload_ref,
                    "codec": track.codec,
                    "meta": track.meta or {}
                }
                for track in self.tracks
            ],
            "hash": self.hash
        }

class StreamSession:
    """스트리밍 세션 애그리게이트 루트 - Queue 기반 순차 처리 시스템"""
    
    def __init__(self, session_id: Optional[str] = None):
        self.session_id = session_id or uuid.uuid4().hex
        self.t0_ms = now_ms()  # 세션 시작 시점
        self.seq = 0  # 시퀀스 번호
        self._recent_hashes: List[str] = []  # 중복 패킷 방지용 (최근 50개 저장)
        
        # 🆕 Request Queue - MediaPacket 생성용
        self.request_queue = asyncio.Queue(maxsize=50)  # 요청 대기열 (크기 제한)
        self.processing_lock = asyncio.Lock()  # 동시 처리 방지
        self.current_processing: Optional[Dict[str, Any]] = None  # 현재 처리 중인 요청
        self.is_processing = False  # 처리 상태 플래그
        self.processing_timeout = 30.0  # 처리 타임아웃 (초)
        
        # 🆕 Response Queue - MediaPacket 재생용 (완전 독립)
        self.response_queue = asyncio.Queue(maxsize=30)  # 재생 대기열 (크기 제한)
        self.playback_lock = asyncio.Lock()  # 재생 동시 방지
        self.current_playing: Optional[MediaPacket] = None  # 현재 재생 중인 패킷
        self.is_playing = False  # 재생 상태 플래그
        self.playback_start_time: Optional[int] = None  # 재생 시작 시간
        self.playback_timeout = 60.0  # 재생 타임아웃 (초)
        
        # 🆕 취소 및 에러 복구
        self.cancellation_events: Dict[str, asyncio.Event] = {}  # 요청별 취소 이벤트
        self.retry_count = 0  # 재시도 횟수
        self.max_retries = 3  # 최대 재시도
        self.failed_requests: List[Dict[str, Any]] = []  # 실패한 요청들 (최근 10개)
        
        # 🆕 Queue 메트릭 및 상태 추적
        self.total_processed = 0  # 총 처리된 요청 수
        self.cancelled_requests = 0  # 취소된 요청 수
        self.processing_times = []  # 처리 시간 기록 (최근 10개)
        self.max_queue_length = 0  # 최대 큐 길이 기록
        self.recent_history = []  # 최근 처리 이력 (최근 10개)
        
        # 🆕 Response Queue 메트릭
        self.total_played = 0  # 총 재생된 패킷 수
        self.playback_history = []  # 재생 이력 (최근 10개)
        
        # 🆕 메모리 관리용 약한 참조
        self._queue_snapshot_cache = weakref.WeakValueDictionary()
        
    def build_packet(self, tracks: List[MediaTrack]) -> MediaPacket:
        """
        미디어 패킷 생성
        
        Args:
            tracks: 미디어 트랙 목록
            
        Returns:
            MediaPacket: 생성된 미디어 패킷
            
        Raises:
            ValueError: 트랙이 없거나 유효하지 않은 경우
        """
        if not tracks:
            raise ValueError("No tracks provided")
        
        # 트랙 유효성 검사는 MediaTrack.__post_init__에서 처리
        
        # 패킷 해시 생성 (트랙 내용 + 시퀀스 + 타임스탬프 기반)
        current_time = now_ms()
        raw_content = "|".join(
            f"{t.kind}:{t.pts_ms}:{t.dur_ms}:{t.payload_ref}:{t.codec}"
            for t in tracks
        )
        # 시퀀스 번호와 타임스탬프를 포함하여 중복 방지
        unique_content = f"{self.seq}:{current_time}:{raw_content}"
        packet_hash = hashlib.sha256(unique_content.encode()).hexdigest()[:16]  # 16자리로 단축
        
        # 중복 패킷 체크
        if packet_hash in self._recent_hashes:
            raise ValueError(f"Duplicate packet detected: {packet_hash}")
        
        # 최근 해시 목록 관리 (최대 50개)
        self._recent_hashes.append(packet_hash)
        if len(self._recent_hashes) > 50:
            self._recent_hashes = self._recent_hashes[-50:]
        
        # 패킷 생성
        packet = MediaPacket(
            v=1,  # 버전 1
            session_id=self.session_id,
            seq=self.seq,
            t0_ms=self.t0_ms,
            tracks=tracks,
            hash=packet_hash
        )
        
        # 시퀀스 번호 증가
        self.seq += 1
        
        return packet
    
    def create_audio_track(self, audio_data_url: str, duration_ms: int, 
                          emotion: str = "neutral", voice: str = "default") -> MediaTrack:
        """오디오 트랙 생성 헬퍼"""
        return MediaTrack(
            kind="audio",
            pts_ms=0,  # 즉시 시작
            dur_ms=duration_ms,
            payload_ref=audio_data_url,
            codec="audio/mpeg",
            meta={
                "emotion": emotion,
                "voice": voice
            }
        )
    
    def create_video_track(self, video_path: str, duration_ms: int, 
                          clip_type: str = "talk") -> MediaTrack:
        """비디오 트랙 생성 헬퍼"""
        return MediaTrack(
            kind="video",
            pts_ms=0,  # 즉시 시작
            dur_ms=duration_ms,
            payload_ref=video_path,
            codec="video/mp4",
            meta={
                "clip_type": clip_type
            }
        )
    
    def create_subtitle_track(self, subtitle_data: Dict[str, Any], 
                            duration_ms: int) -> MediaTrack:
        """자막 트랙 생성 헬퍼"""
        return MediaTrack(
            kind="subtitle",
            pts_ms=0,  # 즉시 시작
            dur_ms=duration_ms,
            payload_ref=str(subtitle_data),  # JSON 문자열로 저장
            codec="text/json",
            meta=subtitle_data
        )
    
    async def enqueue_request(self, request_data: Dict[str, Any], timeout: float = 5.0) -> bool:
        """
        요청을 큐에 추가 - 타임아웃 및 우선순위 지원
        
        Args:
            request_data: 처리할 요청 데이터 (message, user_id, streamer_config 등)
            timeout: 큐 추가 타임아웃 (초)
            
        Returns:
            bool: 성공 여부
        """
        try:
            # 요청 ID 생성 및 취소 이벤트 등록
            request_id = uuid.uuid4().hex
            request_data['request_id'] = request_id
            request_data['enqueued_at'] = now_ms()
            
            self.cancellation_events[request_id] = asyncio.Event()
            
            # 큐 포화 상태 체크
            if self.request_queue.qsize() >= 40:  # 80% 포화시 경고
                logger.warning(f"⚠️ Request Queue 포화 상태: {self.request_queue.qsize()}/50")
                
            # 타임아웃과 함께 큐에 추가
            await asyncio.wait_for(self.request_queue.put(request_data), timeout=timeout)
            queue_size = self.request_queue.qsize()
            
            logger.info(f"📝 [QUEUE] 요청 추가: '{request_data.get('message', '')[:30]}...' | 큐 크기: {queue_size} | 사용자: {request_data.get('username', 'Unknown')} | ID: {request_id[:8]}")
            return True
            
        except asyncio.TimeoutError:
            logger.error(f"❌ Request Queue 추가 타임아웃: {request_data.get('message', '')[:30]}...")
            return False
        except Exception as e:
            logger.error(f"❌ Request Queue 추가 실패: {e}")
            return False
    
    async def enqueue_response(self, media_packet: MediaPacket, timeout: float = 3.0) -> bool:
        """
        MediaPacket을 Response Queue에 추가 (재생 대기열)
        
        Args:
            media_packet: 재생할 MediaPacket
            timeout: 큐 추가 타임아웃 (초)
            
        Returns:
            bool: 성공 여부
        """
        try:
            # 큐 포화 상태 체크
            if self.response_queue.qsize() >= 25:  # 83% 포화시 경고
                logger.warning(f"⚠️ Response Queue 포화 상태: {self.response_queue.qsize()}/30")
            
            await asyncio.wait_for(self.response_queue.put(media_packet), timeout=timeout)
            logger.info(f"📤 Response Queue에 추가: seq={media_packet.seq}, hash={media_packet.hash[:8]} (재생 큐 크기: {self.response_queue.qsize()})")
            return True
            
        except asyncio.TimeoutError:
            logger.error(f"❌ Response Queue 추가 타임아웃: seq={media_packet.seq}")
            return False
        except Exception as e:
            logger.error(f"❌ Response Queue 추가 실패: {e}")
            return False
    
    async def process_response_queue(self) -> AsyncGenerator[MediaPacket, None]:
        """
        Response Queue를 순차적으로 처리하여 MediaPacket 재생
        
        Yields:
            MediaPacket: 재생할 미디어 패킷 (브로드캐스트용)
        """
        logger.info(f"🎵 Response Queue Processor 시작: {self.session_id[:8]}")
        
        while True:
            try:
                # 다음 MediaPacket 대기 (재생 완료 대기 제거)
                media_packet = await self.response_queue.get()
                
                # 재생 시작 (lock 없이 간단하게)
                self.current_playing = media_packet
                self.playback_start_time = now_ms()
                
                logger.info(f"🎬 연속 재생: seq={media_packet.seq}, hash={media_packet.hash[:8]} (대기열: {self.response_queue.qsize()})")
                
                # 재생 이력 업데이트
                playback_item = {
                    "timestamp": now_ms(),
                    "seq": media_packet.seq,
                    "hash": media_packet.hash[:8],
                    "tracks_count": len(media_packet.tracks),
                    "status": "playing"
                }
                self.playback_history.insert(0, playback_item)
                if len(self.playback_history) > 10:
                    self.playback_history.pop()
                
                # MediaPacket 브로드캐스트를 위해 yield
                yield media_packet
                
                # 즉시 다음 패킷 처리 가능하도록 설정
                self.response_queue.task_done()
                    
            except asyncio.CancelledError:
                logger.info(f"🚫 Response Queue Processor 취소됨: {self.session_id[:8]}")
                break
            except Exception as e:
                logger.error(f"❌ Response Queue 처리 오류: {str(e)}")
    
    def mark_playback_completed(self, seq: int):
        """
        재생 완료 표시 (프론트엔드에서 호출)
        
        Args:
            seq: 완료된 MediaPacket의 시퀀스 번호
        """
        if self.current_playing and self.current_playing.seq == seq:
            playback_time = (now_ms() - self.playback_start_time) / 1000.0 if self.playback_start_time else 0
            
            logger.info(f"✅ 재생 완료: seq={seq}, 재생시간={playback_time:.1f}초")
            
            # 재생 완료 이력 업데이트
            if self.playback_history and self.playback_history[0]["seq"] == seq:
                self.playback_history[0]["status"] = "completed"
                self.playback_history[0]["playback_time"] = playback_time
            
            # 상태 리셋
            self.current_playing = None
            self.is_playing = False
            self.playback_start_time = None
            self.total_played += 1
        else:
            logger.warning(f"⚠️ 재생 완료 신호 불일치: 현재={self.current_playing.seq if self.current_playing else None}, 요청={seq}")
    
    async def process_queue(self, media_processor) -> None:
        """
        큐를 순차적으로 처리하여 MediaPacket 생성 (취소 가능한 처리)
        
        Args:
            media_processor: MediaProcessingHub 인스턴스
        """
        while True:
            try:
                # 다음 요청 대기 (타임아웃 포함)
                request_data = await asyncio.wait_for(
                    self.request_queue.get(), 
                    timeout=self.processing_timeout
                )
                
                request_id = request_data.get('request_id', 'unknown')
                
                async with self.processing_lock:
                    # 취소 확인
                    if request_id in self.cancellation_events:
                        if self.cancellation_events[request_id].is_set():
                            logger.info(f"🚫 취소된 요청 건너뛰기: {request_id[:8]}")
                            self._update_processing_metrics(0, 'cancelled')
                            self.request_queue.task_done()
                            continue
                    
                    # 처리 시작
                    start_time = now_ms()
                    request_data['start_time'] = start_time
                    self.current_processing = request_data
                    self.is_processing = True
                    
                    logger.info(f"🎬 요청 처리 시작: {request_data.get('message', '')[:30]}... (ID: {request_id[:8]}, seq: {self.seq})")
                    
                    try:
                        # 취소 가능한 MediaTrack 생성 (타임아웃 포함)
                        cancellation_event = self.cancellation_events.get(request_id)
                        
                        tracks = await asyncio.wait_for(
                            media_processor.generate_tracks_with_cancellation(
                                request_data, cancellation_event
                            ),
                            timeout=self.processing_timeout
                        )
                        
                        # 취소 재확인
                        if cancellation_event and cancellation_event.is_set():
                            logger.info(f"🚫 처리 중 취소됨: {request_id[:8]}")
                            self._update_processing_metrics(
                                (now_ms() - start_time) / 1000.0, 'cancelled'
                            )
                        elif tracks:
                            # 성공 처리
                            processing_time = (now_ms() - start_time) / 1000.0
                            media_packet = self.build_packet(tracks)
                            
                            # Response Queue에 추가 (타임아웃 포함)
                            success = await self.enqueue_response(media_packet, timeout=3.0)
                            if success:
                                self._update_processing_metrics(processing_time, 'completed')
                                logger.info(f"✅ MediaPacket 생성 완료: {media_packet.hash[:8]} (seq: {media_packet.seq})")
                            else:
                                self._update_processing_metrics(processing_time, 'failed')
                                logger.error(f"❌ Response Queue 추가 실패: {media_packet.hash[:8]}")
                        else:
                            # 실패 처리
                            processing_time = (now_ms() - start_time) / 1000.0
                            self._update_processing_metrics(processing_time, 'failed')
                            
                            # 실패한 요청을 실패 목록에 추가
                            self._add_failed_request(request_data, "트랙 생성 실패")
                            
                    except asyncio.TimeoutError:
                        processing_time = (now_ms() - start_time) / 1000.0
                        self._update_processing_metrics(processing_time, 'timeout')
                        self._add_failed_request(request_data, f"처리 타임아웃 ({self.processing_timeout}초)")
                        logger.error(f"⏰ 요청 처리 타임아웃: {request_id[:8]}")
                        
                    except Exception as e:
                        processing_time = (now_ms() - start_time) / 1000.0
                        self._update_processing_metrics(processing_time, 'failed')
                        self._add_failed_request(request_data, str(e))
                        logger.error(f"❌ 요청 처리 실패: {request_id[:8]} - {e}")
                        
                    finally:
                        # 정리 작업
                        self.current_processing = None
                        self.is_processing = False
                        self.request_queue.task_done()
                        
                        # 취소 이벤트 정리
                        if request_id in self.cancellation_events:
                            self.cancellation_events.pop(request_id, None)
                        
                        # 주기적 정리 (100개 요청마다)
                        if self.total_processed % 100 == 0:
                            await self.cleanup_cancelled_events()
                            
            except asyncio.TimeoutError:
                logger.debug("Queue 처리 대기 타임아웃 (정상 동작)")
                continue
            except Exception as e:
                logger.error(f"❌ Queue 처리 심각한 오류: {str(e)}")
                await asyncio.sleep(1)  # 잠시 대기 후 재시도
    
    def get_session_info(self) -> Dict[str, Any]:
        """세션 정보 반환 (Queue 상태 포함)"""
        return {
            "session_id": self.session_id,
            "t0_ms": self.t0_ms,
            "current_seq": self.seq,
            "uptime_ms": now_ms() - self.t0_ms,
            "recent_hashes_count": len(self._recent_hashes),
            # 🆕 Queue 상태 정보
            "queue_length": self.request_queue.qsize(),
            "is_processing": self.is_processing,
            "current_request": self.current_processing.get('message', '')[:30] if self.current_processing else None
        }
    
    async def get_detailed_queue_info(self) -> Dict[str, Any]:
        """
        상세한 Queue 상태 정보 반환 (Debug Panel용)
        
        Returns:
            Dict containing detailed queue information for debugging
        """
        # 평균 처리 시간 계산
        avg_processing_time = (
            sum(self.processing_times) / len(self.processing_times) 
            if self.processing_times else 0
        )
        
        # 현재 처리 중인 요청 정보
        current_processing_info = None
        if self.current_processing:
            processing_duration = (
                (now_ms() - self.current_processing.get('start_time', 0)) / 1000
                if self.current_processing.get('start_time') else 0
            )
            current_processing_info = {
                "message": self.current_processing.get('message', ''),
                "username": self.current_processing.get('username', 'unknown'),
                "user_id": self.current_processing.get('user_id'),
                "start_time": self.current_processing.get('start_time'),
                "processing_duration": processing_duration,
                "room_group": self.current_processing.get('room_group')
            }
        
        # 🆕 Request Queue 대기 요청들 정보 (안전한 peek 방식)
        pending_requests = await self._safe_peek_request_queue()
        
        # 🆕 Response Queue 대기 MediaPacket들 정보 (안전한 peek 방식)
        pending_media_packets = await self._safe_peek_response_queue()
        
        return {
            "session_id": self.session_id,
            "timestamp": now_ms(),
            
            # 🆕 Request Queue 상태
            "request_queue": {
                "length": self.request_queue.qsize(),
                "is_processing": self.is_processing,
                "current_processing": current_processing_info,
                "pending_requests": pending_requests,
            },
            
            # 🆕 Response Queue 상태
            "response_queue": {
                "length": self.response_queue.qsize(),
                "is_playing": self.is_playing,
                "current_playing": {
                    "seq": self.current_playing.seq if self.current_playing else None,
                    "hash": self.current_playing.hash[:8] if self.current_playing else None,
                    "tracks": len(self.current_playing.tracks) if self.current_playing else 0
                } if self.current_playing else None,
                "pending_packets": pending_media_packets,
                "total_played": self.total_played
            },
            
            # 기본 상태 (호환성)
            "queue_length": self.request_queue.qsize(),
            "is_processing": self.is_processing,
            "current_seq": self.seq,
            "uptime_ms": now_ms() - self.t0_ms,
            
            # 메트릭 (확장)
            "metrics": {
                "total_processed": self.total_processed,
                "cancelled_requests": self.cancelled_requests,
                "failed_requests_count": len(self.failed_requests),
                "avg_processing_time": avg_processing_time,
                "max_queue_length": self.max_queue_length,
                "recent_processing_times": self.processing_times.copy(),
                "recent_hashes_count": len(self._recent_hashes),
                "active_cancellation_events": len(self.cancellation_events),
                "processing_timeout": self.processing_timeout,
                "playback_timeout": self.playback_timeout
            },
            
            # 실패 요청 목록
            "failed_requests": self.failed_requests.copy(),
            
            # 최근 처리 이력
            "recent_history": self.recent_history.copy(),
            
            # 시스템 상태
            "system_health": {
                "request_queue_utilization": (self.request_queue.qsize() / 50.0) * 100,
                "response_queue_utilization": (self.response_queue.qsize() / 30.0) * 100,
                "avg_success_rate": ((self.total_processed - self.cancelled_requests - len(self.failed_requests)) / max(self.total_processed, 1)) * 100,
                "memory_pressure": len(self.cancellation_events) > 100
            }
        }
    
    def _update_processing_metrics(self, processing_time: float, status: str = 'completed'):
        """처리 메트릭 업데이트"""
        if status == 'completed':
            self.total_processed += 1
            
            # 처리 시간 기록 (최근 10개만 유지)
            self.processing_times.append(processing_time)
            if len(self.processing_times) > 10:
                self.processing_times.pop(0)
                
        elif status in ['cancelled', 'timeout']:
            self.cancelled_requests += 1
            
        elif status == 'failed':
            # 실패한 요청도 총 처리 수에 포함
            self.total_processed += 1
        
        # 최대 큐 길이 업데이트
        current_queue_length = self.request_queue.qsize()
        if current_queue_length > self.max_queue_length:
            self.max_queue_length = current_queue_length
        
        # 최근 이력 업데이트 (최근 10개만 유지)
        history_item = {
            "timestamp": now_ms(),
            "message": self.current_processing.get('message', '')[:30] if self.current_processing else '',
            "username": self.current_processing.get('username', 'unknown') if self.current_processing else '',
            "request_id": self.current_processing.get('request_id', 'unknown')[:8] if self.current_processing else '',
            "status": status,
            "processing_time": processing_time,
            "seq": self.seq - 1 if status == 'completed' else None
        }
        
        self.recent_history.insert(0, history_item)
        if len(self.recent_history) > 10:
            self.recent_history.pop()
        
        logger.info(f"📊 메트릭 업데이트: {status}, 처리시간: {processing_time:.2f}초, 큐크기: {current_queue_length}, 총처리: {self.total_processed}")
    
    def _add_failed_request(self, request_data: Dict[str, Any], error_msg: str):
        """실패한 요청을 기록"""
        failed_item = {
            "timestamp": now_ms(),
            "request_id": request_data.get('request_id', 'unknown')[:8],
            "message": request_data.get('message', '')[:50],
            "username": request_data.get('username', 'unknown'),
            "error": error_msg,
            "retry_count": request_data.get('retry_count', 0)
        }
        
        self.failed_requests.insert(0, failed_item)
        if len(self.failed_requests) > 10:
            self.failed_requests.pop()
            
        logger.warning(f"❌ 실패 요청 기록: {failed_item['request_id']} - {error_msg}")
    
    async def cancel_request(self, request_id: str) -> bool:
        """
        특정 요청 취소
        
        Args:
            request_id: 취소할 요청 ID
            
        Returns:
            bool: 취소 성공 여부
        """
        if request_id in self.cancellation_events:
            self.cancellation_events[request_id].set()
            logger.info(f"🚫 요청 취소 신호 전송: {request_id[:8]}")
            return True
        return False
    
    async def _safe_peek_request_queue(self, max_items: int = 10) -> List[Dict[str, Any]]:
        """
        Request Queue의 내용을 안전하게 조회 (Queue 순서 보존)
        
        Args:
            max_items: 최대 조회할 아이템 수
            
        Returns:
            List[Dict]: 대기 중인 요청 정보
        """
        if self.request_queue.qsize() == 0:
            return []
            
        pending_requests = []
        temp_items = []
        
        try:
            # 큐에서 아이템들을 안전하게 추출 (최대 max_items개)
            items_to_extract = min(self.request_queue.qsize(), max_items)
            
            for _ in range(items_to_extract):
                try:
                    item = await asyncio.wait_for(
                        self.request_queue.get(), timeout=0.1
                    )
                    temp_items.append(item)
                except (asyncio.TimeoutError, asyncio.QueueEmpty):
                    break
                    
            # 정보 추출
            current_time = now_ms()
            for index, item in enumerate(temp_items):
                enqueued_at = item.get('enqueued_at', current_time)
                waiting_time = (current_time - enqueued_at) / 1000.0
                
                pending_requests.append({
                    "position": index + 1,
                    "request_id": item.get('request_id', 'unknown')[:8],
                    "message": item.get('message', '')[:50],
                    "username": item.get('username', 'unknown'),
                    "user_id": item.get('user_id'),
                    "enqueued_at": enqueued_at,
                    "waiting_time": round(waiting_time, 1)
                })
                
            # 큐에 다시 넣기 (순서 보존)
            for item in temp_items:
                await self.request_queue.put(item)
                
        except Exception as e:
            logger.warning(f"Request Queue peek 중 오류: {e}")
            # 실패시 추출한 아이템들을 다시 넣기
            for item in temp_items:
                try:
                    await self.request_queue.put(item)
                except Exception:
                    pass
                    
        return pending_requests
    
    async def _safe_peek_response_queue(self, max_items: int = 10) -> List[Dict[str, Any]]:
        """
        Response Queue의 내용을 안전하게 조회 (Queue 순서 보존)
        
        Args:
            max_items: 최대 조회할 아이템 수
            
        Returns:
            List[Dict]: 대기 중인 MediaPacket 정보
        """
        if self.response_queue.qsize() == 0:
            return []
            
        pending_packets = []
        temp_packets = []
        
        try:
            # 큐에서 패킷들을 안전하게 추출
            items_to_extract = min(self.response_queue.qsize(), max_items)
            
            for _ in range(items_to_extract):
                try:
                    packet = await asyncio.wait_for(
                        self.response_queue.get(), timeout=0.1
                    )
                    temp_packets.append(packet)
                except (asyncio.TimeoutError, asyncio.QueueEmpty):
                    break
                    
            # 정보 추출
            for index, packet in enumerate(temp_packets):
                # 오디오 트랙에서 예상 재생시간 추출
                duration = 0
                for track in packet.tracks:
                    if track.kind == "audio":
                        duration = max(duration, track.dur_ms / 1000.0)
                        
                pending_packets.append({
                    "position": index + 1,
                    "seq": packet.seq,
                    "hash": packet.hash[:8],
                    "tracks_count": len(packet.tracks),
                    "track_types": [track.kind for track in packet.tracks],
                    "duration": round(duration, 1),
                    "created_at": packet.t0_ms
                })
                
            # 큐에 다시 넣기 (순서 보존)
            for packet in temp_packets:
                await self.response_queue.put(packet)
                
        except Exception as e:
            logger.warning(f"Response Queue peek 중 오류: {e}")
            # 실패시 추출한 패킷들을 다시 넣기
            for packet in temp_packets:
                try:
                    await self.response_queue.put(packet)
                except Exception:
                    pass
                    
        return pending_packets
    
    def reset_sequence(self):
        """시퀀스 번호 리셋 (디버깅용)"""
        self.seq = 0
        self._recent_hashes.clear()
        
    async def cleanup_cancelled_events(self):
        """만료된 취소 이벤트 정리 (메모리 누수 방지)"""
        current_time = now_ms()
        expired_events = []
        
        for request_id, event in self.cancellation_events.items():
            # 10분 이상된 이벤트는 정리
            if hasattr(event, '_created_at'):
                if current_time - event._created_at > 600000:  # 10분
                    expired_events.append(request_id)
                    
        for request_id in expired_events:
            self.cancellation_events.pop(request_id, None)
            
        if expired_events:
            logger.info(f"🧹 만료된 취소 이벤트 정리: {len(expired_events)}개")