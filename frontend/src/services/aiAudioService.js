// AI 오디오 재생 서비스 - AI 챗봇 전용 TTS 오디오 파일 재생 관리
export class AIAudioService {
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
      const audio = this.audioRef.current;
      
      // 이미 소스가 설정되어 있다면 바로 재생
      if (audio.src === audioUrl && audio.readyState >= 4) {
        const duration = audio.duration;
        
        audio.play()
          .then(() => {
            if (this.onPlayingChange) this.onPlayingChange(true);
            resolve(duration);
          })
          .catch(reject);
        return;
      }
      
      // Step 1: 오디오 소스 설정 (이미 StreamingChatWithTTS에서 설정됨)
      if (audio.src !== audioUrl) {
        audio.src = audioUrl;
      }
      
      // Step 2: 충분한 데이터 로딩 완료 시 재생 시작
      const handleCanPlay = () => {
        // 이벤트 리스너 정리
        audio.removeEventListener('canplaythrough', handleCanPlay);
        audio.removeEventListener('error', handleError);
        
        // 오디오 총 지속시간 획득
        const duration = audio.duration;
        
        // 오디오 재생 시작
        audio.play()
          .then(() => {
            // 재생 상태를 true로 업데이트
            if (this.onPlayingChange) this.onPlayingChange(true);
            
            // 재생 완료 이벤트 리스너 설정
            const handleEnded = () => {
              if (this.onPlayingChange) this.onPlayingChange(false);
              if (this.onEnded) this.onEnded();
              audio.removeEventListener('ended', handleEnded);
            };
            audio.addEventListener('ended', handleEnded);
            
            // 지속시간을 Promise로 반환
            resolve(duration);
          })
          .catch(reject);
      };

      // Step 3: 오디오 로딩/재생 실패 시 에러 핸들링
      const handleError = () => {
        audio.removeEventListener('canplaythrough', handleCanPlay);
        audio.removeEventListener('error', handleError);
        reject(new Error('Audio playback failed'));
      };

      // 이벤트 리스너 등록
      audio.addEventListener('canplaythrough', handleCanPlay);
      audio.addEventListener('error', handleError);
      
      // 이미 로딩이 완료된 경우 즉시 실행
      if (audio.readyState >= 4) {
        handleCanPlay();
      }
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