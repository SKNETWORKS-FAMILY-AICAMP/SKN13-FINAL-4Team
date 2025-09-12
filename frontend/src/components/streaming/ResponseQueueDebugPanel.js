import React from 'react';

/**
 * ResponseQueueDebugPanel - 응답 큐 상태를 시각화하는 디버그 패널
 * 
 * AI 응답 처리 및 MediaPacket 생성 상태를 실시간으로 표시
 * - 최근 처리된 응답들
 * - MediaPacket 생성 상태
 * - 실패한 요청들
 * - 응답 생성 통계
 */
const ResponseQueueDebugPanel = ({ detailedQueueInfo, queueStatus, isMinimized = false }) => {
    if (!detailedQueueInfo) {
        return (
            <div className="mt-3 p-2 bg-info bg-opacity-10 rounded">
                <h6 className="text-info mb-2">📤 응답 큐 (데이터 없음)</h6>
                <small style={{ color: '#adb5bd' }}>서버에서 큐 정보를 수신하지 못했습니다.</small>
            </div>
        );
    }

    const responseQueue = detailedQueueInfo.response_queue || {};
    const recentHistory = detailedQueueInfo.recent_history || [];
    const metrics = detailedQueueInfo.metrics || {};
    const currentSeq = detailedQueueInfo.current_seq || 0;
    const lastProcessedSeq = queueStatus?.lastProcessedSeq || -1;

    if (isMinimized) {
        const successfulHistory = recentHistory.filter(item => item.status === 'completed');
        const failedHistory = recentHistory.filter(item => item.status === 'failed');
        const cancelledHistory = recentHistory.filter(item => item.status === 'cancelled');
        
        return (
            <div className="mt-2 p-2 bg-info bg-opacity-10 rounded">
                <div className="d-flex justify-content-between align-items-center">
                    <span className="fw-bold text-info">📤 응답 큐</span>
                    <div>
                        <span className="badge bg-success me-1">{successfulHistory.length} 성공</span>
                        <span className="badge bg-danger me-1">{failedHistory.length} 실패</span>
                        <span className="badge bg-warning text-dark me-2">{cancelledHistory.length} 취소</span>
                        <span className="badge bg-info">Seq: {currentSeq}</span>
                    </div>
                </div>
            </div>
        );
    }

    // 성공/실패/취소 통계 계산
    const successfulHistory = recentHistory.filter(item => item.status === 'completed');
    const failedHistory = recentHistory.filter(item => item.status === 'failed');
    const cancelledHistory = recentHistory.filter(item => item.status === 'cancelled');

    return (
        <div className="mt-3 p-2 bg-info bg-opacity-10 rounded">
            <h6 className="text-info mb-2">📤 응답 큐 상태</h6>
            
            {/* 응답 통계 */}
            <div className="row g-1 small mb-3">
                <div className="col-3">
                    <strong>성공:</strong>
                    <span className="badge bg-success ms-2">{successfulHistory.length}</span>
                </div>
                <div className="col-3">
                    <strong>실패:</strong>
                    <span className="badge bg-danger ms-2">{failedHistory.length}</span>
                </div>
                <div className="col-3">
                    <strong>취소:</strong>
                    <span className="badge bg-warning text-dark ms-2">{cancelledHistory.length}</span>
                </div>
                <div className="col-3">
                    <strong>총 처리:</strong>
                    <span className="badge bg-primary ms-2">{metrics.total_processed || 0}</span>
                </div>
            </div>


            {/* 시퀀스 정보 */}
            <div className="row g-1 small mb-3">
                <div className="col-6">
                    <strong>현재 Seq:</strong>
                    <span className="badge bg-info ms-2">{currentSeq}</span>
                </div>
                <div className="col-6">
                    <strong>마지막 처리:</strong>
                    <span className={`badge ms-2 ${
                        lastProcessedSeq >= 0 ? 'bg-success' : 'bg-secondary'
                    }`}>
                        {lastProcessedSeq >= 0 ? lastProcessedSeq : 'N/A'}
                    </span>
                </div>
            </div>

            {/* 현재 재생 중인 MediaPacket */}
            {responseQueue.current_playing ? (
                <div className="mb-3 p-2 bg-primary bg-opacity-20 rounded">
                    <h6 className="text-primary mb-1">🎵 현재 재생 중</h6>
                    <div className="small">
                        <div className="row g-1">
                            <div className="col-6">
                                <strong>시퀀스:</strong>
                                <span className="badge bg-primary ms-2">{responseQueue.current_playing.seq}</span>
                            </div>
                            <div className="col-6">
                                <strong>해시:</strong>
                                <span className="ms-2 font-monospace small">{responseQueue.current_playing.hash}</span>
                            </div>
                            <div className="col-6">
                                <strong>트랙 수:</strong>
                                <span className="badge bg-info ms-2">{responseQueue.current_playing.tracks}</span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="mb-3 p-2 bg-secondary bg-opacity-20 rounded text-center">
                    <span style={{ color: '#adb5bd' }}>현재 재생 중인 미디어가 없습니다</span>
                </div>
            )}

            {/* 대기 중인 MediaPacket들 */}
            <div className="mb-3">
                <h6 className="text-info mb-2">
                    ⏳ 재생 대기 큐 ({responseQueue.pending_packets?.length || 0}개)
                </h6>
                
                {responseQueue.pending_packets && responseQueue.pending_packets.length > 0 ? (
                    <>
                        {/* MediaPacket 스택 시각화 */}
                        <div className="media-stack mb-3" style={{ 
                            display: 'flex', 
                            flexDirection: 'column-reverse',
                            gap: '2px',
                            minHeight: '60px',
                            alignItems: 'center'
                        }}>
                            {responseQueue.pending_packets.slice(0, 5).map((packet, index) => (
                                <div 
                                    key={index}
                                    className="stack-item"
                                    style={{
                                        width: `${90 - index * 5}%`,
                                        height: '20px',
                                        backgroundColor: index === 0 ? '#0d6efd' : 
                                                       index === 1 ? '#0dcaf0' :
                                                       index === 2 ? '#198754' : '#6c757d',
                                        borderRadius: '3px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#fff',
                                        fontSize: '0.7rem',
                                        fontWeight: 'bold',
                                        border: '1px solid rgba(255,255,255,0.2)'
                                    }}
                                    title={`seq: ${packet.seq}, ${packet.duration?.toFixed(1)}초`}
                                >
                                    #{packet.position} seq:{packet.seq}
                                </div>
                            ))}
                            {responseQueue.pending_packets.length > 5 && (
                                <div style={{
                                    fontSize: '0.7rem',
                                    color: '#adb5bd',
                                    marginTop: '5px'
                                }}>
                                    +{responseQueue.pending_packets.length - 5} more...
                                </div>
                            )}
                        </div>

                        {/* 상세 패킷 목록 */}
                        <div className="pending-packets-list" style={{ maxHeight: '120px', overflowY: 'auto' }}>
                            {responseQueue.pending_packets.slice(0, 3).map((packet, index) => (
                                <div key={index} className="mb-1 p-1 bg-light bg-opacity-10 rounded">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div className="flex-grow-1">
                                            <div className="small">
                                                <span className="badge bg-info me-1" style={{ fontSize: '0.6rem' }}>
                                                    #{packet.position}
                                                </span>
                                                <strong style={{ fontSize: '0.7rem' }}>seq: {packet.seq}</strong>
                                                <span className="badge bg-secondary ms-1" style={{ fontSize: '0.6rem' }}>
                                                    {packet.hash}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-end">
                                            <span className="badge bg-success text-dark" style={{ fontSize: '0.6rem' }}>
                                                {packet.duration ? `${packet.duration.toFixed(1)}초` : 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {responseQueue.pending_packets.length > 3 && (
                                <div className="text-center">
                                    <small style={{ color: '#adb5bd', fontSize: '0.6rem' }}>
                                        ... 및 {responseQueue.pending_packets.length - 3}개 더
                                    </small>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="text-center py-3">
                        <div className="empty-queue-indicator" style={{
                            width: '80%',
                            height: '30px',
                            backgroundColor: 'rgba(108, 117, 125, 0.2)',
                            borderRadius: '3px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto',
                            border: '2px dashed #6c757d'
                        }}>
                            <span className="small" style={{ color: '#adb5bd' }}>대기 중인 미디어가 없습니다</span>
                        </div>
                    </div>
                )}
            </div>

            {/* 최근 응답 히스토리 */}
            <div className="mb-3">
                <h6 className="text-info mb-2">
                    🕐 최근 처리 이력 ({recentHistory.length}/10)
                </h6>
                
                {recentHistory.length > 0 ? (
                    <div className="history-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {recentHistory.map((item, index) => (
                            <div key={index} className="mb-2 p-2 bg-light bg-opacity-10 rounded">
                                <div className="d-flex justify-content-between align-items-start">
                                    <div className="flex-grow-1">
                                        <div className="small">
                                            <span className={`badge me-2 ${
                                                item.status === 'completed' ? 'bg-success' :
                                                item.status === 'failed' ? 'bg-danger' :
                                                item.status === 'cancelled' ? 'bg-warning text-dark' : 'bg-secondary'
                                            }`}>
                                                {item.status === 'completed' ? '✅ 완료' :
                                                 item.status === 'failed' ? '❌ 실패' :
                                                 item.status === 'cancelled' ? '🚫 취소' : item.status}
                                            </span>
                                            <strong>{item.username}:</strong>
                                            <span className="ms-2">"{item.message}"</span>
                                            {item.seq !== null && (
                                                <span className="badge bg-info ms-2">seq: {item.seq}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-end">
                                        <div className="small" style={{ color: '#adb5bd' }}>
                                            {item.processing_time ? `${item.processing_time.toFixed(1)}초` : 'N/A'}
                                        </div>
                                        <div className="small" style={{ color: '#adb5bd' }}>
                                            {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : ''}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-2">
                        <span className="small" style={{ color: '#adb5bd' }}>처리 이력이 없습니다</span>
                    </div>
                )}
            </div>

            {/* 성능 지표 */}
            <div className="row g-1 small">
                <div className="col-6">
                    <strong>평균 처리시간:</strong>
                    <span className="badge bg-info ms-2">
                        {metrics.avg_processing_time ? 
                            `${metrics.avg_processing_time.toFixed(1)}초` : 'N/A'
                        }
                    </span>
                </div>
                <div className="col-6">
                    <strong>성공률:</strong>
                    <span className="badge bg-success ms-2">
                        {metrics.total_processed > 0 ? 
                            `${((metrics.total_processed - (metrics.cancelled_requests || 0)) / metrics.total_processed * 100).toFixed(1)}%` : 'N/A'
                        }
                    </span>
                </div>
            </div>

            {/* 최근 처리 시간 차트 (간단한 바 형태) */}
            {metrics.recent_processing_times && metrics.recent_processing_times.length > 0 && (
                <div className="mt-3">
                    <small><strong>처리 시간 트렌드:</strong></small>
                    <div className="mt-1 d-flex align-items-end" style={{ height: '30px' }}>
                        {metrics.recent_processing_times.slice(-10).map((time, index) => {
                            const maxTime = Math.max(...metrics.recent_processing_times);
                            const height = Math.max(3, (time / maxTime) * 25);
                            
                            return (
                                <div 
                                    key={index} 
                                    className={`me-1 rounded-top ${
                                        time > 10 ? 'bg-danger' :
                                        time > 5 ? 'bg-warning' : 'bg-success'
                                    }`}
                                    style={{ 
                                        width: '8px', 
                                        height: `${height}px`,
                                        opacity: 0.7 + (index * 0.03)
                                    }}
                                    title={`${time.toFixed(1)}초`}
                                />
                            );
                        })}
                    </div>
                    <div className="small" style={{ color: '#adb5bd' }}>
                        최근 {metrics.recent_processing_times.length}개 요청의 처리 시간
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResponseQueueDebugPanel;