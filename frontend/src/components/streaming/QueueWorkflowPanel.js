import React, { useState, useEffect } from 'react';
import { Button } from 'react-bootstrap';
import RequestQueueDebugPanel from './RequestQueueDebugPanel';
import ResponseQueueDebugPanel from './ResponseQueueDebugPanel';
import QueueFlowDebugPanel from './QueueFlowDebugPanel';
import panelStyles from './Panels.module.css';

/**
 * QueueWorkflowPanel - Request Queue와 Response Queue를 통합 모니터링하는 메인 패널
 * Debug Panel과 동일한 크기와 위치로 배치됨
 * 
 * 실시간으로 다음 workflow를 추적:
 * 1. 사용자 요청 → Request Queue 
 * 2. Request Queue → MediaPacket 생성
 * 3. MediaPacket → Response Queue
 * 4. Response Queue → 순차 재생
 */
const QueueWorkflowPanel = ({ 
    detailedQueueInfo, 
    queueStatus, 
    sessionInfo,
    isVisible = true,
    onToggle 
}) => {
    const [activeTab, setActiveTab] = useState('flow'); // 'flow', 'queues'
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

    const requestQueue = detailedQueueInfo?.request_queue || {};
    const responseQueue = detailedQueueInfo?.response_queue || {};
    const metrics = detailedQueueInfo?.metrics || {};

    return (
        <div className={panelStyles.overlay} style={{ right: '20px', left: 'auto' }}>
            <div className={panelStyles.floating} style={{
                minWidth: activeTab === 'queues' ? '600px' : '320px',
                maxWidth: activeTab === 'queues' ? '800px' : '400px',
                maxHeight: '80vh',
                overflowY: 'auto'
            }}>
                {/* 탭 헤더 - Debug Panel과 동일한 형태 */}
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <div className="d-flex gap-2">
                        <Button 
                            variant={activeTab === 'flow' ? "info" : "outline-info"}
                            size="sm" 
                            onClick={() => setActiveTab('flow')}
                        >
                            📊 플로우
                        </Button>
                        <Button 
                            variant={activeTab === 'queues' ? "success" : "outline-success"}
                            size="sm" 
                            onClick={() => setActiveTab('queues')}
                        >
                            📥📤 큐 상세
                        </Button>
                    </div>
                    <div className="d-flex align-items-center">
                        {/* 연결 상태 표시 */}
                        <span className={`connection-status me-2 ${debugData.connectionStatus}`}>
                            {debugData.connectionStatus === 'connected' ? '🟢' : '🔴'}
                        </span>
                        {onToggle && (
                            <Button 
                                variant="outline-secondary" 
                                size="sm" 
                                onClick={onToggle}
                                title="패널 닫기"
                            >
                                ✕
                            </Button>
                        )}
                    </div>
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
                        <small style={{ color: '#adb5bd' }}>
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

                    {/* 통합 큐 탭 - 요청큐와 응답큐 좌우 배치 (전체 정보 표시) */}
                    {activeTab === 'queues' && (
                        <div>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <RequestQueueDebugPanel 
                                        detailedQueueInfo={detailedQueueInfo}
                                        isMinimized={false}
                                    />
                                </div>
                                <div className="col-md-6">
                                    <ResponseQueueDebugPanel 
                                        detailedQueueInfo={detailedQueueInfo}
                                        queueStatus={queueStatus}
                                        isMinimized={false}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QueueWorkflowPanel;