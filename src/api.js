import axios from 'axios';

// API 기본 URL 설정
const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

// Axios 인스턴스 생성
const api = axios.create({
    baseURL: apiBaseUrl,
});

// Axios 요청 인터셉터: 모든 요청에 Access Token을 헤더에 추가
api.interceptors.request.use(
    config => {
        const accessToken = localStorage.getItem('accessToken');
        if (accessToken) {
            config.headers['Authorization'] = `Bearer ${accessToken}`;
        }
        return config;
    },
    error => Promise.reject(error)
);

// Axios 응답 인터셉터: 401 오류 발생 시 토큰 갱신 시도
api.interceptors.response.use(
    response => response, // 성공적인 응답은 그대로 반환
    async (error) => {
        const originalRequest = error.config;

        // 401 오류이고, 재시도한 요청이 아닐 경우
        if (error.response.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true; // 재시도 플래그 설정

            try {
                const refreshToken = localStorage.getItem('refreshToken');
                if (!refreshToken) {
                    // refreshToken이 없으면 로그인 페이지로
                    window.location.href = '/login';
                    return Promise.reject(error);
                }

                // 새로운 Access Token 발급 요청
                const response = await axios.post(`${apiBaseUrl}/api/token/refresh/`, {
                    refresh: refreshToken
                });

                const newAccessToken = response.data.access;

                // 새로운 토큰 저장
                localStorage.setItem('accessToken', newAccessToken);
                
                // 새로 발급받은 토큰으로 원래 요청을 다시 시도
                originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
                return api(originalRequest);

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

export default api;