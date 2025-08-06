// 오디오 재생 서비스 - TTS로 생성된 오디오 파일 재생 관리
export class AudioService {
  constructor(audioRef) {
    this.audioRef = audioRef;    // React useRef로 생성된 audio 엘리먼트 참조
    this.onPlayingChange = null; // 재생 상태 변경 콜백 (UI 업데이트용)
    this.onEnded = null;         // 재생 완료 콜백
  }

  // TTS로 생성된 오디오 URL을 재생하고 지속시간을 반환
  // 반환값: Promise<number> - 오디오 지속시간(초)
  async playAudio(audioUrl) {
    if (!this.audioRef.current) {
      throw new Error('Audio element not available');
    }

    return new Promise((resolve, reject) => {
      // Step 1: 오디오 소스 설정 (Blob URL)
      this.audioRef.current.src = audioUrl;
      
      // Step 2: 오디오 메타데이터 로딩 완료 시 재생 시작
      this.audioRef.current.onloadeddata = () => {
        // 오디오 총 지속시간 획득 (텍스트 동기화에 필요)
        const duration = this.audioRef.current.duration;
        
        // 오디오 재생 시작
        this.audioRef.current.play()
          .then(() => {
            // 재생 상태를 true로 업데이트 (UI에서 재생 중 표시)
            if (this.onPlayingChange) this.onPlayingChange(true);
            // 지속시간을 Promise로 반환 (텍스트 동기화에서 사용)
            resolve(duration);
          })
          .catch(reject);
      };

      // Step 3: 오디오 로딩/재생 실패 시 에러 핸들링
      this.audioRef.current.onerror = () => {
        reject(new Error('Audio playback failed'));
      };
    });
  }

  // 오디오 재생 중단 (사용자가 Stop 버튼 클릭 시)
  stopAudio() {
    if (this.audioRef.current && !this.audioRef.current.paused) {
      this.audioRef.current.pause();
      // 재생 상태를 false로 업데이트 (UI에서 정지 상태 표시)
      if (this.onPlayingChange) this.onPlayingChange(false);
    }
  }

  // 오디오 리소스 정리 (메모리 누수 방지)
  cleanupAudio() {
    if (this.audioRef.current?.src) {
      // Blob URL 해제 (브라우저 메모리에서 오디오 데이터 제거)
      URL.revokeObjectURL(this.audioRef.current.src);
      this.audioRef.current.src = '';
    }
  }

  // 콜백 함수 설정 (UI 상태 업데이트용)
  setCallbacks(onPlayingChange, onEnded) {
    this.onPlayingChange = onPlayingChange; // 재생/정지 상태 변경 시 호출
    this.onEnded = onEnded;                 // 재생 완료 시 호출
  }
}