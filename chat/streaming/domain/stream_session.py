"""
스트리밍 도메인 모델
DDD 아키텍처 기반 StreamSession, MediaPacket, MediaTrack 구현
"""
from dataclasses import dataclass, field
import hashlib
import time
from typing import Literal, Optional, Dict, Any, List
import uuid

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
    """스트리밍 세션 애그리게이트 루트"""
    
    def __init__(self, session_id: Optional[str] = None):
        self.session_id = session_id or uuid.uuid4().hex
        self.t0_ms = now_ms()  # 세션 시작 시점
        self.seq = 0  # 시퀀스 번호
        self._recent_hashes: List[str] = []  # 중복 패킷 방지용 (최근 50개 저장)
        
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
        
        # 패킷 해시 생성 (트랙 내용 기반)
        raw_content = "|".join(
            f"{t.kind}:{t.pts_ms}:{t.dur_ms}:{t.payload_ref}:{t.codec}"
            for t in tracks
        )
        packet_hash = hashlib.sha256(raw_content.encode()).hexdigest()[:16]  # 16자리로 단축
        
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
    
    def get_session_info(self) -> Dict[str, Any]:
        """세션 정보 반환"""
        return {
            "session_id": self.session_id,
            "t0_ms": self.t0_ms,
            "current_seq": self.seq,
            "uptime_ms": now_ms() - self.t0_ms,
            "recent_hashes_count": len(self._recent_hashes)
        }
    
    def reset_sequence(self):
        """시퀀스 번호 리셋 (디버깅용)"""
        self.seq = 0
        self._recent_hashes.clear()