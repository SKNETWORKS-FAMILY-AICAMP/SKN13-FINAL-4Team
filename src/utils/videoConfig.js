/**
 * 비디오 설정 유틸리티
 * Backend API를 통해 동적 비디오 설정 제공
 */

// 비디오 설정 캐시
let videoAssetsConfig = null;
let configPromise = null;

/**
 * Backend API에서 비디오 설정 가져오기
 */
const fetchVideoAssetsConfig = async () => {
    if (configPromise) {
        return configPromise;
    }
    
    if (videoAssetsConfig) {
        return videoAssetsConfig;
    }
    
    configPromise = (async () => {
        try {
            const response = await fetch('/api/chat/config/video-assets/', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '비디오 설정 로드 실패');
            }
            
            videoAssetsConfig = result.data;
            console.log('✅ 비디오 설정 API 로드 성공:', Object.keys(videoAssetsConfig.characters || {}));
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
 * 폴백용 기본 설정
 */
const getDefaultFallbackConfig = () => ({
    characters: {
        hongseohyun: {
            name: "홍세현",
            videoBasePath: "/videos/hongseohyun/",
            videoCategories: {
                idle: {
                    files: ["hongseohyun_idle_2.mp4"],
                    defaultFile: "hongseohyun_idle_2.mp4"
                },
                talk: {
                    files: ["hongseohyun_talk_1.mp4"],
                    defaultFile: "hongseohyun_talk_1.mp4"
                }
            }
        }
    },
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
 * 캐릭터별 기본 idle 비디오 가져오기 (동기)
 */
export const getDefaultIdleVideo = (characterId) => {
    try {
        // 설정이 로드되지 않은 경우 폴백
        if (!videoAssetsConfig) {
            console.warn('⚠️ 비디오 설정이 아직 로드되지 않았습니다. 폴백 사용.');
            return 'hongseohyun_idle_2.mp4';
        }
        
        const characterConfig = videoAssetsConfig.characters[characterId];
        if (!characterConfig) {
            console.warn(`⚠️ 캐릭터 '${characterId}' 설정을 찾을 수 없습니다. 기본값 사용.`);
            return videoAssetsConfig.systemSettings.fallbackVideo;
        }
        
        const idleConfig = characterConfig.videoCategories?.idle;
        if (!idleConfig) {
            console.warn(`⚠️ 캐릭터 '${characterId}' idle 비디오 설정이 없습니다. 폴백 사용.`);
            return videoAssetsConfig.systemSettings.fallbackVideo;
        }
        
        return idleConfig.defaultFile || idleConfig.files[0] || videoAssetsConfig.systemSettings.fallbackVideo;
    } catch (error) {
        console.error('❌ getDefaultIdleVideo 오류:', error);
        return 'hongseohyun_idle_2.mp4'; // 하드코딩 폴백
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
        // 설정이 로드되지 않은 경우 폴백
        if (!videoAssetsConfig) {
            console.warn('⚠️ 비디오 설정이 아직 로드되지 않았습니다. 폴백 사용.');
            return 'hongseohyun_talk_1.mp4';
        }
        
        const characterConfig = videoAssetsConfig.characters[characterId];
        if (!characterConfig) {
            return getDefaultIdleVideo(characterId); // idle로 폴백
        }
        
        const talkConfig = characterConfig.videoCategories?.talk;
        if (!talkConfig) {
            return getDefaultIdleVideo(characterId); // idle로 폴백
        }
        
        return talkConfig.defaultFile || talkConfig.files[0] || getDefaultIdleVideo(characterId);
    } catch (error) {
        console.error('❌ getDefaultTalkVideo 오류:', error);
        return getDefaultIdleVideo(characterId);
    }
};

/**
 * 폴백 비디오 가져오기 (시스템 전역 설정)
 */
export const getFallbackVideo = () => {
    if (!videoAssetsConfig) {
        return 'hongseohyun_idle_2.mp4';
    }
    return videoAssetsConfig.systemSettings.fallbackVideo;
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
 * 비디오 설정 전체 가져오기
 */
export const getVideoAssetsConfig = () => {
    if (!videoAssetsConfig) {
        console.warn('⚠️ 비디오 설정이 아직 로드되지 않았습니다.');
        return getDefaultFallbackConfig();
    }
    return videoAssetsConfig;
};