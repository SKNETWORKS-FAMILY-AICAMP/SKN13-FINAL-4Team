import React from 'react';

/**
 * RequestQueueDebugPanel - 요청 큐 상태를 시각화하는 디버그 패널
 * 
 * 사용자가 보낸 요청들의 큐 상태를 실시간으로 표시
 * - 현재 처리 중인 요청
 * - 대기 중인 요청 목록
 * - 각 요청의 대기 시간
 * - 취소 상태 등
 */
const RequestQueueDebugPanel = ({ detailedQueueInfo, isMinimized = false }) => {
    if (!detailedQueueInfo) {
        return (
            <div className="mt-3 p-2 bg-warning bg-opacity-10 rounded">
                <h6 className="text-warning mb-2">📥 요청 큐 (데이터 없음)</h6>
                <small className="text-muted">서버에서 큐 정보를 수신하지 못했습니다.</small>
            </div>
        );
    }

    const currentProcessing = detailedQueueInfo.current_processing;
    const pendingRequests = detailedQueueInfo.pending_requests || [];
    const metrics = detailedQueueInfo.metrics || {};

    if (isMinimized) {
        return (
            <div className="mt-2 p-2 bg-warning bg-opacity-10 rounded">
                <div className="d-flex justify-content-between align-items-center">
                    <span className="fw-bold text-warning">📥 요청 큐</span>
                    <div>
                        <span className="badge bg-warning text-dark me-2">{pendingRequests.length} 대기</span>
                        <span className={`badge ${currentProcessing ? 'bg-primary' : 'bg-secondary'}`}>
                            {currentProcessing ? '처리 중' : '유휴'}
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-3 p-2 bg-warning bg-opacity-10 rounded">
            <h6 className="text-warning mb-2">📥 요청 큐 상태</h6>
            
            {/* 전체 통계 */}
            <div className="row g-1 small mb-3">
                <div className="col-4">
                    <strong>총 처리:</strong>
                    <span className="badge bg-success ms-2">{metrics.total_processed || 0}</span>
                </div>
                <div className="col-4">
                    <strong>취소됨:</strong>
                    <span className="badge bg-danger ms-2">{metrics.cancelled_requests || 0}</span>
                </div>
                <div className="col-4">
                    <strong>평균 처리시간:</strong>
                    <span className="badge bg-info ms-2">
                        {metrics.avg_processing_time ? 
                            `${metrics.avg_processing_time.toFixed(1)}초` : 'N/A'
                        }
                    </span>
                </div>
            </div>

            {/* 현재 처리 중인 요청 */}
            {currentProcessing ? (
                <div className="mb-3 p-2 bg-primary bg-opacity-20 rounded">
                    <h6 className="text-primary mb-1">🔄 현재 처리 중</h6>
                    <div className="small">
                        <div className="row g-1">
                            <div className="col-8">
                                <strong>메시지:</strong>
                                <span className="ms-2 text-truncate d-inline-block" style={{ maxWidth: '200px' }}>
                                    "{currentProcessing.message}"
                                </span>
                            </div>
                            <div className="col-4">
                                <strong>사용자:</strong>
                                <span className="badge bg-primary ms-2">{currentProcessing.username}</span>
                            </div>
                            <div className="col-6">
                                <strong>처리 시간:</strong>
                                <span className="badge bg-warning text-dark ms-2">
                                    {currentProcessing.processing_duration ? 
                                        `${currentProcessing.processing_duration.toFixed(1)}초` : 'N/A'
                                    }
                                </span>
                            </div>
                            <div className="col-6">
                                <strong>룸:</strong>
                                <span className="ms-2 font-monospace small">
                                    {currentProcessing.room_group ? 
                                        currentProcessing.room_group.split('_').pop() : 'N/A'
                                    }
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="mb-3 p-2 bg-secondary bg-opacity-20 rounded text-center">
                    <span className="text-muted">현재 처리 중인 요청이 없습니다</span>
                </div>
            )}

            {/* 대기 중인 요청들 */}
            <div className="mb-3">
                <h6 className="text-warning mb-2">
                    ⏳ 대기 큐 ({pendingRequests.length}개)
                </h6>
                
                {pendingRequests.length > 0 ? (
                    <div className="pending-requests-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {pendingRequests.map((request, index) => (
                            <div key={index} className="mb-2 p-2 bg-light bg-opacity-10 rounded">
                                <div className="d-flex justify-content-between align-items-start">
                                    <div className="flex-grow-1">
                                        <div className="small">
                                            <span className="badge bg-warning text-dark me-2">#{request.position}</span>
                                            <strong>{request.username}:</strong>
                                            <span className="ms-2">"{request.message}"</span>
                                        </div>
                                    </div>
                                    <div className="text-end">
                                        <span className={`badge ${
                                            request.waiting_time > 30 ? 'bg-danger' :
                                            request.waiting_time > 10 ? 'bg-warning' : 'bg-success'
                                        } text-dark small`}>
                                            {request.waiting_time ? `${request.waiting_time.toFixed(1)}초 대기` : '방금 전'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-2">
                        <span className="text-muted small">대기 중인 요청이 없습니다</span>
                    </div>
                )}
            </div>

            {/* 큐 성능 지표 */}
            <div className="row g-1 small">
                <div className="col-6">
                    <strong>최대 큐 길이:</strong>
                    <span className="badge bg-info ms-2">{metrics.max_queue_length || 0}</span>
                </div>
                <div className="col-6">
                    <strong>해시 캐시:</strong>
                    <span className="badge bg-secondary ms-2">{metrics.recent_hashes_count || 0}/50</span>
                </div>
            </div>

            {/* 처리 시간 히스토리 */}
            {metrics.recent_processing_times && metrics.recent_processing_times.length > 0 && (
                <div className="mt-2">
                    <small><strong>최근 처리 시간:</strong></small>
                    <div className="mt-1">
                        {metrics.recent_processing_times.slice(-5).map((time, index) => (
                            <span key={index} className="badge bg-dark text-light me-1 small">
                                {time.toFixed(1)}s
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RequestQueueDebugPanel;