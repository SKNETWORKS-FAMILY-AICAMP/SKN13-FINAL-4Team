import axios from 'axios';

const api = axios.create({
    baseURL: process.env.REACT_APP_API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
    }
});

// 요청 인터셉터: 모든 요청에 Access Token을 자동으로 추가합니다.
api.interceptors.request.use(
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

// 응답 인터셉터: 토큰 만료 시 자동으로 재발급을 시도합니다.
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // 401 오류이고, 재시도한 요청이 아닐 경우 토큰 갱신 시도
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            const refreshToken = localStorage.getItem('refreshToken');

            if (refreshToken) {
                try {
                    // 중요: 토큰 갱신 시에는 api 인스턴스가 아닌 axios를 직접 사용해야 무한 루프를 방지할 수 있습니다.
                    const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/token/refresh/`, { refresh: refreshToken }, {
                        headers: { 'ngrok-skip-browser-warning': 'true' } // 갱신 요청에도 헤더를 추가합니다.
                    });
                    
                    const newAccessToken = response.data.access;
                    localStorage.setItem('accessToken', newAccessToken);
                    
                    // 새 토큰으로 기본 헤더와 원래 요청의 헤더를 모두 업데이트합니다.
                    api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
                    originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
                    
                    return api(originalRequest);

                } catch (refreshError) {
                    console.error('Refresh token is invalid or expired', refreshError);
                    // 토큰 갱신 실패 시 모든 토큰을 지우고 로그인 페이지로 보냅니다.
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('refreshToken');
                    window.location.href = '/login';
                    return Promise.reject(refreshError);
                }
            } else {
                 // 리프레시 토큰이 없으면 바로 로그인 페이지로 보냅니다.
                 console.log('No refresh token found, redirecting to login.');
                 window.location.href = '/login';
                 return Promise.reject(error);
            }
        }
        return Promise.reject(error);
    }
);

export default api;
