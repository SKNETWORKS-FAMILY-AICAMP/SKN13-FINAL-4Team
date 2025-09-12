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
                <small style={{ color: '#adb5bd' }}>서버에서 큐 정보를 수신하지 못했습니다.</small>
            </div>
        );
    }

    const requestQueue = detailedQueueInfo.request_queue || {};
    const currentProcessing = requestQueue.current_processing;
    const pendingRequests = requestQueue.pending_requests || [];
    const metrics = detailedQueueInfo.metrics || {};

    if (isMinimized) {
        return (
            <div className="mt-2 p-2 bg-warning bg-opacity-10 rounded">
                <div className="d-flex justify-content-between align-items-center">
                    <span className="fw-bold text-warning">📥 요청 큐</span>
                    <div>
                        <span className="badge bg-warning text-dark me-2">{pendingRequests.length} 대기</span>
                        <span className={`badge ${requestQueue.is_processing ? 'bg-primary' : 'bg-secondary'}`}>
                            {requestQueue.is_processing ? '처리 중' : '유휴'}
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
                    <span style={{ color: '#adb5bd' }}>현재 처리 중인 요청이 없습니다</span>
                </div>
            )}

            {/* 대기 중인 요청들 - 스택 시각화 */}
            <div className="mb-3">
                <h6 className="text-warning mb-2">
                    ⏳ 대기 큐 ({pendingRequests.length}개)
                </h6>
                
                {pendingRequests.length > 0 ? (
                    <>
                        {/* 스택 시각화 */}
                        <div className="queue-stack mb-3" style={{ 
                            display: 'flex', 
                            flexDirection: 'column-reverse',
                            gap: '2px',
                            minHeight: '60px',
                            alignItems: 'center'
                        }}>
                            {pendingRequests.slice(0, 5).map((request, index) => (
                                <div 
                                    key={index}
                                    className="stack-item"
                                    style={{
                                        width: `${90 - index * 5}%`,
                                        height: '20px',
                                        backgroundColor: index === 0 ? '#ffc107' : 
                                                       index === 1 ? '#fd7e14' :
                                                       index === 2 ? '#dc3545' : '#6c757d',
                                        borderRadius: '3px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#fff',
                                        fontSize: '0.7rem',
                                        fontWeight: 'bold',
                                        border: '1px solid rgba(255,255,255,0.2)'
                                    }}
                                    title={`${request.username}: ${request.message}`}
                                >
                                    #{request.position} {request.username}
                                </div>
                            ))}
                            {pendingRequests.length > 5 && (
                                <div style={{
                                    fontSize: '0.7rem',
                                    color: '#adb5bd',
                                    marginTop: '5px'
                                }}>
                                    +{pendingRequests.length - 5} more...
                                </div>
                            )}
                        </div>

                        {/* 상세 요청 목록 */}
                        <div className="pending-requests-list" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                            {pendingRequests.slice(0, 3).map((request, index) => (
                                <div key={index} className="mb-1 p-1 bg-light bg-opacity-10 rounded">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div className="flex-grow-1">
                                            <div className="small">
                                                <span className="badge bg-warning text-dark me-1" style={{ fontSize: '0.6rem' }}>
                                                    #{request.position}
                                                </span>
                                                <strong style={{ fontSize: '0.7rem' }}>{request.username}:</strong>
                                                <span className="ms-1" style={{ fontSize: '0.7rem' }}>"{request.message?.substring(0, 15)}..."</span>
                                            </div>
                                        </div>
                                        <div className="text-end">
                                            <span className={`badge ${
                                                request.waiting_time > 30 ? 'bg-danger' :
                                                request.waiting_time > 10 ? 'bg-warning' : 'bg-success'
                                            } text-dark`} style={{ fontSize: '0.6rem' }}>
                                                {request.waiting_time ? `${request.waiting_time.toFixed(0)}초` : '방금'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {pendingRequests.length > 3 && (
                                <div className="text-center">
                                    <small style={{ color: '#adb5bd', fontSize: '0.6rem' }}>
                                        ... 및 {pendingRequests.length - 3}개 더
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
                            <span className="small" style={{ color: '#adb5bd' }}>대기 중인 요청이 없습니다</span>
                        </div>
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