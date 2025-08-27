import React from 'react';

/**
 * QueueFlowDebugPanel - 큐 플로우 전체 상태를 시각화하는 디버그 패널
 * 
 * 요청-처리-응답의 전체 플로우를 시각적으로 표시
 * - 전체 시스템 상태 개요
 * - 플로우 단계별 상태
 * - 병목 지점 식별
 * - 전체 성능 메트릭
 */
const QueueFlowDebugPanel = ({ detailedQueueInfo, queueStatus, sessionInfo, isMinimized = false }) => {
    if (!detailedQueueInfo || !sessionInfo) {
        return (
            <div className="mt-3 p-2 bg-success bg-opacity-10 rounded">
                <h6 className="text-success mb-2">🔄 큐 플로우 (데이터 없음)</h6>
                <small className="text-muted">서버에서 플로우 정보를 수신하지 못했습니다.</small>
            </div>
        );
    }

    const currentProcessing = detailedQueueInfo.current_processing;
    const pendingRequests = detailedQueueInfo.pending_requests || [];
    const recentHistory = detailedQueueInfo.recent_history || [];
    const metrics = detailedQueueInfo.metrics || {};
    const queueLength = sessionInfo.queue_length || 0;
    const isProcessing = sessionInfo.is_processing || false;

    // 시스템 상태 계산
    const systemStatus = getSystemStatus(queueLength, isProcessing, metrics);
    const throughput = calculateThroughput(recentHistory);

    if (isMinimized) {
        return (
            <div className="mt-2 p-2 bg-success bg-opacity-10 rounded">
                <div className="d-flex justify-content-between align-items-center">
                    <span className="fw-bold text-success">🔄 큐 플로우</span>
                    <div>
                        <span className={`badge me-2 ${
                            systemStatus.status === 'healthy' ? 'bg-success' :
                            systemStatus.status === 'warning' ? 'bg-warning' :
                            systemStatus.status === 'critical' ? 'bg-danger' : 'bg-secondary'
                        }`}>
                            {systemStatus.label}
                        </span>
                        <span className="badge bg-info">{throughput.toFixed(1)}/분</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-3 p-2 bg-success bg-opacity-10 rounded">
            <h6 className="text-success mb-2">🔄 큐 플로우 전체 상태</h6>
            
            {/* 시스템 상태 요약 */}
            <div className="mb-3 p-2 bg-light bg-opacity-10 rounded">
                <div className="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>시스템 상태:</strong>
                        <span className={`badge ms-2 ${
                            systemStatus.status === 'healthy' ? 'bg-success' :
                            systemStatus.status === 'warning' ? 'bg-warning text-dark' :
                            systemStatus.status === 'critical' ? 'bg-danger' : 'bg-secondary'
                        }`}>
                            {systemStatus.label}
                        </span>
                    </div>
                    <div>
                        <span className="badge bg-info me-2">
                            처리량: {throughput.toFixed(1)}개/분
                        </span>
                        <span className="badge bg-secondary">
                            업타임: {sessionInfo.uptime_ms ? `${(sessionInfo.uptime_ms / 1000 / 60).toFixed(1)}분` : 'N/A'}
                        </span>
                    </div>
                </div>
                <div className="mt-2 small text-muted">
                    {systemStatus.description}
                </div>
            </div>

            {/* 플로우 시각화 */}
            <div className="mb-3">
                <h6 className="text-success mb-2">📊 처리 플로우</h6>
                <QueueFlowVisualization 
                    pendingRequests={pendingRequests}
                    currentProcessing={currentProcessing}
                    recentHistory={recentHistory}
                    isProcessing={isProcessing}
                />
            </div>

            {/* 성능 메트릭 */}
            <div className="row g-1 small mb-3">
                <div className="col-3">
                    <strong>총 처리:</strong>
                    <span className="badge bg-primary ms-2">{metrics.total_processed || 0}</span>
                </div>
                <div className="col-3">
                    <strong>취소율:</strong>
                    <span className="badge bg-warning text-dark ms-2">
                        {metrics.total_processed > 0 ? 
                            `${((metrics.cancelled_requests || 0) / metrics.total_processed * 100).toFixed(1)}%` : '0%'
                        }
                    </span>
                </div>
                <div className="col-3">
                    <strong>평균 대기:</strong>
                    <span className="badge bg-info ms-2">
                        {calculateAverageWaitTime(pendingRequests).toFixed(1)}초
                    </span>
                </div>
                <div className="col-3">
                    <strong>최대 큐:</strong>
                    <span className="badge bg-secondary ms-2">{metrics.max_queue_length || 0}</span>
                </div>
            </div>

            {/* 병목 분석 */}
            <BottleneckAnalysis 
                metrics={metrics}
                pendingRequests={pendingRequests}
                currentProcessing={currentProcessing}
            />

            {/* 시스템 권장사항 */}
            <SystemRecommendations systemStatus={systemStatus} metrics={metrics} />
        </div>
    );
};

// 플로우 시각화 컴포넌트
const QueueFlowVisualization = ({ pendingRequests, currentProcessing, recentHistory, isProcessing }) => {
    return (
        <div className="d-flex align-items-center justify-content-between p-2 bg-dark bg-opacity-25 rounded">
            {/* 대기 큐 */}
            <div className="text-center">
                <div className={`badge ${pendingRequests.length > 5 ? 'bg-danger' : 
                                        pendingRequests.length > 2 ? 'bg-warning text-dark' : 'bg-success'}`}>
                    {pendingRequests.length}개 대기
                </div>
                <div className="small text-muted mt-1">요청 큐</div>
                <div className="mt-1">
                    {Array.from({ length: Math.min(pendingRequests.length, 5) }, (_, i) => (
                        <div key={i} className="bg-warning rounded mb-1" style={{ width: '20px', height: '4px' }} />
                    ))}
                    {pendingRequests.length > 5 && <div className="small text-muted">+{pendingRequests.length - 5}</div>}
                </div>
            </div>

            {/* 화살표 */}
            <div className="mx-3">
                <span className={`text-${isProcessing ? 'primary' : 'muted'}`}>→</span>
            </div>

            {/* 처리 중 */}
            <div className="text-center">
                <div className={`badge ${isProcessing ? 'bg-primary' : 'bg-secondary'}`}>
                    {isProcessing ? '처리 중' : '유휴'}
                </div>
                <div className="small text-muted mt-1">프로세서</div>
                <div className="mt-1">
                    <div className={`rounded ${isProcessing ? 'bg-primary' : 'bg-secondary'}`} 
                         style={{ width: '20px', height: '8px' }} />
                </div>
                {currentProcessing && (
                    <div className="small text-muted mt-1">
                        {currentProcessing.processing_duration?.toFixed(1)}초
                    </div>
                )}
            </div>

            {/* 화살표 */}
            <div className="mx-3">
                <span className={`text-${recentHistory.length > 0 ? 'success' : 'muted'}`}>→</span>
            </div>

            {/* 완료된 응답 */}
            <div className="text-center">
                <div className="badge bg-success">
                    {recentHistory.filter(h => h.status === 'completed').length}개 완료
                </div>
                <div className="small text-muted mt-1">응답</div>
                <div className="mt-1">
                    {Array.from({ length: Math.min(recentHistory.length, 3) }, (_, i) => (
                        <div key={i} className={`rounded mb-1 ${
                            recentHistory[i]?.status === 'completed' ? 'bg-success' :
                            recentHistory[i]?.status === 'failed' ? 'bg-danger' : 'bg-warning'
                        }`} style={{ width: '20px', height: '4px' }} />
                    ))}
                </div>
            </div>
        </div>
    );
};

// 병목 분석 컴포넌트
const BottleneckAnalysis = ({ metrics, pendingRequests, currentProcessing }) => {
    const bottlenecks = [];

    // 큐 길이 분석
    if (pendingRequests.length > 5) {
        bottlenecks.push({
            type: 'queue_length',
            severity: 'high',
            message: `대기 큐가 ${pendingRequests.length}개로 많습니다`,
            suggestion: '처리 속도 개선이 필요합니다'
        });
    }

    // 처리 시간 분석
    const avgProcessingTime = metrics.avg_processing_time || 0;
    if (avgProcessingTime > 10) {
        bottlenecks.push({
            type: 'processing_time',
            severity: 'medium',
            message: `평균 처리 시간이 ${avgProcessingTime.toFixed(1)}초로 깁니다`,
            suggestion: 'AI 모델 최적화 또는 더 빠른 TTS 엔진 고려'
        });
    }

    // 취소율 분석
    const cancelRate = metrics.total_processed > 0 ? 
        (metrics.cancelled_requests || 0) / metrics.total_processed : 0;
    if (cancelRate > 0.2) {
        bottlenecks.push({
            type: 'cancel_rate',
            severity: 'medium',
            message: `취소율이 ${(cancelRate * 100).toFixed(1)}%로 높습니다`,
            suggestion: '사용자 경험 개선이 필요합니다'
        });
    }

    if (bottlenecks.length === 0) {
        return (
            <div className="mt-3 p-2 bg-success bg-opacity-10 rounded">
                <small className="text-success">✅ 병목 지점이 발견되지 않았습니다. 시스템이 정상적으로 동작하고 있습니다.</small>
            </div>
        );
    }

    return (
        <div className="mt-3">
            <h6 className="text-warning mb-2">⚠️ 병목 분석</h6>
            {bottlenecks.map((bottleneck, index) => (
                <div key={index} className={`mb-2 p-2 rounded ${
                    bottleneck.severity === 'high' ? 'bg-danger bg-opacity-20' :
                    bottleneck.severity === 'medium' ? 'bg-warning bg-opacity-20' : 'bg-info bg-opacity-20'
                }`}>
                    <div className="small">
                        <span className={`badge ${
                            bottleneck.severity === 'high' ? 'bg-danger' :
                            bottleneck.severity === 'medium' ? 'bg-warning text-dark' : 'bg-info'
                        } me-2`}>
                            {bottleneck.severity === 'high' ? '🔴 높음' :
                             bottleneck.severity === 'medium' ? '🟡 중간' : '🔵 낮음'}
                        </span>
                        <strong>{bottleneck.message}</strong>
                    </div>
                    <div className="small text-muted mt-1">💡 {bottleneck.suggestion}</div>
                </div>
            ))}
        </div>
    );
};

// 시스템 권장사항 컴포넌트
const SystemRecommendations = ({ systemStatus, metrics }) => {
    if (systemStatus.status === 'healthy') {
        return null;
    }

    const recommendations = [];
    
    if (systemStatus.status === 'warning') {
        recommendations.push('처리량 모니터링 강화');
        recommendations.push('캐싱 전략 검토');
    }
    
    if (systemStatus.status === 'critical') {
        recommendations.push('즉시 시스템 점검 필요');
        recommendations.push('부하 분산 검토');
        recommendations.push('리소스 확장 고려');
    }

    return (
        <div className="mt-3 p-2 bg-info bg-opacity-10 rounded">
            <h6 className="text-info mb-2">💡 권장사항</h6>
            <ul className="small mb-0 ps-3">
                {recommendations.map((rec, index) => (
                    <li key={index}>{rec}</li>
                ))}
            </ul>
        </div>
    );
};

// 유틸리티 함수들
function getSystemStatus(queueLength, isProcessing, metrics) {
    const avgProcessingTime = metrics.avg_processing_time || 0;
    const cancelRate = metrics.total_processed > 0 ? 
        (metrics.cancelled_requests || 0) / metrics.total_processed : 0;

    if (queueLength > 10 || avgProcessingTime > 15 || cancelRate > 0.5) {
        return {
            status: 'critical',
            label: '🔴 위험',
            description: '시스템에 심각한 부하가 있습니다. 즉시 조치가 필요합니다.'
        };
    }
    
    if (queueLength > 5 || avgProcessingTime > 8 || cancelRate > 0.2) {
        return {
            status: 'warning',
            label: '🟡 주의',
            description: '시스템 성능이 저하되고 있습니다. 모니터링을 강화하세요.'
        };
    }
    
    return {
        status: 'healthy',
        label: '🟢 정상',
        description: '시스템이 정상적으로 동작하고 있습니다.'
    };
}

function calculateThroughput(recentHistory) {
    if (recentHistory.length === 0) return 0;
    
    const now = Date.now();
    const oneMinuteAgo = now - 60000; // 1분 전
    
    const recentCompletions = recentHistory.filter(item => 
        item.timestamp && item.timestamp > oneMinuteAgo && item.status === 'completed'
    );
    
    return recentCompletions.length;
}

function calculateAverageWaitTime(pendingRequests) {
    if (pendingRequests.length === 0) return 0;
    
    const totalWaitTime = pendingRequests.reduce((sum, req) => sum + (req.waiting_time || 0), 0);
    return totalWaitTime / pendingRequests.length;
}

export default QueueFlowDebugPanel;