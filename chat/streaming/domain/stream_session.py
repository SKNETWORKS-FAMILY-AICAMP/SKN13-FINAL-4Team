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
from typing import Literal, Optional, Dict, Any, List, AsyncGenerator
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
        self.request_queue = asyncio.Queue()  # 요청 대기열
        self.processing_lock = asyncio.Lock()  # 동시 처리 방지
        self.current_processing: Optional[Dict[str, Any]] = None  # 현재 처리 중인 요청
        self.is_processing = False  # 처리 상태 플래그
        
        # 🆕 Response Queue - MediaPacket 재생용 (완전 독립)
        self.response_queue = asyncio.Queue()  # 재생 대기열
        self.playback_lock = asyncio.Lock()  # 재생 동시 방지
        self.current_playing: Optional[MediaPacket] = None  # 현재 재생 중인 패킷
        self.is_playing = False  # 재생 상태 플래그
        self.playback_start_time: Optional[int] = None  # 재생 시작 시간
        
        # 🆕 Queue 메트릭 및 상태 추적
        self.total_processed = 0  # 총 처리된 요청 수
        self.cancelled_requests = 0  # 취소된 요청 수
        self.processing_times = []  # 처리 시간 기록 (최근 10개)
        self.max_queue_length = 0  # 최대 큐 길이 기록
        self.recent_history = []  # 최근 처리 이력 (최근 10개)
        
        # 🆕 Response Queue 메트릭
        self.total_played = 0  # 총 재생된 패킷 수
        self.playback_history = []  # 재생 이력 (최근 10개)
        
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
    
    async def enqueue_request(self, request_data: Dict[str, Any]):
        """
        요청을 큐에 추가 - 모든 요청 순차 처리 보장
        
        Args:
            request_data: 처리할 요청 데이터 (message, user_id, streamer_config 등)
        """
        # 모든 요청을 순서대로 큐에 추가 (기존 요청 제거하지 않음)
        await self.request_queue.put(request_data)
        queue_size = self.request_queue.qsize()
        logger.info(f"📝 [QUEUE] 요청 추가: '{request_data.get('message', '')[:30]}...' | 큐 크기: {queue_size} | 사용자: {request_data.get('username', 'Unknown')}")
    
    async def enqueue_response(self, media_packet: MediaPacket):
        """
        MediaPacket을 Response Queue에 추가 (재생 대기열)
        
        Args:
            media_packet: 재생할 MediaPacket
        """
        await self.response_queue.put(media_packet)
        logger.info(f"📤 Response Queue에 추가: seq={media_packet.seq}, hash={media_packet.hash[:8]} (재생 큐 크기: {self.response_queue.qsize()})")
    
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
        큐를 순차적으로 처리하여 MediaPacket 생성 (완전 순차 처리, 취소 없음)
        
        Args:
            media_processor: MediaProcessingHub 인스턴스
            
        Yields:
            MediaPacket: 생성된 미디어 패킷
        """
        while True:
            try:
                # 다음 요청 대기
                request_data = await self.request_queue.get()
                
                async with self.processing_lock:
                    # 처리 시작 시간 기록
                    start_time = now_ms()
                    
                    # 🆕 더 이상 취소 이벤트를 생성하지 않음 (순차 처리 보장)
                    request_data['start_time'] = start_time
                    self.current_processing = request_data
                    self.is_processing = True
                    
                    logger.info(f"🎬 요청 처리 시작 (순차모드): {request_data.get('message', '')[:30]}... (seq: {self.seq})")
                    
                    try:
                        # 🆕 취소 없는 MediaTrack 생성
                        tracks = await media_processor.generate_tracks_no_cancellation(
                            request_data
                        )
                        
                        if tracks:
                            # 처리 완료 시간 계산
                            processing_time = (now_ms() - start_time) / 1000.0  # 초 단위
                            
                            # MediaPacket 생성
                            media_packet = self.build_packet(tracks)
                            logger.info(f"✅ MediaPacket 생성 완료: {media_packet.hash} (seq: {media_packet.seq})")
                            
                            # Response Queue에 추가
                            await self.enqueue_response(media_packet)
                            
                            # 성공 메트릭 업데이트
                            self._update_processing_metrics(processing_time, 'completed')
                            
                            logger.info(f"📦 [REQ-PROCESSOR] MediaPacket 생성 및 Response Queue 이동 완료")
                            
                        else:
                            # 실패한 경우 메트릭 업데이트
                            processing_time = (now_ms() - start_time) / 1000.0
                            self._update_processing_metrics(processing_time, 'failed')
                            logger.info(f"❌ MediaTrack 생성 실패: {request_data.get('message', '')[:30]}")
                            
                    except Exception as e:
                        # 실패한 경우 메트릭 업데이트
                        processing_time = (now_ms() - start_time) / 1000.0
                        self._update_processing_metrics(processing_time, 'failed')
                        logger.error(f"❌ 요청 처리 실패: {str(e)}")
                        
                    finally:
                        # 처리 완료 상태 리셋
                        self.current_processing = None
                        self.is_processing = False
                        self.request_queue.task_done()
                        
            except Exception as e:
                logger.error(f"❌ Queue 처리 오류: {str(e)}")
    
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
    
    def get_detailed_queue_info(self) -> Dict[str, Any]:
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
        
        # 🆕 Request Queue 대기 요청들 정보 
        pending_requests = []
        try:
            temp_items = []
            while not self.request_queue.empty():
                try:
                    item = self.request_queue.get_nowait()
                    temp_items.append(item)
                except asyncio.QueueEmpty:
                    break
            
            for index, item in enumerate(temp_items):
                pending_requests.append({
                    "position": index + 1,
                    "message": item.get('message', '')[:50],
                    "username": item.get('username', 'unknown'),
                    "user_id": item.get('user_id'),
                    "timestamp": item.get('timestamp', 0),
                    "waiting_time": (now_ms() - item.get('timestamp', 0) * 1000) / 1000 if item.get('timestamp') else 0
                })
            
            for item in temp_items:
                self.request_queue.put_nowait(item)
                
        except Exception as e:
            logger.warning(f"Request Queue 내용 조회 중 오류: {e}")
            pending_requests = []
        
        # 🆕 Response Queue 대기 MediaPacket들 정보
        pending_media_packets = []
        try:
            temp_packets = []
            while not self.response_queue.empty():
                try:
                    packet = self.response_queue.get_nowait()
                    temp_packets.append(packet)
                except asyncio.QueueEmpty:
                    break
            
            for index, packet in enumerate(temp_packets):
                # 오디오 트랙에서 예상 재생시간 추출
                duration = 0
                for track in packet.tracks:
                    if track.kind == "audio" and track.meta:
                        duration = max(duration, track.dur_ms / 1000.0)
                
                pending_media_packets.append({
                    "position": index + 1,
                    "seq": packet.seq,
                    "hash": packet.hash[:8],
                    "tracks_count": len(packet.tracks),
                    "track_types": [track.kind for track in packet.tracks],
                    "estimated_duration": round(duration, 1),
                    "created_at": packet.t0_ms
                })
            
            for packet in temp_packets:
                self.response_queue.put_nowait(packet)
                
        except Exception as e:
            logger.warning(f"Response Queue 내용 조회 중 오류: {e}")
            pending_media_packets = []
        
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
            
            # 메트릭
            "metrics": {
                "total_processed": self.total_processed,
                "cancelled_requests": self.cancelled_requests,
                "avg_processing_time": avg_processing_time,
                "max_queue_length": self.max_queue_length,
                "recent_processing_times": self.processing_times.copy(),
                "recent_hashes_count": len(self._recent_hashes)
            },
            
            # 최근 처리 이력
            "recent_history": self.recent_history.copy()
        }
    
    def _update_processing_metrics(self, processing_time: float, status: str = 'completed'):
        """처리 메트릭 업데이트"""
        if status == 'completed':
            self.total_processed += 1
            
            # 처리 시간 기록 (최근 10개만 유지)
            self.processing_times.append(processing_time)
            if len(self.processing_times) > 10:
                self.processing_times.pop(0)
                
        elif status == 'cancelled':
            self.cancelled_requests += 1
            
        elif status == 'failed':
            # 실패한 요청도 카운트하지만 별도 추적 없음 (로그로 충분)
            pass
        
        # 최대 큐 길이 업데이트
        current_queue_length = self.request_queue.qsize()
        if current_queue_length > self.max_queue_length:
            self.max_queue_length = current_queue_length
        
        # 최근 이력 업데이트 (최근 10개만 유지)
        history_item = {
            "timestamp": now_ms(),
            "message": self.current_processing.get('message', '')[:30] if self.current_processing else '',
            "username": self.current_processing.get('username', 'unknown') if self.current_processing else '',
            "status": status,
            "processing_time": processing_time,
            "seq": self.seq - 1 if status == 'completed' else None
        }
        
        self.recent_history.insert(0, history_item)
        if len(self.recent_history) > 10:
            self.recent_history.pop()
        
        logger.info(f"📊 메트릭 업데이트: {status}, 처리시간: {processing_time:.2f}초, 큐크기: {current_queue_length}, 총처리: {self.total_processed}")
    
    def reset_sequence(self):
        """시퀀스 번호 리셋 (디버깅용)"""
        self.seq = 0
        self._recent_hashes.clear()