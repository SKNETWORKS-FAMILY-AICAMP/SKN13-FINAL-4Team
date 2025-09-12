/**
 * 비디오 설정 유틸리티
 * Backend API를 통해 동적 비디오 설정 제공
 */

import api from './unifiedApiClient';

// 비디오 설정 캐시
let videoAssetsConfig = null;
let configPromise = null;

/**
 * Backend API에서 비디오 설정 가져오기 - 개선된 캐시 및 즉시 반환
 */
const fetchVideoAssetsConfig = async () => {
    // 이미 로드된 설정이 있으면 즉시 반환
    if (videoAssetsConfig && videoAssetsConfig.characters && Object.keys(videoAssetsConfig.characters).length > 0) {
        return videoAssetsConfig;
    }
    
    // 이미 진행 중인 요청이 있으면 대기
    if (configPromise) {
        return configPromise;
    }
    
    configPromise = (async () => {
        try {
            const response = await api.get('/api/chat/config/video-assets/');
            
            // axios 응답 처리
            if (response.status !== 200) {
                throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
            }
            
            const result = response.data;
            
            if (!result.success) {
                throw new Error(result.error || '비디오 설정 로드 실패');
            }
            
            videoAssetsConfig = result.data;
            console.log('✅ 비디오 설정 API 로드 성공:', Object.keys(videoAssetsConfig.characters || {}));
            
            // 캐시 만료 설정 (5분)
            setTimeout(() => {
                console.log('🔄 비디오 설정 캐시 만료, 다음 요청시 새로고침');
                videoAssetsConfig = null;
            }, 5 * 60 * 1000);
            
            return videoAssetsConfig;
            
        } catch (error) {
            console.error('❌ 비디오 설정 API 로드 실패:', error);
            
            // 폴백: 기본 설정 사용
            videoAssetsConfig = getDefaultFallbackConfig();
            return videoAssetsConfig;
        } finally {
            configPromise = null;
        }
    })();
    
    return configPromise;
};

/**
 * 폴백용 기본 설정 - API에서 로드 실패 시에만 사용
 */
const getDefaultFallbackConfig = () => ({
    characters: {},
    systemSettings: {
        defaultCharacter: "hongseohyun",
        fallbackVideo: "hongseohyun_idle_2.mp4", 
        defaultEmotion: "neutral"
    }
});

/**
 * 비디오 설정 초기화 (앱 시작 시 호출)
 */
export const initializeVideoConfig = async () => {
    if (!videoAssetsConfig) {
        await fetchVideoAssetsConfig();
    }
    return videoAssetsConfig;
};

/**
 * 캐릭터별 안전한 폴백 파일명 생성
 */
const getSafeIdleFallback = (characterId) => {
    const characterFallbacks = {
        'kangsihyun': 'kangsihyun_idle_1.mp4',  // kangsihyun은 idle_1만 존재
        'hongseohyun': 'hongseohyun_idle_2.mp4',
        'kimchunki': 'kimchunki_idle_1.mp4',
        'ohyul': 'ohyul_idle_1.mp4'
    };
    
    return characterFallbacks[characterId] || `${characterId}_idle_1.mp4`;
};

/**
 * 캐릭터별 기본 idle 비디오 가져오기 (동기)
 */
export const getDefaultIdleVideo = (characterId) => {
    try {
        console.log('🔍 getDefaultIdleVideo 호출:', characterId);
        console.log('🔍 videoAssetsConfig 상태:', !!videoAssetsConfig);
        
        // 설정이 로드되지 않은 경우 안전한 폴백 사용
        if (!videoAssetsConfig) {
            console.warn('⚠️ 비디오 설정이 아직 로드되지 않았습니다. 안전한 폴백 사용.');
            return characterId ? getSafeIdleFallback(characterId) : 'hongseohyun_idle_2.mp4';
        }
        
        console.log('🔍 사용 가능한 캐릭터:', Object.keys(videoAssetsConfig.characters));
        
        const characterConfig = videoAssetsConfig.characters[characterId];
        if (!characterConfig) {
            console.warn(`⚠️ 캐릭터 '${characterId}' 설정을 찾을 수 없습니다. 안전한 폴백 사용.`);
            return characterId ? getSafeIdleFallback(characterId) : videoAssetsConfig.systemSettings.fallbackVideo;
        }
        
        const idleConfig = characterConfig.videoCategories?.idle;
        if (!idleConfig) {
            console.warn(`⚠️ 캐릭터 '${characterId}' idle 비디오 설정이 없습니다. 안전한 폴백 사용.`);
            return getSafeIdleFallback(characterId);
        }
        
        // API 설정에서 가져온 값 우선 사용, 없으면 안전한 폴백 사용
        const result = idleConfig.defaultFile || idleConfig.files[0] || getSafeIdleFallback(characterId);
        console.log('✅ getDefaultIdleVideo 결과:', result);
        return result;
    } catch (error) {
        console.error('❌ getDefaultIdleVideo 오류:', error);
        return characterId ? getSafeIdleFallback(characterId) : 'hongseohyun_idle_2.mp4';
    }
};

/**
 * 캐릭터별 모든 idle 비디오 목록 가져오기
 */
export const getAllIdleVideos = (characterId) => {
    try {
        if (!videoAssetsConfig) {
            console.warn('⚠️ 비디오 설정이 아직 로드되지 않았습니다.');
            return [getDefaultIdleVideo(characterId)];
        }
        
        const characterConfig = videoAssetsConfig.characters[characterId];
        if (!characterConfig) {
            return [getDefaultIdleVideo(characterId)];
        }
        
        const idleConfig = characterConfig.videoCategories?.idle;
        if (!idleConfig || !idleConfig.files || idleConfig.files.length === 0) {
            return [getDefaultIdleVideo(characterId)];
        }
        
        return idleConfig.files;
    } catch (error) {
        console.error('❌ getAllIdleVideos 오류:', error);
        return [getDefaultIdleVideo(characterId)];
    }
};

/**
 * 캐릭터별 랜덤 idle 비디오 가져오기
 */
export const getRandomIdleVideo = (characterId) => {
    try {
        const idleVideos = getAllIdleVideos(characterId);
        
        if (idleVideos.length <= 1) {
            return idleVideos[0];
        }
        
        const randomIndex = Math.floor(Math.random() * idleVideos.length);
        const selectedVideo = idleVideos[randomIndex];
        
        console.log(`🎲 랜덤 idle 비디오 선택: ${selectedVideo} (${randomIndex + 1}/${idleVideos.length})`);
        return selectedVideo;
    } catch (error) {
        console.error('❌ getRandomIdleVideo 오류:', error);
        return getDefaultIdleVideo(characterId);
    }
};

/**
 * Idle 비디오 순환 관리자
 */
class IdleRotationManager {
    constructor() {
        this.currentIndex = new Map(); // characterId별 현재 인덱스
        this.rotationTimers = new Map(); // characterId별 타이머
    }
    
    /**
     * 다음 idle 비디오 가져오기 (순환)
     */
    getNextIdleVideo(characterId) {
        try {
            const idleVideos = getAllIdleVideos(characterId);
            
            if (idleVideos.length <= 1) {
                return idleVideos[0];
            }
            
            let currentIndex = this.currentIndex.get(characterId) || 0;
            currentIndex = (currentIndex + 1) % idleVideos.length;
            this.currentIndex.set(characterId, currentIndex);
            
            const selectedVideo = idleVideos[currentIndex];
            console.log(`🔄 순환 idle 비디오: ${selectedVideo} (${currentIndex + 1}/${idleVideos.length})`);
            return selectedVideo;
        } catch (error) {
            console.error('❌ getNextIdleVideo 오류:', error);
            return getDefaultIdleVideo(characterId);
        }
    }
    
    /**
     * 현재 idle 인덱스 리셋
     */
    resetRotation(characterId) {
        this.currentIndex.set(characterId, 0);
        console.log(`🔄 ${characterId} idle 순환 리셋`);
    }
    
    /**
     * 자동 순환 시작 (주기적으로 idle 비디오 변경)
     */
    startAutoRotation(characterId, intervalMs = 30000, onVideoChange) {
        this.stopAutoRotation(characterId);
        
        const timer = setInterval(() => {
            const nextVideo = this.getNextIdleVideo(characterId);
            if (onVideoChange) {
                onVideoChange(nextVideo);
            }
        }, intervalMs);
        
        this.rotationTimers.set(characterId, timer);
        console.log(`⏰ ${characterId} 자동 idle 순환 시작 (${intervalMs/1000}초 간격)`);
    }
    
    /**
     * 자동 순환 중지
     */
    stopAutoRotation(characterId) {
        const timer = this.rotationTimers.get(characterId);
        if (timer) {
            clearInterval(timer);
            this.rotationTimers.delete(characterId);
            console.log(`⏹️ ${characterId} 자동 idle 순환 중지`);
        }
    }
    
    /**
     * 모든 자동 순환 중지
     */
    stopAllAutoRotations() {
        this.rotationTimers.forEach((timer, characterId) => {
            clearInterval(timer);
            console.log(`⏹️ ${characterId} 자동 idle 순환 중지`);
        });
        this.rotationTimers.clear();
    }
}

// 전역 인스턴스
export const idleRotationManager = new IdleRotationManager();

/**
 * 캐릭터별 기본 talk 비디오 가져오기
 */
export const getDefaultTalkVideo = (characterId) => {
    try {
        console.log('🔍 getDefaultTalkVideo 호출:', characterId);
        
        // 설정이 로드되지 않은 경우 캐릭터별 기본 파일명 생성
        if (!videoAssetsConfig) {
            console.warn('⚠️ 비디오 설정이 아직 로드되지 않았습니다. 캐릭터별 폴백 사용.');
            return characterId ? `${characterId}_talk_1.mp4` : 'hongseohyun_talk_1.mp4';
        }
        
        const characterConfig = videoAssetsConfig.characters[characterId];
        if (!characterConfig) {
            console.warn(`⚠️ 캐릭터 '${characterId}' 설정을 찾을 수 없습니다. idle로 폴백.`);
            return getDefaultIdleVideo(characterId); // idle로 폴백
        }
        
        const talkConfig = characterConfig.videoCategories?.talk;
        if (!talkConfig) {
            console.warn(`⚠️ 캐릭터 '${characterId}' talk 비디오 설정이 없습니다. idle로 폴백.`);
            return getDefaultIdleVideo(characterId); // idle로 폴백
        }
        
        const result = talkConfig.defaultFile || talkConfig.files[0] || getDefaultIdleVideo(characterId);
        console.log('✅ getDefaultTalkVideo 결과:', result);
        return result;
    } catch (error) {
        console.error('❌ getDefaultTalkVideo 오류:', error);
        return getDefaultIdleVideo(characterId);
    }
};

/**
 * 폴백 비디오 가져오기 (시스템 전역 설정)
 */
export const getFallbackVideo = () => {
    try {
        if (!videoAssetsConfig) {
            console.warn('⚠️ 비디오 설정이 아직 로드되지 않았습니다. 기본 폴백 사용.');
            return 'hongseohyun_idle_2.mp4';
        }
        
        const fallback = videoAssetsConfig.systemSettings?.fallbackVideo;
        if (!fallback) {
            console.warn('⚠️ systemSettings.fallbackVideo가 없습니다. 기본값 사용.');
            return 'hongseohyun_idle_2.mp4';
        }
        
        console.log('✅ getFallbackVideo 결과:', fallback);
        return fallback;
    } catch (error) {
        console.error('❌ getFallbackVideo 오류:', error);
        return 'hongseohyun_idle_2.mp4';
    }
};

/**
 * 캐릭터의 사용 가능한 모든 비디오 파일 가져오기
 */
export const getCharacterVideos = (characterId) => {
    try {
        if (!videoAssetsConfig) {
            console.warn('⚠️ 비디오 설정이 아직 로드되지 않았습니다.');
            return [];
        }
        
        const characterConfig = videoAssetsConfig.characters[characterId];
        if (!characterConfig) {
            return [];
        }
        
        const allVideos = [];
        const videoCategories = characterConfig.videoCategories;
        
        Object.entries(videoCategories).forEach(([category, categoryConfig]) => {
            const files = categoryConfig.files || [];
            files.forEach(filename => {
                allVideos.push({
                    filename,
                    category,
                    isDefault: filename === categoryConfig.defaultFile
                });
            });
        });
        
        return allVideos;
    } catch (error) {
        console.error('❌ getCharacterVideos 오류:', error);
        return [];
    }
};

/**
 * 비디오 설정 전체 가져오기 - 즉시 반환, 백그라운드 로드
 */
export const getVideoAssetsConfig = () => {
    // 캐시된 설정이 있으면 즉시 반환
    if (videoAssetsConfig && videoAssetsConfig.characters && Object.keys(videoAssetsConfig.characters).length > 0) {
        return videoAssetsConfig;
    }
    
    // 설정이 없으면 백그라운드에서 로드 시작 (Promise를 기다리지 않음)
    if (!configPromise) {
        fetchVideoAssetsConfig().catch(error => {
            console.warn('백그라운드 비디오 설정 로드 실패:', error);
        });
    }
    
    // 즉시 fallback 설정 반환하여 blocking 방지
    console.warn('⚠️ 비디오 설정 로드 중, 기본 설정 사용');
    const fallback = getDefaultFallbackConfig();
    
    // 기본 캐릭터들을 fallback에 추가하여 기본 동작 보장
    if (!fallback.characters) {
        fallback.characters = {};
    }
    
    // 기본 캐릭터 설정 추가 - 실제 파일 구조 기반
    const defaultCharacters = ['hongseohyun', 'kimchunki', 'ohyul', 'kangsihyun'];
    defaultCharacters.forEach(charId => {
        if (!fallback.characters[charId]) {
            // 캐릭터별 실제 파일 기반 설정
            let idleDefault = `${charId}_idle_1.mp4`; // 일반적으로 _idle_1.mp4가 존재
            
            // hongseohyun만 예외적으로 _idle_2.mp4가 기본
            if (charId === 'hongseohyun') {
                idleDefault = `${charId}_idle_2.mp4`;
            }
            
            fallback.characters[charId] = {
                videoCategories: {
                    idle: {
                        defaultFile: idleDefault,
                        files: [`${charId}_idle_1.mp4`] // 최소한 _idle_1.mp4는 있다고 가정
                    },
                    talk: {
                        defaultFile: `${charId}_talk_1.mp4`,
                        files: [`${charId}_talk_1.mp4`]
                    }
                }
            };
        }
    });
    
    return fallback;
};