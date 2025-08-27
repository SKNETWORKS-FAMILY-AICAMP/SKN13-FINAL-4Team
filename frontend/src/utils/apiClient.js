import axios from 'axios';

// 1. Django CSRF 설정을 포함한 axios 인스턴스 생성
const axiosInstance = axios.create({
    timeout: 10000,
    withCredentials: true, // 요청 시 쿠키를 포함하도록 허용
    xsrfCookieName: 'csrftoken', // Django의 기본 CSRF 쿠키 이름
    xsrfHeaderName: 'X-CSRFToken', // Django가 인식하는 헤더 이름
});

// 2. 요청 인터셉터 추가: 모든 요청에 JWT 토큰을 자동으로 포함
axiosInstance.interceptors.request.use(
    config => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    error => {
        return Promise.reject(error);
    }
);


/**
 * 스마트 API 클라이언트
 * IP 변경에 자동으로 대응하고 폴백 URL을 지원합니다
 * 네트워크 환경에 따라 동적으로 최적의 엔드포인트를 선택합니다
 */
class APIClient {
    constructor() {
        this.primaryUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
        this.fallbackUrl = process.env.REACT_APP_API_FALLBACK_URL || 'http://localhost:8000';
        this.currentUrl = this.primaryUrl;
        this.isHealthy = true;
        this.lastHealthCheck = 0;
        this.healthCheckInterval = 30000; // 30초마다 health check
        
        // 네트워크 기반 URL 후보 생성
        this.generateNetworkUrls();
    }

    /**
     * 네트워크 환경에 따른 URL 후보들 생성
     */
    generateNetworkUrls() {
        this.candidateUrls = [
            this.primaryUrl,
            this.fallbackUrl
        ];

        // 일반적인 사설 IP 대역 추가
        const commonIPs = ['192.168.0.21', '192.168.0.48', '192.168.1.100'];
        commonIPs.forEach(ip => {
            const url = `http://${ip}:8000`;
            if (!this.candidateUrls.includes(url)) {
                this.candidateUrls.push(url);
            }
        });

        console.log('🔍 API URL 후보들:', this.candidateUrls);
    }

    /**
     * API 엔드포인트 health check
     */
    async healthCheck(url) {
        try {
            // 3. axios 대신 새로 만든 axiosInstance 사용
            const response = await axiosInstance.get(`${url}/api/chat/ai/tts/status/`, {
                timeout: 3000
            });
            return response.status === 200;
        } catch (error) {
            console.warn(`Health check failed for ${url}:`, error.message);
            return false;
        }
    }

    /**
     * 사용 가능한 API URL 찾기 (모든 후보 URL 검사)
     */
    async findWorkingUrl() {
        console.log('🔍 사용 가능한 API URL 찾는 중...');
        
        // 현재 URL이 여전히 작동하는지 먼저 확인
        if (await this.healthCheck(this.currentUrl)) {
            console.log(`✅ 현재 URL 정상: ${this.currentUrl}`);
            return this.currentUrl;
        }

        // 모든 후보 URL을 순차적으로 검사
        for (const url of this.candidateUrls) {
            console.log(`🔄 URL 검사 중: ${url}`);
            if (await this.healthCheck(url)) {
                this.currentUrl = url;
                this.isHealthy = true;
                this.lastHealthCheck = Date.now();
                console.log(`✅ 작동하는 URL 발견: ${url}`);
                return url;
            }
        }

        // 모든 URL 실패
        this.isHealthy = false;
        console.error('❌ 사용 가능한 API URL을 찾을 수 없음');
        throw new Error('Backend server is not accessible');
    }

    /**
     * 주기적 health check (필요시에만)
     */
    async periodicHealthCheck() {
        const now = Date.now();
        if (now - this.lastHealthCheck > this.healthCheckInterval) {
            try {
                await this.findWorkingUrl();
            } catch (error) {
                console.warn('⚠️ 주기적 health check 실패:', error.message);
            }
        }
    }

    /**
     * API 요청 with 자동 폴백 및 네트워크 적응
     */
    async request(config) {
        // 주기적 health check 수행
        await this.periodicHealthCheck();
        
        // 첫 번째 시도: 현재 URL
        try {
            // 3. axios 대신 새로 만든 axiosInstance 사용
            const response = await axiosInstance({
                ...config,
                baseURL: this.currentUrl,
            });
            this.lastHealthCheck = Date.now(); // 성공 시 갱신
            return response;
        } catch (error) {
            console.warn(`❌ Request failed with ${this.currentUrl}:`, error.message);
            
            // 실패 시 사용 가능한 URL 다시 찾기
            try {
                const workingUrl = await this.findWorkingUrl();
                
                // 새로운 URL로 재시도
                if (workingUrl !== this.currentUrl) {
                    console.log(`🔄 새로운 URL로 재시도: ${workingUrl}`);
                    // 3. axios 대신 새로 만든 axiosInstance 사용
                    const response = await axiosInstance({
                        ...config,
                        baseURL: workingUrl,
                    });
                    return response;
                }
            } catch (networkError) {
                console.error('❌ 모든 네트워크 경로 실패:', networkError.message);
                throw new Error('서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.');
            }
            
            // 원본 오류 다시 throw
            throw error;
        }
    }

    /**
     * GET 요청
     */
    async get(url, config = {}) {
        return this.request({ ...config, method: 'GET', url });
    }

    /**
     * POST 요청
     */
    async post(url, data, config = {}) {
        return this.request({ ...config, method: 'POST', url, data });
    }

    /**
     * 현재 API URL 반환
     */
    getCurrentUrl() {
        return this.currentUrl;
    }

    /**
     * API 상태 반환
     */
    isHealthyStatus() {
        return this.isHealthy;
    }
}

// 전역 API 클라이언트 인스턴스
const apiClient = new APIClient();

export default apiClient;
