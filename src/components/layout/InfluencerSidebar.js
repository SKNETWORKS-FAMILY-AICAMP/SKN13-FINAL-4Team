// src/components/layout/InfluencerSidebar.js
import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import api from '../../utils/unifiedApiClient';
import styles from './Sidebar.module.css';

function InfluencerSidebar() {
    const [influencers, setInfluencers] = useState([]);
    const [loading, setLoading] = useState(true);

    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || '';

    useEffect(() => {
        const fetchInfluencers = async () => {
            try {
                const response = await api.get('/api/influencers/'); 
                setInfluencers(response.data.results || response.data);
            } catch (error) {
                console.error("인플루언서 목록을 불러오는 데 실패했습니다:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchInfluencers();
    }, []);

    const getProfileImageUrl = (influencer) => {
        const imageUrl = influencer.profile_image || influencer.profile_pic_url; 
        
        if (imageUrl) {
            return imageUrl.startsWith('http') ? imageUrl : `${apiBaseUrl}${imageUrl}`;
        }
        return 'https://via.placeholder.com/40/C0C0C0?text=';
    };


    return (
        <nav className={styles.sidebar}>
            <div className={styles.sidebarHeader}> 
                방송국
            </div>
            <ul className={styles.sidebarNav}>
                {loading ? (
                    <li>
                        <span className={styles.sidebarLinkIn}>로딩 중...</span>
                    </li>
                ) : (
                    influencers.map(influencer => (
                        <li key={influencer.id}>
                            <NavLink 
                                to={`/influencers/${influencer.id}`} 
                                className={({ isActive }) => `${styles.sidebarLinkIn} ${isActive ? styles.active : ''}`}
                            >
                                <img 
                                    src={getProfileImageUrl(influencer)} 
                                    alt={`${influencer.name} 프로필`} 
                                    className={styles.profilePic} 
                                />
                                {influencer.name}
                            </NavLink>
                        </li>
                    ))
                )}
            </ul>
        </nav>
    );
}

export default InfluencerSidebar;