// src/components/layout/InfluencerSidebar.js

import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import api from '../../utils/unifiedApiClient';
import './Sidebar.css';

function InfluencerSidebar() {
    const [influencers, setInfluencers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchInfluencers = async () => {
            try {
                const response = await api.get('/influencers/api/');
                setInfluencers(response.data);
            } catch (error) {
                console.error("인플루언서 목록을 불러오는 데 실패했습니다:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchInfluencers();
    }, []);

    return (
        <nav className="sidebar">
            <div className="sidebar-header">
                스트리머 목록
            </div>
            <ul className="sidebar-nav">
                {loading ? (
                    <li className="sidebar-item">
                        <span className="sidebar-link">로딩 중...</span>
                    </li>
                ) : (
                    influencers.map(influencer => (
                        <li className="sidebar-item" key={influencer.id}>
                            {/* NavLink를 사용하여 클릭 시 해당 방송국 페이지로 이동합니다. */}
                            <NavLink 
                                to={`/influencers/${influencer.id}`} 
                                className="sidebar-link"
                            >
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