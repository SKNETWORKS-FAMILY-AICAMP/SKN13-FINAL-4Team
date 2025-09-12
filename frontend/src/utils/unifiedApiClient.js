import axios from 'axios';

/**
 * 통합 API 클라이언트
 * - JWT 토큰 자동 관리 및 갱신 (기존 api.js 기능 유지)
 * - 단순화된 에러 처리
 * - 기존 api 인스턴스와의 호환성 보장
 */
class UnifiedAPIClient {
    constructor() {
        // 기본 URL 설정
        this.baseURL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
        
        // Axios 인스턴스 생성
        this.createAxiosInstance();
    }

    /**
     * Axios 인스턴스 생성 및 인터셉터 설정
     */
    createAxiosInstance() {
        this.axiosInstance = axios.create({
            baseURL: this.baseURL,
            timeout: 10000
        });

        // 요청 인터셉터: 모든 요청에 Access Token 추가
        this.axiosInstance.interceptors.request.use(
            config => {
                const accessToken = localStorage.getItem('accessToken');
                if (accessToken) {
                    config.headers['Authorization'] = `Bearer ${accessToken}`;
                }
                return config;
            },
            error => Promise.reject(error)
        );

        // 응답 인터셉터: 401 오류 시 토큰 갱신 시도
        this.axiosInstance.interceptors.response.use(
            response => response, // 성공적인 응답은 그대로 반환
            async (error) => {
                const originalRequest = error.config;

                // 401 오류이고, 재시도한 요청이 아닐 경우
                if (error.response?.status === 401 && !originalRequest._retry) {
                    originalRequest._retry = true; // 재시도 플래그 설정

                    try {
                        const refreshToken = localStorage.getItem('refreshToken');
                        if (!refreshToken) {
                            // refreshToken이 없으면 로그인 페이지로
                            window.location.href = '/login';
                            return Promise.reject(error);
                        }

                        // 새로운 Access Token 발급 요청
                        const response = await axios.post(`${this.baseURL}/api/token/refresh/`, {
                            refresh: refreshToken
                        });

                        const newAccessToken = response.data.access;

                        // 새로운 토큰 저장
                        localStorage.setItem('accessToken', newAccessToken);
                        
                        // 새로 발급받은 토큰으로 원래 요청을 다시 시도
                        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
                        return this.axiosInstance(originalRequest);

                    } catch (refreshError) {
                        // Refresh Token도 만료되었거나 유효하지 않은 경우
                        console.error('Unable to refresh token:', refreshError);
                        // 모든 토큰 삭제 및 로그아웃 처리
                        localStorage.removeItem('accessToken');
                        localStorage.removeItem('refreshToken');
                        window.location.href = '/login';
                        return Promise.reject(refreshError);
                    }
                }

                return Promise.reject(error);
            }
        );
    }

    /**
     * GET 요청
     */
    async get(url, config = {}) {
        return this.axiosInstance.get(url, config);
    }

    /**
     * POST 요청
     */
    async post(url, data, config = {}) {
        return this.axiosInstance.post(url, data, config);
    }

    /**
     * PUT 요청
     */
    async put(url, data, config = {}) {
        return this.axiosInstance.put(url, data, config);
    }

    /**
     * DELETE 요청
     */
    async delete(url, config = {}) {
        return this.axiosInstance.delete(url, config);
    }

    /**
     * PATCH 요청
     */
    async patch(url, data, config = {}) {
        return this.axiosInstance.patch(url, data, config);
    }

    /**
     * 현재 Base URL 반환
     */
    getBaseURL() {
        return this.baseURL;
    }

    /**
     * Base URL 설정
     */
    setBaseURL(url) {
        this.baseURL = url;
        this.axiosInstance.defaults.baseURL = url;
    }
}

// 전역 통합 API 클라이언트 인스턴스 생성
const unifiedApiClient = new UnifiedAPIClient();

// 기존 api.js 완전 호환을 위한 export (기존 사용법 그대로 유지)
export default unifiedApiClient.axiosInstance;

// 추가적인 유틸리티 함수들도 export
export { unifiedApiClient };
export const api = unifiedApiClient;