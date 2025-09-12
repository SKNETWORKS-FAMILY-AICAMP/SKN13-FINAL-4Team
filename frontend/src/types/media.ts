/**
 * DDD 기반 StreamSession MediaPacket 타입 정의
 * Backend의 MediaPacket, MediaTrack와 1:1 매핑
 */

export type MediaKind = "audio" | "video" | "subtitle";

export interface MediaTrack {
  kind: MediaKind;
  pts: number;  // Presentation Time Stamp (ms)
  dur: number;  // Duration (ms)
  payload_ref: string;  // 미디어 데이터 참조 (URL 또는 데이터)
  codec: string;  // 코덱 정보
  meta: Record<string, any>;  // 메타데이터
}

export interface MediaPacket {
  v: number;  // 버전
  session_id: string;  // 세션 ID
  seq: number;  // 시퀀스 번호
  t0: number;  // 세션 시작 시점 (ms)
  tracks: MediaTrack[];  // 트랙 목록
  hash: string;  // 패킷 해시 (무결성 검증용)
}

export interface SessionInfo {
  session_id: string;
  t0_ms: number;
  current_seq: number;
  uptime_ms: number;
  recent_hashes_count: number;
  // Queue 상태 정보
  queue_length: number;
  is_processing: boolean;
  current_request?: string;
}

export interface QueueState {
  session_id: string;
  current_seq: number;
  queue_length: number;
  processing_status: 'idle' | 'generating' | 'cancelled';
  last_packet_hash?: string;
}

export interface WebSocketMediaPacketMessage {
  type: 'media_packet';
  packet: MediaPacket;
  session_info: SessionInfo;
  server_timestamp: number;
  message_type: 'ai_mediapacket';
  timestamp: number;
}

export interface WebSocketQueueStatusMessage {
  type: 'queue_status_update';
  session_info: SessionInfo;
  timestamp: number;
  message_type: 'system_queue_status';
}

// MediaPacket 타입 가드 함수들
export const isMediaTrack = (obj: any): obj is MediaTrack => {
  return obj &&
    typeof obj.kind === 'string' &&
    ['audio', 'video', 'subtitle'].includes(obj.kind) &&
    typeof obj.pts === 'number' &&
    typeof obj.dur === 'number' &&
    typeof obj.payload_ref === 'string' &&
    typeof obj.codec === 'string' &&
    typeof obj.meta === 'object';
};

export const isMediaPacket = (obj: any): obj is MediaPacket => {
  return obj &&
    typeof obj.v === 'number' &&
    typeof obj.session_id === 'string' &&
    typeof obj.seq === 'number' &&
    typeof obj.t0 === 'number' &&
    Array.isArray(obj.tracks) &&
    obj.tracks.every(isMediaTrack) &&
    typeof obj.hash === 'string';
};

export const isWebSocketMediaPacketMessage = (obj: any): obj is WebSocketMediaPacketMessage => {
  return obj &&
    obj.type === 'media_packet' &&
    isMediaPacket(obj.packet) &&
    typeof obj.session_info === 'object' &&
    typeof obj.server_timestamp === 'number';
};

export const isWebSocketQueueStatusMessage = (obj: any): obj is WebSocketQueueStatusMessage => {
  return obj &&
    obj.type === 'queue_status_update' &&
    typeof obj.session_info === 'object' &&
    typeof obj.timestamp === 'number';
};

// MediaPacket 유틸리티 함수들
export const getAudioTrack = (packet: MediaPacket): MediaTrack | undefined => {
  return packet.tracks.find(track => track.kind === 'audio');
};

export const getVideoTrack = (packet: MediaPacket): MediaTrack | undefined => {
  return packet.tracks.find(track => track.kind === 'video');
};

export const getSubtitleTrack = (packet: MediaPacket): MediaTrack | undefined => {
  return packet.tracks.find(track => track.kind === 'subtitle');
};

export const getTotalDuration = (packet: MediaPacket): number => {
  return Math.max(...packet.tracks.map(track => track.dur));
};

export const validatePacketIntegrity = (packet: MediaPacket): boolean => {
  // 기본 구조 검증
  if (!isMediaPacket(packet)) return false;
  
  // 시퀀스 번호 검증
  if (packet.seq < 0) return false;
  
  // 트랙 유효성 검증
  for (const track of packet.tracks) {
    if (track.pts < 0 || track.dur <= 0) return false;
    if (!track.payload_ref || !track.codec) return false;
  }
  
  return true;
};