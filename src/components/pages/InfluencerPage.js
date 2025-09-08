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
    const [rankings, setRankings] = useState([]);
    const [showStoryModal, setShowStoryModal] = useState(false);
    const [storyData, setStoryData] = useState({
        title: '',
        relationship_stage: '',
        nickname: '',
        content: '',
        is_anonymous: true,
    });
    const [isLiked, setIsLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [user, setUser] = useState(null); // 현재 로그인 사용자 정보
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);

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
        const fetchAllData = async () => {
            if (!id) return;
            try {
                setLoading(true);
                const userPromise = api.get('/api/users/me/');
                const influencerPromise = api.get(`/api/influencers/${id}/`);

                const [userResponse, influencerResponse] = await Promise.all([userPromise, influencerPromise]);
                
                setUser(userResponse.data);
                setInfluencer(influencerResponse.data);
                setIsLiked(!!influencerResponse.data.is_liked_by_user);
                setLikeCount(influencerResponse.data.like_count || 0);
                
                await Promise.all([fetchStories(), fetchRankings()]);

            } catch (err) {
                setError('페이지 정보를 불러오는 데 실패했습니다.');
                console.error(err);
                setUser(null); // 에러 발생 시 사용자 정보 초기화
            } finally {
                setLoading(false);
            }
        };
        fetchAllData();
    }, [id, fetchStories, fetchRankings]);

    const handleCloseStoryModal = () => setShowStoryModal(false);

    const handleShowStoryModal = () => {
        setStoryData({
            title: '',
            relationship_stage: '',
            nickname: user ? user.nickname : '로그인 필요', // 유저 정보가 있으면 닉네임, 없으면 안내 문구
            content: '',
            is_anonymous: true,
        });
        setAgreedToTerms(false);
        setAgreedToPrivacy(false); 
        setShowStoryModal(true);
    };

    const handleStoryChange = (e) => {
        const { name, value, type, checked } = e.target;
        setStoryData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleStorySubmit = async (e) => {
        e.preventDefault();
        if (!storyData.title.trim() || !storyData.content.trim()) {
            alert("제목과 내용을 모두 입력해주세요.");
            return;
        }
        try {
            await api.post(`/api/influencers/${id}/stories/`, { ...storyData });
            alert('사연이 성공적으로 등록되었습니다.');
            handleCloseStoryModal();
            fetchStories();
        } catch (err) {
            console.error("사연 제출 실패:", err);
            alert("사연 제출에 실패했습니다. 다시 시도해주세요.");
        }
    };
    
    const handleLikeClick = async () => {
        if (!user) {
            alert("로그인이 필요한 기능입니다.");
            return;
        }
        const originalIsLiked = isLiked;
        const originalLikeCount = likeCount;
        setIsLiked(prev => !prev);
        setLikeCount(prev => (isLiked ? prev - 1 : prev + 1));
        try {
            await api.post(`/api/influencers/${id}/like/`);
        } catch (err) {
            alert("좋아요 처리에 실패했습니다.");
            setIsLiked(originalIsLiked);
            setLikeCount(originalLikeCount);
            console.error(err);
        }
    };

    const getProfileImageUrl = (inf) => {
        const imageUrl = inf?.profile_image;
        if (imageUrl) {
            return imageUrl.startsWith('http') ? imageUrl : `${apiBaseUrl}${imageUrl}`;
        }
        return `${apiBaseUrl}/media/profile_pics/default_profile.png`;
    };

    const getBannerImageUrl = (inf) => {
        const imageUrl = inf?.banner_image;
        if (imageUrl) {
            return imageUrl.startsWith('http') ? imageUrl : `${apiBaseUrl}${imageUrl}`;
        }
        return `${apiBaseUrl}/media/banners/default_banner.png`;
    };

    if (loading) return <div className={styles.pageContainer}><p>로딩 중...</p></div>;
    if (error) return <div className={styles.pageContainer}><p>{error}</p></div>;
    if (!influencer) return <div className={styles.pageContainer}><p>인플루언서 정보를 찾을 수 없습니다.</p></div>;

    return (
        <div className={styles.pageContainer}>
            <div className={styles.contentWrapper}>
                <header className={styles.header}>
                    <h1>{influencer.name}의 방송국</h1>
                    <div 
                        className={`${styles.likeButton} ${isLiked ? styles.likeButtonActive : ''}`}
                        onClick={handleLikeClick}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path fillRule="evenodd" d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314"/>
                        </svg>
                    </div>
                </header>

                <section className={styles.profileSection}>
                    <div className={styles.profileImageContainer}>
                        <img src={getProfileImageUrl(influencer)} alt={`${influencer.name} 프로필`} />
                    </div>
                    <div className={styles.bannerArea}>
                        <img src={getBannerImageUrl(influencer)} alt={`${influencer.name} 배너`} className={styles.bannerImage} />
                    </div>
                </section>

                <main className={styles.mainContent}>
                    <aside className={styles.rankingBoard}>
                        <h2 className={styles.sectionTitle}>후원 많이 한 시청자</h2>
                        <p className={styles.sectionSubtitle}>작성일 기준 ㆍ 상위 5명</p>
                        {rankings.length > 0 ? (
                            <ol className={styles.rankingList}>
                                {rankings.slice(0, 5).map(rank => (
                                    <li key={rank.rank}>
                                        <span className={styles.rankNumber}>{rank.rank}</span>
                                        <span className={styles.rankName}>{rank.donor_nickname}</span>
                                        <span className={styles.rankAmount}>₩{rank.total_amount.toLocaleString()}</span>
                                    </li>
                                ))}
                            </ol>
                        ) : (
                            <p>아직 후원 기록이 없습니다.</p>
                        )}
                    </aside>

                    <section className={styles.storyBoard}>
                        <div className={styles.storyHeader}>
                            <div>
                                <h2 className={styles.sectionTitle}>시청자 사연 모음</h2>
                                <p className={styles.sectionSubtitle}>여러분들의 연애 고민을 올리고, AI 스트리머의 상담을 받아보세요.</p>
                            </div>
                            <button className={styles.writeStoryButton} onClick={handleShowStoryModal}>사연 쓰기</button>
                        </div>
                        
                        <div className={styles.storyList}>
                            {stories.length > 0 ? (
                                stories.map(story => (
                                    <div className={styles.storyItem} key={story.id}>
                                        <h3>{story.title}</h3>
                                        <p>{story.content}</p>
                                        <div className={styles.storyMeta}>
                                            <span>작성자: {story.is_anonymous ? '익명' : story.author_nickname || '유저'}</span>
                                            <span>{new Date(story.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p>등록된 사연이 없습니다.</p>
                            )}
                        </div>
                    </section>
                </main>
            </div>
            
            <Modal show={showStoryModal} onHide={handleCloseStoryModal} centered size="lg" dialogClassName={styles.storyModal}>
                <Modal.Body className={styles.modalBody}>
                    <Form onSubmit={handleStorySubmit}>
                        <div className={styles.formSection}>
                            <h3 className={styles.formSectionTitle}>기본 정보</h3>
                            <Form.Group className="mb-3">
                                <Form.Label>제목</Form.Label>
                                <div className={styles.inputContainer}>
                                    <Form.Control 
                                        type="text" name="title"
                                        placeholder="예) 짝사랑 고백을 해도 될까요?"
                                        value={storyData.title}
                                        onChange={handleStoryChange}
                                        maxLength={100}
                                    />
                                    <span className={styles.charCount}>{storyData.title.length}/100</span>
                                </div>
                            </Form.Group>
                            <div className={styles.formRow}>
                                <Form.Group className={styles.formColumn}>
                                    <Form.Label>관계 단계</Form.Label>
                                    <Form.Select name="relationship_stage" value={storyData.relationship_stage} onChange={handleStoryChange}>
                                        <option value="">선택: 시작 전/썸/연애 중/권태/이별</option>
                                        <option value="before">시작 전</option>
                                        <option value="some">썸</option>
                                        <option value="dating">연애 중</option>
                                        <option value="boredom">권태</option>
                                        <option value="breakup">이별</option>
                                    </Form.Select>
                                </Form.Group>
                                <Form.Group className={styles.formColumn}>
                                    <Form.Label>공개 설정</Form.Label>
                                    <Form.Select name="is_anonymous" value={storyData.is_anonymous} onChange={handleStoryChange}>
                                        <option value={true}>익명 (추천)</option>
                                        <option value={false}>닉네임 공개</option>
                                    </Form.Select>
                                </Form.Group>
                                <Form.Group className={styles.formColumn}>
                                    <Form.Label>닉네임</Form.Label>
                                    <Form.Control 
                                        type="text" name="nickname"
                                        placeholder="로그인 정보"
                                        value={storyData.nickname}
                                        readOnly
                                        disabled
                                    />
                                </Form.Group>
                            </div>
                        </div>

                        <div className={styles.formSection}>
                            <h3 className={styles.formSectionTitle}>사연 내용</h3>
                            <div className={styles.writingGuide}>
                                <ul>
                                    <li>상대/상황/감정을 구체적으로 적기 (예: 언제, 어디서, 누가, 무엇을, 왜) 줄바꿈도 그대로 반영됩니다.</li>
                                    <li>개인을 특정할 수 있는 정보는 제외</li>
                                    <li>방송에서 읽기 적합한 길이(300~800자)</li>
                                </ul>
                            </div>
                            <div className={styles.inputContainer}>
                                <Form.Control 
                                    as="textarea" rows={8} name="content"
                                    value={storyData.content}
                                    onChange={handleStoryChange}
                                    maxLength={1000}
                                />
                                <span className={styles.charCount}>{storyData.content.length}/1000</span>
                            </div>
                        </div>

                        <div className={styles.agreementSection}>
                            <Form.Check 
                                type="checkbox"
                                id="agree-terms"
                                label="방송 중 사연이 읽힐 수 있음에 동의합니다."
                                checked={agreedToTerms}
                                onChange={(e) => setAgreedToTerms(e.target.checked)}
                            />
                            <Form.Check 
                                type="checkbox"
                                id="agree-privacy"
                                label="개인정보(실명/연락처 등)를 포함하지 않았습니다."
                                checked={agreedToPrivacy}
                                onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                            />
                        </div>

                        <div className={styles.modalFooter}>
                            <Button variant="secondary" onClick={handleCloseStoryModal} className={styles.cancelButton}>
                                취소하기
                            </Button>
                            <Button variant="primary" type="submit" className={styles.submitButton} disabled={!agreedToTerms || !agreedToPrivacy}>
                                사연 제출
                            </Button>
                        </div>
                    </Form>
                </Modal.Body>
            </Modal>
        </div>
    );
}

export default InfluencerPage;