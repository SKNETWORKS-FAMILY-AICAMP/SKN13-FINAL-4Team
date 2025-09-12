// JWT 토큰 관리 유틸리티
import axios from 'axios';

const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/**
 * 토큰을 갱신하는 함수
 * @returns {string|null} 새로운 액세스 토큰 또는 null
 */
export const refreshToken = async () => {
    try {
        const refreshToken = localStorage.getItem('refreshToken');
        
        if (!refreshToken) {
            console.log('⚠️ Refresh token이 없습니다. 로그인이 필요합니다.');
            return null;
        }
        
        const response = await axios.post(`${apiBaseUrl}/api/token/refresh/`, {
            refresh: refreshToken
        });
        
        if (response.data.access) {
            localStorage.setItem('accessToken', response.data.access);
            console.log('✅ 토큰이 성공적으로 갱신되었습니다.');
            return response.data.access;
        }
        
        return null;
    } catch (error) {
        console.error('❌ 토큰 갱신 실패:', error.response?.data || error.message);
        
        // Refresh token도 만료된 경우
        if (error.response?.status === 401) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            console.log('🔄 Refresh token이 만료되었습니다. 다시 로그인해주세요.');
            // 로그인 페이지로 리다이렉트 할 수도 있음
            // window.location.href = '/login';
        }
        
        return null;
    }
};

/**
 * 유효한 토큰을 가져오는 함수 (필요시 자동 갱신)
 * @returns {string|null} 유효한 액세스 토큰 또는 null
 */
export const getValidToken = async () => {
    let accessToken = localStorage.getItem('accessToken');
    
    if (!accessToken) {
        console.log('⚠️ Access token이 없습니다.');
        return null;
    }
    
    // JWT 토큰의 만료시간 확인
    try {
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        const isExpired = payload.exp * 1000 < Date.now();
        
        if (isExpired) {
            console.log('⏰ 토큰이 만료되었습니다. 갱신을 시도합니다.');
            accessToken = await refreshToken();
        }
        
        return accessToken;
    } catch (error) {
        console.error('❌ 토큰 파싱 실패:', error);
        // 토큰 형식이 잘못된 경우 갱신 시도
        return await refreshToken();
    }
};

/**
 * 토큰이 유효한지 확인하는 함수
 * @param {string} token JWT 토큰
 * @returns {boolean} 토큰 유효성 여부
 */
export const isTokenValid = (token) => {
    if (!token) return false;
    
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.exp * 1000 > Date.now();
    } catch (error) {
        return false;
    }
};