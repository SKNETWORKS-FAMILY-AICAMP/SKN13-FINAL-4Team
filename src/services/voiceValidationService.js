/**
 * Voice ID 검증 및 관리 서비스
 * Backend API를 통해 ElevenLabs Voice ID 검증 및 음성 목록 관리
 */

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

class VoiceValidationService {
    /**
     * Voice 서비스 디버깅 정보 조회
     * @returns {Promise<Object>} 디버깅 정보
     */
    async debugVoiceService() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/chat/voices/debug/`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('🔧 Voice 서비스 디버그:', data);
            return data;
        } catch (error) {
            console.error('❌ Voice 서비스 디버깅 실패:', error);
            throw error;
        }
    }

    /**
     * 현재 시스템의 모든 Voice ID 유효성 검증
     * @returns {Promise<Object>} 검증 결과
     */
    async validateVoiceIds() {
        try {
            // 먼저 서비스 상태 확인
            const debugInfo = await this.debugVoiceService();
            console.log('🔧 Voice 서비스 상태:', debugInfo);
            
            if (!debugInfo.debug_info.elevenlabs_available) {
                throw new Error('ElevenLabs 서비스가 사용 불가능합니다.');
            }

            if (!debugInfo.debug_info.service_info.is_available) {
                throw new Error('ElevenLabs API 키가 설정되지 않았거나 유효하지 않습니다.');
            }

            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${API_BASE_URL}/api/chat/voices/validate/`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
            }

            const data = await response.json();
            console.log('🔍 Voice ID 검증 결과:', data);
            return data;
        } catch (error) {
            console.error('❌ Voice ID 검증 실패:', error);
            throw error;
        }
    }

    /**
     * ElevenLabs API에서 사용 가능한 모든 음성 목록 가져오기
     * @returns {Promise<Array>} 음성 목록
     */
    async getAvailableVoices() {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${API_BASE_URL}/api/chat/voices/available/`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('🎤 사용 가능한 음성 목록:', data);
            return data;
        } catch (error) {
            console.error('❌ 음성 목록 가져오기 실패:', error);
            throw error;
        }
    }

    /**
     * 단일 Voice ID 유효성 검증
     * @param {string} voiceId - 검증할 Voice ID
     * @returns {Promise<boolean>} 유효 여부
     */
    async validateSingleVoiceId(voiceId) {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${API_BASE_URL}/api/chat/voices/validate/single/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ voice_id: voiceId })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`🎵 Voice ID ${voiceId} 검증:`, data.is_valid);
            return data.is_valid;
        } catch (error) {
            console.error(`❌ Voice ID ${voiceId} 검증 실패:`, error);
            return false;
        }
    }

    /**
     * 현재 시스템의 음성 매핑 상태 정보 조회
     * @returns {Promise<Object>} 매핑 상태 정보
     */
    async getVoiceMappingStatus() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/chat/voices/mapping/status/`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('📋 음성 매핑 상태:', data);
            return data;
        } catch (error) {
            console.error('❌ 음성 매핑 상태 조회 실패:', error);
            throw error;
        }
    }

    /**
     * 검증된 음성 목록을 UI용 옵션 형태로 변환
     * @param {Array} voices - 음성 목록
     * @returns {Object} UI용 음성 옵션
     */
    formatVoicesForUI(voices) {
        const voiceOptions = {};
        
        voices.forEach(voice => {
            // 한국 배우 음성만 필터링 (또는 특정 조건)
            if (voice.language === 'ko' || voice.accent === 'Korean' || voice.is_mapped) {
                voiceOptions[voice.id] = `${voice.name} (${voice.description || voice.gender})`;
            }
        });

        return voiceOptions;
    }

    /**
     * Voice ID 검증 상태를 기반으로 UI 경고 메시지 생성
     * @param {Object} validationResults - 검증 결과
     * @returns {Array} 경고 메시지 배열
     */
    generateValidationWarnings(validationResults) {
        const warnings = [];
        
        if (!validationResults.success) {
            warnings.push({
                type: 'error',
                message: 'ElevenLabs API 연결 실패 - TTS 기능이 제한될 수 있습니다.'
            });
            return warnings;
        }

        const { summary } = validationResults;
        
        // 폴백 모드 감지
        if (summary.fallback_mode) {
            warnings.push({
                type: 'warning',
                message: `⚠️ API 연결 문제로 폴백 모드로 실행 중입니다. ${summary.api_error || 'ElevenLabs 서비스 점검 중'}`
            });
            warnings.push({
                type: 'info',
                message: `기본 음성 설정을 사용합니다. TTS 기능은 제한적으로 작동할 수 있습니다.`
            });
            return warnings;
        }
        
        // 무효한 음성이 발견된 경우에만 경고 표시 (시스템 정리 완료 후에는 드물어야 함)
        if (summary.invalid_count > 0) {
            warnings.push({
                type: 'info',
                message: `시스템 정리 중: ${summary.invalid_count}개의 음성이 검증되지 않았습니다. 시스템이 자동으로 정리됩니다.`
            });
        }

        if (summary.valid_count === 0) {
            warnings.push({
                type: 'error',
                message: '사용 가능한 음성이 없습니다. 시스템 관리자에게 문의하세요.'
            });
        } else {
            warnings.push({
                type: 'success',
                message: `${summary.valid_count}개의 음성이 정상적으로 사용 가능합니다.`
            });
        }

        return warnings;
    }
}

// 서비스 인스턴스 내보내기
const voiceValidationService = new VoiceValidationService();
export default voiceValidationService;