import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api';
import styles from './InfluencerPage.module.css';
import { Modal, Button, Form } from 'react-bootstrap';

function InfluencerPage() {
    const { id } = useParams();
    const [influencer, setInfluencer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [stories, setStories] = useState([]);
    const [showStoryModal, setShowStoryModal] = useState(false);
    const [storyData, setStoryData] = useState({
        title: '',
        content: '',
        is_anonymous: true,
    });

    const [isLiked, setIsLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [rankings, setRankings] = useState([]);
    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || '';

    const fetchStories = useCallback(async () => {
        if (!id) return;
        try {
            const response = await api.get(`/api/influencers/${id}/stories/`);
            setStories(response.data.results || response.data);
        } catch (err) {
            console.error("사연 목록 로딩 실패:", err);
        }
    }, [id]);

    const fetchRankings = useCallback(async () => {
        if (!id) return;
        try {
            const response = await api.get(`/api/influencers/${id}/rankings/`);
            setRankings(response.data);
        } catch (err) {
            console.error("열혈순위 로딩 실패:", err);
        }
    }, [id]);

    useEffect(() => {
        const fetchInfluencerData = async () => {
            if (!id) return;
            try {
                const response = await api.get(`/api/influencers/${id}/`);
                setInfluencer(response.data);
                setIsLiked(!!response.data.is_liked_by_user); 
                setLikeCount(response.data.like_count)
                await Promise.all([fetchStories(), fetchRankings()]);
            } catch (err) {
                setError('인플루언서 정보를 불러오는 데 실패했습니다.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchInfluencerData();
    }, [id, fetchStories, fetchRankings]);

    const handleCloseStoryModal = () => setShowStoryModal(false);
    const handleShowStoryModal = () => {
        setStoryData({ title: '', content: '', is_anonymous: true });
        setShowStoryModal(true);
    };

    const handleStoryChange = (e) => {
        const { name, value, type, checked } = e.target;
        setStoryData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleStorySubmit = async (e) => {
        e.preventDefault();
        if (!storyData.title.trim() || !storyData.content.trim()) {
            alert("제목과 내용을 입력해주세요.");
            return;
        }
        try {
            await api.post(`/api/influencers/${id}/stories/`, {
                ...storyData,
                influencer: id,
            });
            alert('사연이 성공적으로 등록되었습니다.');
            handleCloseStoryModal();
            fetchStories();
        } catch (err) {
            console.error("사연 제출 실패:", err);
            alert("사연 제출에 실패했습니다. 다시 시도해주세요.");
        }
    };
    
    const handleLikeClick = async () => {
        const originalIsLiked = isLiked;
        const originalLikeCount = likeCount;

        setIsLiked(prev => !prev);
        setLikeCount(prev => (isLiked ? prev -1 : prev + 1));

        try {
            await api.post(`/api/influencers/${id}/like/`);
        } catch (err) {
            alert("좋아요 처리에 실패했습니다.")
            setIsLiked(originalIsLiked);
            setLikeCount(originalLikeCount);
            console.error(err);
        }
    };


    const getProfileImageUrl = (inf) => {
        const imageUrl = inf?.profile_image || inf?.profile_pic_url;
        if (imageUrl) {
            return imageUrl.startsWith('http') ? imageUrl : `${apiBaseUrl}${imageUrl}`;
        }
        return `${apiBaseUrl}/media/profile_pics/default_profile.png`;
    };

    const getBannerImageUrl = (inf) => {
        const imageUrl = inf?.banner_image || inf?.banner_pic_url;
        if (imageUrl) {
            return imageUrl.startsWith('http') ? imageUrl : `${apiBaseUrl}${imageUrl}`;
        }
        return `${apiBaseUrl}/media/banners/default_banner.png`;
    };

    if (loading) return <div className={styles.loadingContainer}>로딩 중...</div>;
    if (error) return <div className={styles.errorContainer}>{error}</div>;
    if (!influencer) return <div className={styles.notFoundContainer}>인플루언서 정보를 찾을 수 없습니다.</div>;

    return (
        <div className={styles.influencerPage}>
            <header className={styles.headerSection}>
                <div className={styles.profileArea}>
                    <img 
                        src={getProfileImageUrl(influencer)} 
                        alt={`${influencer.name} 프로필`} 
                        className={styles.profileImage} 
                    />
                </div>
                <div className={styles.bannerArea}>
                    <img 
                        src={getBannerImageUrl(influencer)} 
                        alt={`${influencer.name} 배너`} 
                        className={styles.bannerImage} 
                    />
                </div>
            </header>

            <section className={styles.infoSection}>
                <div className={styles.writeStoryButton} onClick={handleShowStoryModal}>사연쓰기</div>
                <h2 className={styles.channelName}>{influencer.name}의 방송국</h2>
                <div className={`${styles.likeButton} ${isLiked ? styles.likeButtonActive : ''}`} 
                    onClick={handleLikeClick}>
                    ❤️ {likeCount.toLocaleString()}
                </div>
            </section>

            <section className={styles.contentSection}>
                <div className={styles.rankingBoard}>
                    <h3>열혈순위</h3>
                    {/* <p>(후원액수로 등수)</p> */}
                    {rankings.length > 0 ? (
                        <ul>
                            {rankings.map(rank => (
                                <li key={rank.rank}>
                                    {rank.rank}. {rank.donor_nickname} ({rank.total_amount.toLocaleString()}원)
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>아직 후원 기록이 없습니다.</p>
                    )}
                </div>
                <div className={styles.storyBoard}>
                    <h3>사연 게시판</h3>
                    {stories.length > 0 ? (
                        stories.map(story => (
                            <div className={styles.storyItem} key={story.id}>
                                <h4>{story.title}</h4>
                                <p>{story.content}</p>
                                <span className={styles.storyAuthor}>
                                    작성자: {story.is_anonymous ? '익명' : story.author_nickname || '유저'}
                                </span>
                            </div>
                        ))
                    ) : (
                        <p>등록된 사연이 없습니다.</p>
                    )}
                </div>
            </section>
            
            <Modal show={showStoryModal} onHide={handleCloseStoryModal} centered>
                <Modal.Header closeButton>
                    <Modal.Title>사연 쓰기</Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleStorySubmit}>
                    <Modal.Body>
                        <Form.Group className="mb-3">
                            <Form.Label>제목</Form.Label>
                            <Form.Control 
                                type="text" 
                                name="title" 
                                value={storyData.title}
                                onChange={handleStoryChange}
                                placeholder="사연의 제목을 입력하세요"
                                required 
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>내용</Form.Label>
                            <Form.Control 
                                as="textarea" 
                                rows={5}
                                name="content"
                                value={storyData.content}
                                onChange={handleStoryChange}
                                placeholder="방송에서 읽어줄 사연을 작성해주세요."
                                required 
                            />
                        </Form.Group>
                        <Form.Group>
                            <Form.Check 
                                type="checkbox"
                                name="is_anonymous"
                                label="익명으로 등록"
                                checked={storyData.is_anonymous}
                                onChange={handleStoryChange}
                            />
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={handleCloseStoryModal}>
                            취소
                        </Button>
                        <Button variant="primary" type="submit">
                            등록하기
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>
        </div>
    );
}

export default InfluencerPage;