/**
 * MediaPacket 기반 동기화 컨트롤러
 * 지터버퍼 300ms 적용 + seq 기반 순차 재생
 * DDD StreamSession과 연계된 큐 시스템
 */

class MediaPacketSyncController {
  constructor() {
    this.JITTER_MS = 300;  // 지터버퍼 300ms
    this.packetQueue = [];  // MediaPacket 대기열
    this.playingPackets = new Map();  // 현재 재생 중인 패킷들
    this.lastProcessedSeq = -1;  // 마지막 처리된 시퀀스 번호
    this.sessionId = null;  // 현재 세션 ID
    this.isProcessing = false;  // 처리 중 플래그
    
    // 🆕 Queue 메트릭 추적
    this.queueMetrics = {
      totalPacketsReceived: 0,
      totalPacketsPlayed: 0,
      totalPacketsFailed: 0,
      packetsDropped: 0,  // 시퀀스 순서 문제로 드롭된 패킷들
      duplicatePackets: 0,
      outOfOrderPackets: 0,
      maxQueueLength: 0,
      averageJitterMs: 0,
      processingTimes: [], // 최근 10개 패킷의 처리 시간
      playbackLatencies: [], // 최근 10개 패킷의 재생 지연
      trackTypeCounts: { audio: 0, video: 0, subtitle: 0 },
      sessionStartTime: Date.now(),
      lastPacketReceivedTime: null,
      lastPacketPlayedTime: null
    };
    
    // 재생 상태 콜백
    this.onPacketPlay = null;
    this.onPacketEnd = null;
    this.onQueueStatusChange = null;
    
    // 비디오/오디오 참조 (React에서 설정)
    this.videoTransitionManager = null;
    this.audioRef = null;
    
    console.log('🎬 MediaPacketSyncController 초기화 (Queue 메트릭 포함)');
  }
  
  /**
   * React 참조 설정
   */
  setReferences(videoTransitionManager, audioRef) {
    this.videoTransitionManager = videoTransitionManager;
    this.audioRef = audioRef;
    console.log('🔗 MediaPacketSyncController 참조 설정 완료');
  }

  /**
   * MediaPacket 수신 처리
   * @param {Object} packet - 수신된 MediaPacket
   * @param {number} serverTimestamp - 서버 타임스탬프
   */
  onMediaPacketReceived(packet, serverTimestamp) {
    const receivedTime = Date.now();
    console.log(`📦 MediaPacket 수신: seq=${packet.seq}, hash=${packet.hash.substring(0, 8)}`);
    
    // 🆕 메트릭 업데이트: 총 수신 패킷 수
    this.queueMetrics.totalPacketsReceived++;
    this.queueMetrics.lastPacketReceivedTime = receivedTime;
    
    // 패킷 유효성 검증
    if (!this.validatePacket(packet)) {
      console.warn('⚠️ 유효하지 않은 MediaPacket:', packet);
      this.queueMetrics.totalPacketsFailed++;
      return;
    }
    
    // 세션 ID 설정 (첫 패킷)
    if (!this.sessionId) {
      this.sessionId = packet.session_id;
      // 🆕 중간 접속 처리: seq 가 0이 아니면 현재 시퀀스로 동기화
      if (packet.seq > 0) {
        this.lastProcessedSeq = packet.seq - 1;
        console.log(`🆔 중간 접속 감지: 세션 ${this.sessionId}, 시작 시퀀스: ${packet.seq}`);
      } else {
        console.log(`🆔 세션 ID 설정: ${this.sessionId}, 첫 번째 클라이언트`);
      }
    }
    
    // 세션 ID 불일치 체크
    if (packet.session_id !== this.sessionId) {
      console.warn(`⚠️ 세션 ID 불일치: 현재=${this.sessionId}, 수신=${packet.session_id}`);
      this.queueMetrics.totalPacketsFailed++;
      return;
    }
    
    // 중복 패킷 체크 (이미 처리된 seq)
    if (packet.seq <= this.lastProcessedSeq) {
      console.warn(`⚠️ 중복/구형 패킷: seq=${packet.seq}, lastProcessed=${this.lastProcessedSeq}`);
      this.queueMetrics.duplicatePackets++;
      return;
    }
    
    // 🆕 순서 이탈 패킷 체크
    const expectedSeq = this.lastProcessedSeq + 1;
    if (packet.seq > expectedSeq + 1) { // 1개 초과의 시퀀스 건너뜀
      this.queueMetrics.outOfOrderPackets++;
      console.warn(`⚠️ 순서 이탈 패킷: seq=${packet.seq}, 예상=${expectedSeq}`);
    }
    
    // 지터버퍼를 고려한 재생 시점 계산
    const scheduledPlayTime = receivedTime + this.JITTER_MS;
    
    // 🆕 네트워크 지연 계산 (서버 타임스탬프 기반)
    const networkLatency = serverTimestamp ? (receivedTime - serverTimestamp * 1000) : 0;
    
    // 패킷에 스케줄링 정보 추가
    const scheduledPacket = {
      ...packet,
      scheduledPlayTime,
      serverTimestamp,
      receivedTime,
      networkLatency
    };
    
    // 🆕 트랙 타입 통계 업데이트
    scheduledPacket.tracks.forEach(track => {
      if (this.queueMetrics.trackTypeCounts[track.kind] !== undefined) {
        this.queueMetrics.trackTypeCounts[track.kind]++;
      }
    });
    
    // 패킷을 시퀀스 순서대로 삽입
    this.insertPacketInOrder(scheduledPacket);
    
    // 🆕 최대 큐 길이 업데이트
    if (this.packetQueue.length > this.queueMetrics.maxQueueLength) {
      this.queueMetrics.maxQueueLength = this.packetQueue.length;
    }
    
    // 지터버퍼 후 처리 시작
    setTimeout(() => this.processPacketQueue(), this.JITTER_MS);
    
    this.notifyQueueStatusChange();
  }

  /**
   * 패킷을 시퀀스 순서대로 큐에 삽입
   * @param {Object} scheduledPacket - 스케줄링된 패킷
   */
  insertPacketInOrder(scheduledPacket) {
    // 시퀀스 번호 순으로 삽입
    let insertIndex = this.packetQueue.length;
    for (let i = 0; i < this.packetQueue.length; i++) {
      if (scheduledPacket.seq < this.packetQueue[i].seq) {
        insertIndex = i;
        break;
      }
    }
    
    this.packetQueue.splice(insertIndex, 0, scheduledPacket);
    console.log(`📝 패킷 큐에 삽입: seq=${scheduledPacket.seq}, 큐 크기=${this.packetQueue.length}`);
  }

  /**
   * 패킷 큐를 순차적으로 처리
   */
  async processPacketQueue() {
    if (this.isProcessing || this.packetQueue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // 다음 순서의 패킷만 처리 (seq 순서 보장)
      while (this.packetQueue.length > 0) {
        const nextPacket = this.packetQueue[0];
        
        // 다음 예상 시퀀스가 아니면 대기
        if (nextPacket.seq !== this.lastProcessedSeq + 1) {
          console.log(`⏳ 시퀀스 대기 중: 다음=${this.lastProcessedSeq + 1}, 큐 첫번째=${nextPacket.seq}`);
          break;
        }
        
        // 패킷 제거 및 재생
        const packet = this.packetQueue.shift();
        await this.playMediaPacket(packet);
        
        this.lastProcessedSeq = packet.seq;
        this.notifyQueueStatusChange();
      }
    } catch (error) {
      console.error('❌ 패킷 큐 처리 오류:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * MediaPacket 재생
   * @param {Object} packet - 재생할 패킷
   */
  async playMediaPacket(packet) {
    const playStartTime = Date.now();
    console.log(`▶️ MediaPacket 재생 시작: seq=${packet.seq}, 트랙 수=${packet.tracks.length}`);
    
    try {
      // 🆕 재생 지연 시간 계산 (예정 시간 대비)
      const playbackLatency = playStartTime - packet.scheduledPlayTime;
      this.updatePlaybackLatency(playbackLatency);
      
      // 오디오 트랙을 먼저 찾아서 실제 재생 시간을 기준으로 함
      const audioTrack = packet.tracks.find(track => track.kind === 'audio');
      const videoTrack = packet.tracks.find(track => track.kind === 'video');
      const subtitleTrack = packet.tracks.find(track => track.kind === 'subtitle');
      
      // 재생 시작 알림
      if (this.onPacketPlay) {
        this.onPacketPlay(packet);
      }
      
      // 🆕 모든 트랙을 동시에 시작하되, 오디오 완료 시점으로 동기화
      const allPromises = [];
      let audioEndPromise = null;
      
      // 오디오 트랙 재생 시작 (완료 Promise 반환)
      if (audioTrack) {
        console.log('🎵 오디오 재생 시작 (동시 실행)');
        audioEndPromise = this.playAudioTrackWithDuration(audioTrack, packet);
        allPromises.push(audioEndPromise);
      }
      
      // 비디오와 자막을 즉시 시작하고, 오디오 완료와 동기화
      if (videoTrack && audioEndPromise) {
        allPromises.push(this.playVideoTrackWithAudioSync(videoTrack, packet, audioEndPromise));
      }
      
      if (subtitleTrack && audioEndPromise) {
        allPromises.push(this.playSubtitleTrackWithAudioSync(subtitleTrack, packet, audioEndPromise));
      }
      
      // 모든 트랙 재생 완료 대기
      if (allPromises.length > 0) {
        await Promise.all(allPromises);
      }
      
      // 🆕 처리 시간 계산 및 기록
      const processingTime = Date.now() - playStartTime;
      this.updateProcessingTime(processingTime);
      
      // 🆕 메트릭 업데이트
      this.queueMetrics.totalPacketsPlayed++;
      this.queueMetrics.lastPacketPlayedTime = Date.now();
      
      console.log(`✅ MediaPacket 재생 완료: seq=${packet.seq}, 처리시간=${processingTime}ms`);
      
      // 재생 완료 알림
      if (this.onPacketEnd) {
        this.onPacketEnd(packet);
      }
      
    } catch (error) {
      console.error(`❌ MediaPacket 재생 실패: seq=${packet.seq}`, error);
      // 🆕 실패 카운트 증가
      this.queueMetrics.totalPacketsFailed++;
    }
  }

  /**
   * 실제 재생 시간을 측정하면서 오디오 트랙 재생
   * @param {Object} track - 오디오 트랙
   * @param {Object} packet - 부모 패킷
   * @returns {Promise<number>} 실제 재생 시간(ms)
   */
  async playAudioTrackWithDuration(track, packet) {
    return new Promise((resolve, reject) => {
      try {
        const startTime = Date.now();
        console.log(`🔊 오디오 재생 시작 (시간 측정): ${track.dur}ms, engine=${track.meta?.engine || 'unknown'}`);
        
        // AudioRef 사용 (React 컴포넌트의 audio 요소)
        if (this.audioRef?.current) {
          const audio = this.audioRef.current;
          audio.src = track.payload_ref;
          audio.volume = 0.8;
          
          const handleEnded = () => {
            const actualDuration = Date.now() - startTime;
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError);
            console.log(`🔊 오디오 재생 완료 (실제 시간): seq=${packet.seq}, ${actualDuration}ms`);
            resolve(actualDuration);
          };
          
          const handleError = (error) => {
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError);
            console.error(`❌ 오디오 재생 실패: seq=${packet.seq}`, error);
            resolve(track.dur); // 폴백으로 예상 시간 반환
          };
          
          audio.addEventListener('ended', handleEnded);
          audio.addEventListener('error', handleError);
          
          audio.play().catch(handleError);
        } else {
          // AudioRef가 없으면 새로운 Audio 객체 사용
          const audio = new Audio(track.payload_ref);
          audio.volume = 0.8;
          
          audio.onended = () => {
            const actualDuration = Date.now() - startTime;
            console.log(`🔊 오디오 재생 완료 (실제 시간): seq=${packet.seq}, ${actualDuration}ms`);
            resolve(actualDuration);
          };
          
          audio.onerror = (error) => {
            console.error(`❌ 오디오 재생 실패: seq=${packet.seq}`, error);
            resolve(track.dur); // 폴백으로 예상 시간 반환
          };
          
          audio.play().catch(() => resolve(track.dur));
        }
        
      } catch (error) {
        console.error(`❌ 오디오 트랙 처리 실패: seq=${packet.seq}`, error);
        resolve(track.dur); // 폴백으로 예상 시간 반환
      }
    });
  }

  /**
   * 오디오 트랙 재생 (기존 메서드 유지)
   * @param {Object} track - 오디오 트랙
   * @param {Object} packet - 부모 패킷
   */
  async playAudioTrack(track, packet) {
    return new Promise((resolve, reject) => {
      try {
        console.log(`🔊 오디오 재생 시작: ${track.dur}ms, engine=${track.meta?.engine || 'unknown'}`);
        
        // AudioRef 사용 (React 컴포넌트의 audio 요소)
        if (this.audioRef?.current) {
          const audio = this.audioRef.current;
          audio.src = track.payload_ref;
          audio.volume = 0.8;
          
          const handleEnded = () => {
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError);
            console.log(`🔊 오디오 재생 완료: seq=${packet.seq}`);
            resolve();
          };
          
          const handleError = (error) => {
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError);
            console.error(`❌ 오디오 재생 실패: seq=${packet.seq}`, error);
            resolve(); // 실패해도 전체 재생은 계속
          };
          
          audio.addEventListener('ended', handleEnded);
          audio.addEventListener('error', handleError);
          
          audio.play().catch(handleError);
        } else {
          // AudioRef가 없으면 새로운 Audio 객체 사용
          const audio = new Audio(track.payload_ref);
          audio.volume = 0.8;
          
          audio.onended = () => {
            console.log(`🔊 오디오 재생 완료: seq=${packet.seq}`);
            resolve();
          };
          
          audio.onerror = (error) => {
            console.error(`❌ 오디오 재생 실패: seq=${packet.seq}`, error);
            resolve(); // 실패해도 전체 재생은 계속
          };
          
          audio.play().catch(resolve);
        }
        
      } catch (error) {
        console.error(`❌ 오디오 트랙 처리 실패: seq=${packet.seq}`, error);
        resolve(); // 실패해도 전체 재생은 계속
      }
    });
  }

  /**
   * 비디오 트랙 재생 (UI 업데이트)
   * @param {Object} track - 비디오 트랙
   * @param {Object} packet - 부모 패킷
   */
  async playVideoTrack(track, packet) {
    return new Promise((resolve) => {
      try {
        console.log(`🎥 MediaPacketSyncController.playVideoTrack 시작:`, {
          payloadRef: track.payload_ref,
          emotion: track.meta?.emotion || 'neutral',
          duration: track.dur,
          hasVideoTransitionManager: !!this.videoTransitionManager?.current,
          hasChangeVideoMethod: !!this.videoTransitionManager?.current?.changeVideo
        });
        
        // VideoTransitionManager 사용 (React 컴포넌트)
        if (this.videoTransitionManager?.current?.changeVideo) {
          const videoPath = track.payload_ref.replace(/^\/videos\//, '').replace(/^jammin-i\//, '');
          console.log(`🎥 VideoTransitionManager.changeVideo 호출: ${track.payload_ref} -> ${videoPath}`);
          this.videoTransitionManager.current.changeVideo(videoPath);
        } else {
          console.error('❌ VideoTransitionManager 또는 changeVideo 메서드가 없음:', {
            hasManager: !!this.videoTransitionManager,
            hasCurrent: !!this.videoTransitionManager?.current,
            hasChangeVideo: !!this.videoTransitionManager?.current?.changeVideo
          });
        }
        
        // 비디오 전환 이벤트 발생 (추가적인 UI 업데이트용)
        window.dispatchEvent(new CustomEvent('videoTrackChange', {
          detail: {
            videoPath: track.payload_ref,
            emotion: track.meta?.emotion,
            duration: track.dur,
            packet: packet
          }
        }));
        
        // 비디오 지속 시간 후 완료 및 idle 복귀
        setTimeout(() => {
          console.log(`🎥 비디오 재생 완료: seq=${packet.seq}, idle로 복귀 시작`);
          
          // idle 비디오로 복귀
          if (this.videoTransitionManager?.current?.changeVideo) {
            // characterId는 비디오 경로에서 추출 가능
            const characterMatch = track.payload_ref.match(/\/videos\/(\w+)\//);
            const characterId = characterMatch ? characterMatch[1] : 'hongseohyun';
            const idleVideo = `${characterId}_idle_2.mp4`;
            
            console.log(`🔄 idle 복귀: ${characterId} -> ${idleVideo}`);
            this.videoTransitionManager.current.changeVideo(idleVideo);
          }
          
          resolve();
        }, track.dur);
        
      } catch (error) {
        console.error(`❌ 비디오 트랙 처리 실패: seq=${packet.seq}`, error);
        resolve(); // 비디오 실패해도 전체 재생은 계속
      }
    });
  }

  /**
   * 오디오 완료와 동기화된 비디오 트랙 재생 (즉시 시작)
   * @param {Object} track - 비디오 트랙
   * @param {Object} packet - 부모 패킷
   * @param {Promise} audioEndPromise - 오디오 완료 Promise
   */
  async playVideoTrackWithAudioSync(track, packet, audioEndPromise) {
    return new Promise(async (resolve) => {
      try {
        console.log(`🎥 비디오 트랙 즉시 시작 (오디오와 동기화):`, {
          payloadRef: track.payload_ref,
          originalDuration: track.dur
        });
        
        // 비디오를 즉시 시작
        if (this.videoTransitionManager?.current?.changeVideo) {
          const videoPath = track.payload_ref.replace(/^\/videos\//, '').replace(/^jammin-i\//, '');
          console.log(`🎥 VideoTransitionManager.changeVideo 즉시 호출: ${track.payload_ref} -> ${videoPath}`);
          this.videoTransitionManager.current.changeVideo(videoPath);
        } else {
          console.error('❌ VideoTransitionManager 또는 changeVideo 메서드가 없음');
        }
        
        // 비디오 전환 이벤트 발생
        window.dispatchEvent(new CustomEvent('videoTrackChange', {
          detail: {
            videoPath: track.payload_ref,
            emotion: track.meta?.emotion,
            duration: track.dur, // 초기에는 예상 시간
            packet: packet
          }
        }));
        
        // 오디오 완료를 기다린 후 idle로 복귀
        try {
          const actualDuration = await audioEndPromise;
          console.log(`🎥 오디오 완료 감지, idle로 복귀: 실제 시간=${actualDuration}ms`);
          
          // idle 비디오로 복귀
          if (this.videoTransitionManager?.current?.changeVideo) {
            const characterMatch = track.payload_ref.match(/\/videos\/(\w+)\//);
            const characterId = characterMatch ? characterMatch[1] : 'hongseohyun';
            
            // 사용 가능한 idle 비디오 찾기
            const idleOptions = [`${characterId}_idle_1.mp4`, `${characterId}_idle_2.mp4`, `${characterId}_idle_3.mp4`];
            const idleVideo = idleOptions[0]; // 첫 번째 옵션 사용
            
            console.log(`🔄 오디오 동기화 idle 복귀: ${characterId} -> ${idleVideo}`);
            this.videoTransitionManager.current.changeVideo(idleVideo);
          }
          
          resolve();
        } catch (error) {
          console.error('❌ 오디오 완료 대기 중 오류:', error);
          resolve();
        }
        
      } catch (error) {
        console.error(`❌ 동기화된 비디오 트랙 처리 실패: seq=${packet.seq}`, error);
        resolve();
      }
    });
  }

  /**
   * 실제 오디오 재생 시간에 동기화된 비디오 트랙 재생 (기존 메서드)
   * @param {Object} track - 비디오 트랙
   * @param {Object} packet - 부모 패킷
   * @param {number} actualAudioDuration - 실제 오디오 재생 시간(ms)
   */
  async playVideoTrackSynchronized(track, packet, actualAudioDuration) {
    return new Promise((resolve) => {
      try {
        console.log(`🎥 동기화된 비디오 트랙 재생:`, {
          payloadRef: track.payload_ref,
          originalDuration: track.dur,
          actualAudioDuration,
          emotion: track.meta?.emotion || 'neutral'
        });
        
        // VideoTransitionManager 사용 (React 컴포넌트)
        if (this.videoTransitionManager?.current?.changeVideo) {
          const videoPath = track.payload_ref.replace(/^\/videos\//, '').replace(/^jammin-i\//, '');
          console.log(`🎥 VideoTransitionManager.changeVideo 호출 (동기화): ${track.payload_ref} -> ${videoPath}`);
          this.videoTransitionManager.current.changeVideo(videoPath);
        } else {
          console.error('❌ VideoTransitionManager 또는 changeVideo 메서드가 없음');
        }
        
        // 비디오 전환 이벤트 발생 (추가적인 UI 업데이트용)
        window.dispatchEvent(new CustomEvent('videoTrackChange', {
          detail: {
            videoPath: track.payload_ref,
            emotion: track.meta?.emotion,
            duration: actualAudioDuration, // 실제 오디오 시간 사용
            packet: packet
          }
        }));
        
        // 실제 오디오 재생 시간 후 완료 및 idle 복귀
        setTimeout(() => {
          console.log(`🎥 동기화된 비디오 재생 완료: seq=${packet.seq}, idle로 복귀 시작`);
          
          // idle 비디오로 복귀
          if (this.videoTransitionManager?.current?.changeVideo) {
            const characterMatch = track.payload_ref.match(/\/videos\/(\w+)\//);
            const characterId = characterMatch ? characterMatch[1] : 'hongseohyun';
            const idleVideo = `${characterId}_idle_2.mp4`;
            
            console.log(`🔄 동기화된 idle 복귀: ${characterId} -> ${idleVideo}`);
            this.videoTransitionManager.current.changeVideo(idleVideo);
          }
          
          resolve();
        }, actualAudioDuration);
        
      } catch (error) {
        console.error(`❌ 비디오 트랙 처리 실패: seq=${packet.seq}`, error);
        resolve(); // 비디오 실패해도 전체 재생은 계속
      }
    });
  }

  /**
   * 자막 트랙 재생
   * @param {Object} track - 자막 트랙
   * @param {Object} packet - 부모 패킷
   */
  async playSubtitleTrack(track, packet) {
    return new Promise((resolve) => {
      try {
        console.log(`💬 MediaPacketSyncController.playSubtitleTrack 시작:`, {
          payloadRef: track.payload_ref?.substring(0, 100) + '...',
          duration: track.dur,
          rawPayload: track.payload_ref
        });
        
        const subtitleData = JSON.parse(track.payload_ref);
        console.log(`💬 자막 파싱 성공:`, {
          segmentCount: subtitleData.segments?.length || 0,
          segments: subtitleData.segments
        });
        
        // 자막 표시 이벤트 발생
        console.log('💬 subtitleTrackChange 이벤트 발생');
        window.dispatchEvent(new CustomEvent('subtitleTrackChange', {
          detail: {
            subtitleData,
            duration: track.dur,
            packet: packet
          }
        }));
        
        // 자막 지속 시간 후 완료
        setTimeout(() => {
          console.log(`💬 자막 표시 완료: seq=${packet.seq}`);
          resolve();
        }, track.dur);
        
      } catch (error) {
        console.error(`❌ 자막 트랙 처리 실패: seq=${packet.seq}`, error);
        console.error('❌ 자막 payload_ref:', track.payload_ref);
        resolve(); // 자막 실패해도 전체 재생은 계속
      }
    });
  }

  /**
   * 오디오 완료와 동기화된 자막 트랙 재생 (즉시 시작)
   * @param {Object} track - 자막 트랙
   * @param {Object} packet - 부모 패킷
   * @param {Promise} audioEndPromise - 오디오 완료 Promise
   */
  async playSubtitleTrackWithAudioSync(track, packet, audioEndPromise) {
    return new Promise(async (resolve) => {
      try {
        console.log(`💬 자막 트랙 즉시 시작 (오디오와 동기화):`, {
          originalDuration: track.dur,
          payloadRef: track.payload_ref?.substring(0, 100) + '...'
        });
        
        // 자막을 즉시 파싱하고 표시
        const subtitleData = JSON.parse(track.payload_ref);
        console.log(`💬 자막 즉시 파싱:`, {
          segmentCount: subtitleData.segments?.length || 0,
          segments: subtitleData.segments
        });
        
        // 자막 표시 이벤트 즉시 발생
        console.log('💬 자막 즉시 표시 이벤트 발생');
        window.dispatchEvent(new CustomEvent('subtitleTrackChange', {
          detail: {
            subtitleData,
            duration: track.dur, // 초기에는 예상 시간
            packet: packet
          }
        }));
        
        // 오디오 완료를 기다린 후 자막 숨김
        try {
          console.log('💬 오디오 완료 대기 시작...');
          const actualDuration = await audioEndPromise;
          console.log(`💬 오디오 완료 감지! 자막 숨김 실행: 실제 시간=${actualDuration}ms`);
          
          // 자막 숨김을 위한 커스텀 이벤트 발생
          console.log('💬 자막 숨김 이벤트 발생');
          window.dispatchEvent(new CustomEvent('subtitleHide', {
            detail: {
              reason: 'audio_completed',
              actualDuration: actualDuration,
              packet: packet
            }
          }));
          
          resolve();
        } catch (error) {
          console.error('❌ 오디오 완료 대기 중 오류 (자막):', error);
          resolve();
        }
        
      } catch (error) {
        console.error(`❌ 동기화된 자막 트랙 처리 실패: seq=${packet.seq}`, error);
        console.error('❌ 자막 payload_ref:', track.payload_ref);
        resolve();
      }
    });
  }

  /**
   * 실제 오디오 재생 시간에 동기화된 자막 트랙 재생 (기존 메서드)
   * @param {Object} track - 자막 트랙
   * @param {Object} packet - 부모 패킷
   * @param {number} actualAudioDuration - 실제 오디오 재생 시간(ms)
   */
  async playSubtitleTrackSynchronized(track, packet, actualAudioDuration) {
    return new Promise((resolve) => {
      try {
        console.log(`💬 동기화된 자막 트랙 재생:`, {
          originalDuration: track.dur,
          actualAudioDuration,
          payloadRef: track.payload_ref?.substring(0, 100) + '...'
        });
        
        const subtitleData = JSON.parse(track.payload_ref);
        console.log(`💬 동기화된 자막 파싱 성공:`, {
          segmentCount: subtitleData.segments?.length || 0,
          segments: subtitleData.segments
        });
        
        // 자막 표시 이벤트 발생 (실제 오디오 시간 사용)
        console.log('💬 동기화된 subtitleTrackChange 이벤트 발생');
        window.dispatchEvent(new CustomEvent('subtitleTrackChange', {
          detail: {
            subtitleData,
            duration: actualAudioDuration, // 실제 오디오 시간 사용
            packet: packet
          }
        }));
        
        // 실제 오디오 재생 시간 후 완료
        setTimeout(() => {
          console.log(`💬 동기화된 자막 표시 완료: seq=${packet.seq}`);
          resolve();
        }, actualAudioDuration);
        
      } catch (error) {
        console.error(`❌ 동기화된 자막 트랙 처리 실패: seq=${packet.seq}`, error);
        console.error('❌ 자막 payload_ref:', track.payload_ref);
        resolve(); // 자막 실패해도 전체 재생은 계속
      }
    });
  }

  /**
   * 패킷 유효성 검증
   * @param {Object} packet - 검증할 패킷
   */
  validatePacket(packet) {
    if (!packet || typeof packet !== 'object') return false;
    if (typeof packet.seq !== 'number' || packet.seq < 0) return false;
    if (typeof packet.session_id !== 'string') return false;
    if (!Array.isArray(packet.tracks) || packet.tracks.length === 0) return false;
    if (typeof packet.hash !== 'string') return false;
    
    // 각 트랙 유효성 검증
    for (const track of packet.tracks) {
      if (!track.kind || !['audio', 'video', 'subtitle'].includes(track.kind)) return false;
      if (typeof track.pts !== 'number' || track.pts < 0) return false;
      if (typeof track.dur !== 'number' || track.dur <= 0) return false;
      if (typeof track.payload_ref !== 'string' || !track.payload_ref) return false;
    }
    
    return true;
  }

  /**
   * 🆕 처리 시간 업데이트 (최근 10개 유지)
   */
  updateProcessingTime(processingTime) {
    this.queueMetrics.processingTimes.push(processingTime);
    if (this.queueMetrics.processingTimes.length > 10) {
      this.queueMetrics.processingTimes.shift();
    }
  }

  /**
   * 🆕 재생 지연 시간 업데이트 (최근 10개 유지)
   */
  updatePlaybackLatency(latency) {
    this.queueMetrics.playbackLatencies.push(latency);
    if (this.queueMetrics.playbackLatencies.length > 10) {
      this.queueMetrics.playbackLatencies.shift();
    }
    
    // 평균 지터 시간 계산
    if (this.queueMetrics.playbackLatencies.length > 0) {
      const sum = this.queueMetrics.playbackLatencies.reduce((a, b) => a + b, 0);
      this.queueMetrics.averageJitterMs = sum / this.queueMetrics.playbackLatencies.length;
    }
  }

  /**
   * 큐 상태 변경 알림 (🆕 메트릭 포함)
   */
  notifyQueueStatusChange() {
    if (this.onQueueStatusChange) {
      this.onQueueStatusChange({
        queueLength: this.packetQueue.length,
        isProcessing: this.isProcessing,
        lastProcessedSeq: this.lastProcessedSeq,
        sessionId: this.sessionId,
        // 🆕 메트릭 정보 추가
        metrics: this.getQueueMetrics()
      });
    }
  }

  /**
   * 🆕 Queue 메트릭 정보 반환
   */
  getQueueMetrics() {
    const now = Date.now();
    const sessionDuration = now - this.queueMetrics.sessionStartTime;
    const avgProcessingTime = this.queueMetrics.processingTimes.length > 0 ? 
      this.queueMetrics.processingTimes.reduce((a, b) => a + b, 0) / this.queueMetrics.processingTimes.length : 0;
    
    return {
      ...this.queueMetrics,
      sessionDurationMs: sessionDuration,
      averageProcessingTimeMs: avgProcessingTime,
      successRate: this.queueMetrics.totalPacketsReceived > 0 ? 
        (this.queueMetrics.totalPacketsPlayed / this.queueMetrics.totalPacketsReceived) : 0,
      throughputPerMinute: sessionDuration > 0 ? 
        (this.queueMetrics.totalPacketsPlayed / (sessionDuration / 60000)) : 0
    };
  }

  /**
   * 컨트롤러 초기화 (세션 변경 시) (🆕 메트릭 리셋 포함)
   */
  reset() {
    console.log('🔄 MediaPacketSyncController 초기화 (메트릭 포함)');
    this.packetQueue = [];
    this.playingPackets.clear();
    this.lastProcessedSeq = -1;
    this.sessionId = null;
    this.isProcessing = false;
    
    // 🆕 메트릭 리셋
    this.queueMetrics = {
      totalPacketsReceived: 0,
      totalPacketsPlayed: 0,
      totalPacketsFailed: 0,
      packetsDropped: 0,
      duplicatePackets: 0,
      outOfOrderPackets: 0,
      maxQueueLength: 0,
      averageJitterMs: 0,
      processingTimes: [],
      playbackLatencies: [],
      trackTypeCounts: { audio: 0, video: 0, subtitle: 0 },
      sessionStartTime: Date.now(),
      lastPacketReceivedTime: null,
      lastPacketPlayedTime: null
    };
    
    this.notifyQueueStatusChange();
  }

  /**
   * 강제 정지
   */
  stop() {
    console.log('⏹️ MediaPacket 재생 강제 정지');
    
    // 오디오 정지
    if (this.audioRef?.current) {
      this.audioRef.current.pause();
      this.audioRef.current.currentTime = 0;
    }
    
    // 비디오를 idle로 복귀는 StreamingPage에서 처리
    // (기본 비디오는 character_id에 따라 동적으로 설정됨)
    console.log('🎬 MediaPacketSyncController: idle 복귀는 StreamingPage에서 처리');
    
    // 큐 초기화
    this.reset();
  }

  /**
   * 현재 상태 반환 (🆕 메트릭 포함)
   */
  getStatus() {
    return {
      queueLength: this.packetQueue.length,
      isProcessing: this.isProcessing,
      lastProcessedSeq: this.lastProcessedSeq,
      sessionId: this.sessionId,
      jitterMs: this.JITTER_MS,
      playingPackets: this.playingPackets.size,
      // 🆕 메트릭 정보 추가
      metrics: this.getQueueMetrics(),
      // 🆕 상태 요약 정보
      summary: {
        totalProcessed: this.queueMetrics.totalPacketsPlayed,
        successRate: this.queueMetrics.totalPacketsReceived > 0 ? 
          (this.queueMetrics.totalPacketsPlayed / this.queueMetrics.totalPacketsReceived * 100).toFixed(1) + '%' : '0%',
        averageLatency: this.queueMetrics.averageJitterMs.toFixed(1) + 'ms',
        currentThroughput: this.getQueueMetrics().throughputPerMinute.toFixed(1) + '/min'
      }
    };
  }
}

// 방별 독립적인 인스턴스 생성을 위해 클래스만 export
export default MediaPacketSyncController;