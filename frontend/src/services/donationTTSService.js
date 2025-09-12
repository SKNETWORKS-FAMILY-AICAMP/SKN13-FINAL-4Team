// services/donationTTSService.js
import api from '../utils/unifiedApiClient';

/**
 * 후원 TTS 서비스
 * ElevenLabs API를 사용해서 후원 메시지를 음성으로 읽어주는 서비스
 */
class DonationTTSService {
    constructor() {
        this.audioContext = null;
        this.currentAudio = null;
        this.volume = 0.8;
    }

    /**
     * 후원 메시지를 위한 텍스트 생성
     * @param {Object} donationData - 후원 데이터
     * @returns {string} TTS용 텍스트
     */
    generateDonationText(donationData) {
        const { message } = donationData;
        
        // 메시지가 있는 경우 메시지만 읽고, 없으면 빈 문자열 반환
        if (message && message.trim()) {
            return message.trim();
        }
        
        return '';
    }

    /**
     * ElevenLabs API를 사용해서 음성 생성 및 재생
     * @param {Object} donationData - 후원 데이터
     * @param {Object} options - TTS 옵션
     */
    async playDonationTTS(donationData, options = {}) {
        try {
            // 이전 오디오가 재생 중이면 중지
            if (this.currentAudio) {
                this.currentAudio.pause();
                this.currentAudio = null;
            }

            const ttsText = this.generateDonationText(donationData);
            console.log('🎤 후원 TTS 텍스트:', ttsText);

            // TTS 요청 데이터
            const requestData = {
                text: ttsText,
                engine: 'elevenlabs',
                voice: options.voice || 'aneunjin', // 기본 음성: 안은진
                model_id: options.model_id || 'eleven_multilingual_v2',
                stability: options.stability || 0.5,
                similarity_boost: options.similarity_boost || 0.8,
                style: options.style || 0.0,
                use_speaker_boost: options.use_speaker_boost !== false,
                format: 'mp3'
            };

            console.log('🎤 TTS API 요청:', requestData);

            // 백엔드 TTS API 호출
            const response = await api.post('/api/chat/ai/tts/', requestData, {
                responseType: 'blob'
            });

            // 오디오 Blob URL 생성
            const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
            const audioUrl = URL.createObjectURL(audioBlob);

            // 오디오 재생
            const audio = new Audio(audioUrl);
            audio.volume = this.volume;
            
            this.currentAudio = audio;

            // 이벤트 리스너 추가
            audio.onended = () => {
                console.log('✅ 후원 TTS 재생 완료');
                URL.revokeObjectURL(audioUrl);
                this.currentAudio = null;
            };

            audio.onerror = (error) => {
                console.error('❌ 후원 TTS 재생 실패:', error);
                URL.revokeObjectURL(audioUrl);
                this.currentAudio = null;
            };

            // 재생 시작
            await audio.play();
            console.log('🎵 후원 TTS 재생 시작');

            return true;

        } catch (error) {
            console.error('❌ 후원 TTS 생성/재생 실패:', error);
            
            // 에러 상세 정보 로깅
            if (error.response) {
                console.error('   응답 상태:', error.response.status);
                console.error('   응답 데이터:', error.response.data);
            }
            
            return false;
        }
    }

    /**
     * 음량 설정
     * @param {number} volume - 0.0 ~ 1.0
     */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.currentAudio) {
            this.currentAudio.volume = this.volume;
        }
    }

    /**
     * 현재 재생 중인 TTS 중지
     */
    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
    }

    /**
     * 서비스 정리
     */
    destroy() {
        this.stop();
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}

// 싱글톤 인스턴스 생성
const donationTTSService = new DonationTTSService();

export default donationTTSService;