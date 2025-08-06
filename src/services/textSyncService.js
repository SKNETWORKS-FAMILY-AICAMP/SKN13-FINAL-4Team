// 텍스트 동기화 서비스 - 오디오 재생과 텍스트 표시를 동기화
export class TextSyncService {
  constructor(settings) {
    this.settings = settings; // chunkSize, streamingDelay 등 설정값
    this.intervalRef = null;  // setInterval 참조 (정리용)
    this.onTextReveal = null; // 텍스트 업데이트 콜백
    this.onComplete = null;   // 완료 시 콜백
  }

  // 오디오 재생시간과 동기화된 텍스트 표시
  // 핵심: 오디오 길이에 맞춰 텍스트를 점진적으로 드러냄
  startSynchronizedReveal(text, audioDuration) {
    // 이전 인터벌이 있다면 정리
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
    }

    // 동기화 계산
    const totalCharacters = text.length;
    // 한 글자당 표시 시간 = 총 오디오 시간 / 총 글자 수
    const intervalTime = (audioDuration * 1000) / totalCharacters;
    let currentIndex = 0;

    // 정기적으로 텍스트 청크를 표시하는 인터벌 시작
    this.intervalRef = setInterval(() => {
      if (currentIndex < totalCharacters) {
        // 다음 청크 인덱스 계산 (chunkSize만큼 건너뜀)
        const nextIndex = Math.min(currentIndex + this.settings.chunkSize, totalCharacters);
        // 현재까지 표시할 텍스트 추출
        const revealedText = text.substring(0, nextIndex);
        
        // UI 컴포넌트에 업데이트된 텍스트 전달
        if (this.onTextReveal) {
          this.onTextReveal(revealedText);
        }
        
        currentIndex = nextIndex;
      } else {
        // 모든 텍스트 표시 완료
        this.stopReveal();
        if (this.onComplete) {
          this.onComplete(text);
        }
      }
    }, intervalTime * this.settings.chunkSize); // chunkSize에 비례한 인터벌
  }

  // 오디오 없이 단순히 지연시간을 두고 텍스트 표시 (TTS 실패 시 사용)
  startDelayedReveal(text, onComplete) {
    if (this.intervalRef) {
      clearTimeout(this.intervalRef);
    }

    let currentIndex = 0;
    const chunkSize = this.settings.chunkSize;
    
    // 재귀적으로 다음 청크를 표시하는 함수
    const displayNextChunk = () => {
      if (currentIndex < text.length) {
        // 다음 청크 범위 계산
        const nextIndex = Math.min(currentIndex + chunkSize, text.length);
        const revealedText = text.substring(0, nextIndex);
        
        // 텍스트 업데이트
        if (this.onTextReveal) {
          this.onTextReveal(revealedText);
        }
        
        currentIndex = nextIndex;
        // 설정된 지연시간 후 다음 청크 표시
        this.intervalRef = setTimeout(displayNextChunk, this.settings.streamingDelay);
      } else {
        // 모든 텍스트 표시 완료
        if (onComplete) onComplete();
      }
    };
    
    // 첫 번째 청크부터 시작
    displayNextChunk();
  }

  stopReveal() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
  }

  setCallbacks(onTextReveal, onComplete) {
    this.onTextReveal = onTextReveal;
    this.onComplete = onComplete;
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
  }
}