import axios from 'axios';

// API 기본 URL 설정
const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

// Axios 인스턴스 생성
const api = axios.create({
    baseURL: apiBaseUrl,
});

// 요청 인터셉터: Access Token 자동 추가
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

// 이미지 URL 보정 함수 (재귀)
const fixImageUrlsRecursively = (data) => {
    if (!data || typeof data !== 'object') return data;

    const fixUrl = (url) => (url && url.startsWith('/media/')) ? `${apiBaseUrl}${url}` : url;

    // profile_image, thumbnail 처리
    if (data.profile_image) data.profile_image = fixUrl(data.profile_image);
    if (data.thumbnail) data.thumbnail = fixUrl(data.thumbnail);

    // 객체 안에 중첩된 배열/객체 재귀 처리
    Object.keys(data).forEach(key => {
        if (Array.isArray(data[key])) {
            data[key] = data[key].map(fixImageUrlsRecursively);
        } else if (typeof data[key] === 'object' && data[key] !== null) {
            data[key] = fixImageUrlsRecursively(data[key]);
        }
    });

    return data;
};

// 응답 인터셉터: 이미지 URL 보정 + 401 처리
api.interceptors.response.use(
    response => {
        if (response.data) {
            response.data = fixImageUrlsRecursively(response.data);
        }
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        // 401 처리
        if (error.response && error.response.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = localStorage.getItem('refreshToken');
                if (!refreshToken) {
                    window.location.href = '/login';
                    return Promise.reject(error);
                }

                const response = await axios.post(`${apiBaseUrl}/api/token/refresh/`, { refresh: refreshToken });
                const newAccessToken = response.data.access;
                localStorage.setItem('accessToken', newAccessToken);

                originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
                return api(originalRequest);

            } catch (refreshError) {
                console.error('Unable to refresh token:', refreshError);
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
