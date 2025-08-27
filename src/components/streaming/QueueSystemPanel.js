import React, { useState, useEffect } from 'react';
import RequestQueueDebugPanel from './RequestQueueDebugPanel';
import ResponseQueueDebugPanel from './ResponseQueueDebugPanel';
import QueueFlowDebugPanel from './QueueFlowDebugPanel';
import './QueueSystemPanel.css';

/**
 * 화면 우측에 고정된 Queue System Panel
 * 실시간 요청/응답 큐 상태를 모니터링
 */
const QueueSystemPanel = ({ 
    detailedQueueInfo, 
    queueStatus, 
    sessionInfo,
    isVisible = true,
    onToggle 
}) => {
    const [activeTab, setActiveTab] = useState('flow'); // 'flow', 'request', 'response'
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [debugData, setDebugData] = useState({
        lastUpdate: null,
        connectionStatus: 'disconnected',
        dataReceived: false
    });

    // 데이터 수신 상태 추적
    useEffect(() => {
        console.log('🔍 Queue Panel Data 업데이트:', { 
            detailedQueueInfo: detailedQueueInfo ? 'received' : 'null', 
            queueStatus: queueStatus ? 'received' : 'null', 
            sessionInfo: sessionInfo ? 'received' : 'null' 
        });
        
        if (detailedQueueInfo || queueStatus || sessionInfo) {
            setDebugData(prev => ({
                ...prev,
                lastUpdate: new Date(),
                connectionStatus: 'connected',
                dataReceived: true
            }));
        }
    }, [detailedQueueInfo, queueStatus, sessionInfo]);

    if (!isVisible) {
        return null;
    }

    return (
        <div className={`queue-system-panel ${isCollapsed ? 'collapsed' : ''}`}>
            {/* 패널 헤더 */}
            <div className="queue-panel-header">
                <div className="d-flex justify-content-between align-items-center">
                    <h6 className="mb-0 text-white">
                        🔄 큐 시스템 모니터
                    </h6>
                    <div className="d-flex align-items-center">
                        {/* 연결 상태 표시 */}
                        <span className={`connection-status ${debugData.connectionStatus}`}>
                            {debugData.connectionStatus === 'connected' ? '🟢' : '🔴'}
                        </span>
                        
                        {/* 접기/펼치기 버튼 */}
                        <button 
                            className="btn btn-sm btn-link text-white p-1 ms-2"
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            title={isCollapsed ? "패널 펼치기" : "패널 접기"}
                        >
                            {isCollapsed ? '▶' : '◀'}
                        </button>
                        
                        {/* 닫기 버튼 */}
                        <button 
                            className="btn btn-sm btn-link text-white p-1 ms-1"
                            onClick={onToggle}
                            title="패널 닫기"
                        >
                            ✕
                        </button>
                    </div>
                </div>
                
                {/* 마지막 업데이트 시간 */}
                {debugData.lastUpdate && (
                    <small className="text-muted">
                        마지막 업데이트: {debugData.lastUpdate.toLocaleTimeString()}
                    </small>
                )}
            </div>

            {/* 패널 내용 */}
            {!isCollapsed && (
                <div className="queue-panel-content">
                    {/* 탭 네비게이션 */}
                    <div className="queue-tabs">
                        <nav>
                            <div className="nav nav-pills nav-fill" role="tablist">
                                <button 
                                    className={`nav-link ${activeTab === 'flow' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('flow')}
                                    type="button"
                                >
                                    📊 플로우
                                </button>
                                <button 
                                    className={`nav-link ${activeTab === 'request' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('request')}
                                    type="button"
                                >
                                    📥 요청큐
                                </button>
                                <button 
                                    className={`nav-link ${activeTab === 'response' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('response')}
                                    type="button"
                                >
                                    📤 응답큐
                                </button>
                            </div>
                        </nav>
                    </div>

                    {/* 탭 내용 */}
                    <div className="queue-tab-content">
                        {/* 데이터 없음 경고 */}
                        {!debugData.dataReceived && (
                            <div className="alert alert-warning">
                                <h6>⚠️ 데이터 수신 안됨</h6>
                                <p className="mb-2 small">WebSocket 연결을 확인하세요:</p>
                                <ul className="small mb-0">
                                    <li>StreamingChat 컴포넌트 연결 상태</li>
                                    <li>백엔드 서버 실행 여부</li>
                                    <li>브라우저 개발자 도구의 네트워크 탭</li>
                                </ul>
                            </div>
                        )}

                        {/* 디버그 정보 표시 */}
                        <div className="debug-info mb-3">
                            <small className="text-muted">
                                <strong>디버그:</strong> 
                                detailedQueueInfo={detailedQueueInfo ? '✅' : '❌'}, 
                                queueStatus={queueStatus ? '✅' : '❌'}, 
                                sessionInfo={sessionInfo ? '✅' : '❌'}
                            </small>
                        </div>

                        {/* 큐 플로우 탭 */}
                        {activeTab === 'flow' && (
                            <QueueFlowDebugPanel 
                                detailedQueueInfo={detailedQueueInfo}
                                queueStatus={queueStatus}
                                sessionInfo={sessionInfo}
                                isMinimized={false}
                            />
                        )}

                        {/* 요청 큐 탭 */}
                        {activeTab === 'request' && (
                            <RequestQueueDebugPanel 
                                detailedQueueInfo={detailedQueueInfo}
                                isMinimized={false}
                            />
                        )}

                        {/* 응답 큐 탭 */}
                        {activeTab === 'response' && (
                            <ResponseQueueDebugPanel 
                                detailedQueueInfo={detailedQueueInfo}
                                queueStatus={queueStatus}
                                isMinimized={false}
                            />
                        )}
                    </div>

                    {/* 실시간 요약 정보 (항상 표시) */}
                    <div className="queue-summary">
                        <div className="row g-2 text-center">
                            <div className="col-4">
                                <div className="summary-item">
                                    <div className="summary-value">
                                        {sessionInfo?.queue_length || 0}
                                    </div>
                                    <div className="summary-label">대기중</div>
                                </div>
                            </div>
                            <div className="col-4">
                                <div className="summary-item">
                                    <div className={`summary-value ${sessionInfo?.is_processing ? 'text-primary' : 'text-muted'}`}>
                                        {sessionInfo?.is_processing ? '처리중' : '대기'}
                                    </div>
                                    <div className="summary-label">상태</div>
                                </div>
                            </div>
                            <div className="col-4">
                                <div className="summary-item">
                                    <div className="summary-value">
                                        {detailedQueueInfo?.metrics?.total_processed || 0}
                                    </div>
                                    <div className="summary-label">완료</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QueueSystemPanel;