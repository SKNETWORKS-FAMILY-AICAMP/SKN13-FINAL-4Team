import React, { useState } from 'react';
import RequestQueueDebugPanel from './RequestQueueDebugPanel';
import ResponseQueueDebugPanel from './ResponseQueueDebugPanel';
import QueueFlowDebugPanel from './QueueFlowDebugPanel';

// 음성 ID를 한국어 이름으로 매핑
const getVoiceName = (voiceId) => {
    const voiceMap = {
        'aneunjin': '안은진 (밝고 명료한 여성)',
        'kimtaeri': '김태리 (감정 표현 뛰어난 여성)',
        'kimminjeong': '김민정 (차분하고 안정적인 여성)',
        'jinseonkyu': '진선규 (따뜻하고 친근한 남성)',
        'parkchangwook': '박창욱 (깊이 있고 권위적인 남성)',
        'jiyoung': 'JiYoung (활기찬 젊은 여성)'
    };
    return voiceMap[voiceId] || voiceId;
};

// 모델 ID를 설명과 함께 표시
const getModelDescription = (modelId) => {
    const modelMap = {
        'eleven_v3': 'V3 (최신, 고품질)',
        'eleven_turbo_v2_5': 'Turbo V2.5 (개선된 고속)',
        'eleven_multilingual_v2': 'Multilingual V2 (다국어)',
        'eleven_turbo_v2': 'Turbo V2 (고속)',
        'eleven_monolingual_v1': 'Monolingual V1 (영어 전용)'
    };
    return modelMap[modelId] || modelId;
};

const DebugPanel = ({ 
    debugInfo, 
    syncDebugInfo, 
    revealedSubtitle, 
    currentVideo, 
    videoTransitionRef, 
    showSubtitle, 
    streamerId, 
    isBroadcastingEnabled,
    // 🆕 Queue 상태 정보
    queueStatus,
    sessionInfo,
    // 🆕 상세 큐 디버그 정보
    detailedQueueInfo
}) => {
    const [queueDebugMode, setQueueDebugMode] = useState('overview'); // 'overview', 'detailed', 'minimized'
    return (
        <div className="debug-content">
            {/* TTS 엔진 정보 */}
            <div className="row g-2">
                <div className="col-12 mb-2">
                    <strong>🎵 TTS 엔진:</strong>
                    <span className={`badge ms-2 ${
                        debugInfo.ttsEngine === 'openai' ? 'bg-success' :
                        debugInfo.ttsEngine === 'elevenlabs' ? 'bg-primary' :
                        debugInfo.ttsEngine === 'melotts' ? 'bg-warning' :
                        debugInfo.ttsEngine === 'coqui' ? 'bg-info' : 'bg-secondary'
                    }`}>
                        {debugInfo.ttsEngine === 'elevenlabs' ? 'ElevenLabs TTS' :
                         debugInfo.ttsEngine === 'openai' ? 'OpenAI TTS' :
                         debugInfo.ttsEngine === 'melotts' ? 'MeloTTS' :
                         debugInfo.ttsEngine === 'coqui' ? 'Coqui TTS' :
                         debugInfo.ttsEngine?.toUpperCase() || 'Unknown'}
                    </span>
                    
                    {/* 폴백 및 엔진 불일치 표시 */}
                    {debugInfo.fallbackUsed && (
                        <span className="badge bg-warning ms-2" title={`요청: ${debugInfo.requestedEngine}, 실제사용: ${debugInfo.ttsEngine}`}>
                            ⚠️ 폴백됨 ({debugInfo.requestedEngine} → {debugInfo.ttsEngine})
                        </span>
                    )}
                    {debugInfo.requestedEngine !== debugInfo.ttsEngine && !debugInfo.fallbackUsed && (
                        <span className="badge bg-info ms-2" title="설정과 실제 사용 엔진이 다름">
                            ℹ️ 엔진불일치 (설정:{debugInfo.requestedEngine} / 사용:{debugInfo.ttsEngine})
                        </span>
                    )}
                    
                </div>

                {/* 동기화 모드 */}
                <div className="col-6">
                    <strong>동기화:</strong>
                    <span className={`badge ms-2 ${
                        debugInfo.syncMode === 'real_time' ? 'bg-success' :
                        debugInfo.syncMode === 'after_complete' ? 'bg-primary' : 
                        debugInfo.syncMode === 'chunked' ? 'bg-warning' :
                        debugInfo.syncMode === 'broadcasting' ? 'bg-info' :
                        'bg-secondary'
                    }`}>
                        {debugInfo.syncMode === 'real_time' ? '⚡ Real Time' : 
                         debugInfo.syncMode === 'after_complete' ? '📋 After Complete' : 
                         debugInfo.syncMode === 'chunked' ? '📦 Chunked' :
                         debugInfo.syncMode === 'broadcasting' ? '📡 Broadcasting' :
                         debugInfo.syncMode || 'None'}
                    </span>
                    {isBroadcastingEnabled && (
                        <span className="badge bg-success ms-1" title="Broadcasting 시스템 활성화됨">
                            📡
                        </span>
                    )}
                </div>

                {/* 재생 상태 */}
                <div className="col-6">
                    <strong>상태:</strong>
                    <span className={`badge ms-2 ${debugInfo.isPlaying ? 'bg-success' : 'bg-secondary'}`}>
                        {debugInfo.isPlaying ? '재생 중' : '정지'}
                    </span>
                </div>

                {/* 시간 정보 */}
                <div className="col-6">
                    <strong>시간:</strong>
                    <span className="ms-2 small">{debugInfo.currentTime?.toFixed(1) || 0}s / {debugInfo.audioDuration?.toFixed(1) || 0}s</span>
                </div>

                {/* 텍스트 정보 */}
                <div className="col-6">
                    <strong>텍스트:</strong>
                    <span className="ms-2 small">{debugInfo.revealedChars || 0} / {debugInfo.totalChars || 0}자</span>
                </div>

                {/* 선택된 Voice 모델 정보 */}
                {debugInfo.voiceSettings && debugInfo.voiceSettings.elevenLabsVoice && (
                    <div className="col-12">
                        <strong>🎤 Voice:</strong>
                        <span className="badge bg-info text-dark ms-2">{getVoiceName(debugInfo.voiceSettings.elevenLabsVoice)}</span>
                        {debugInfo.voiceSettings.elevenLabsModel && (
                            <span className="badge bg-warning text-dark ms-1">{getModelDescription(debugInfo.voiceSettings.elevenLabsModel)}</span>
                        )}
                    </div>
                )}

                {/* 파일 크기 정보 */}
                {debugInfo.audioFileSize > 0 && (
                    <div className="col-6">
                        <strong>파일:</strong>
                        <span className="ms-2 small">{(debugInfo.audioFileSize / 1024).toFixed(1)}KB</span>
                    </div>
                )}

                {/* 생성 시간 정보 */}
                {debugInfo.generationTime > 0 && (
                    <div className="col-6">
                        <strong>생성:</strong>
                        <span className="ms-2 small">{debugInfo.generationTime.toFixed(2)}초</span>
                    </div>
                )}

                {/* 오류 정보 */}
                {debugInfo.error && (
                    <div className="col-12 mt-2">
                        <span className="badge bg-danger me-2">⚠️ 오류</span>
                        <small className="text-danger">{debugInfo.error}</small>
                    </div>
                )}
            </div>

            {/* 진행률 바 */}
            <div className="progress mt-2" style={{ height: '3px' }}>
                <div 
                    className="progress-bar bg-success" 
                    style={{ width: `${debugInfo.textProgress || 0}%` }}
                ></div>
            </div>
            
            {/* 현재 표시 중인 텍스트 */}
            <small className="text-muted d-block mt-1" style={{ fontSize: '0.7rem' }}>
                "{revealedSubtitle && revealedSubtitle.length > 50 ? revealedSubtitle.substring(0, 50) + '...' : revealedSubtitle || ''}"
            </small>

            {/* 비디오 디버그 정보 */}
            <VideoDebugInfo 
                currentVideo={currentVideo}
                videoTransitionRef={videoTransitionRef}
                showSubtitle={showSubtitle}
            />

            {/* Broadcasting 시스템 디버그 정보 */}
            {isBroadcastingEnabled && (
                <BroadcastingDebugInfo 
                    syncDebugInfo={syncDebugInfo}
                    streamerId={streamerId}
                />
            )}

            {/* 🆕 Enhanced Queue 시스템 디버그 정보 */}
            <EnhancedQueueDebugInfo 
                queueStatus={queueStatus}
                sessionInfo={sessionInfo}
                detailedQueueInfo={detailedQueueInfo}
                queueDebugMode={queueDebugMode}
                setQueueDebugMode={setQueueDebugMode}
            />
        </div>
    );
};

// 비디오 디버그 정보 서브 컴포넌트
const VideoDebugInfo = ({ currentVideo, videoTransitionRef, showSubtitle }) => (
    <div className="mt-3 p-2 bg-dark bg-opacity-75 rounded">
        <h6 className="text-warning mb-2">🎥 비디오 상태</h6>
        <div className="row g-1 small">
            <div className="col-12">
                <strong>현재 비디오:</strong> 
                <span className="badge bg-warning text-dark ms-2">{currentVideo || 'N/A'}</span>
            </div>
            <div className="col-6">
                <strong>비디오 전환:</strong> 
                <span className={`badge ms-2 ${videoTransitionRef?.current ? 'bg-success' : 'bg-secondary'}`}>
                    {videoTransitionRef?.current ? '활성' : '비활성'}
                </span>
            </div>
            <div className="col-6">
                <strong>자막 표시:</strong> 
                <span className={`badge ms-2 ${showSubtitle ? 'bg-success' : 'bg-secondary'}`}>
                    {showSubtitle ? '표시 중' : '숨김'}
                </span>
            </div>
        </div>
    </div>
);

// Broadcasting 디버그 정보 서브 컴포넌트
const BroadcastingDebugInfo = ({ syncDebugInfo, streamerId }) => (
    <div className="mt-3 p-2 bg-primary bg-opacity-10 rounded">
        <h6 className="text-primary mb-2">📡 Broadcasting 상태</h6>
        <div className="row g-1 small">
            <div className="col-6">
                <strong>Sync ID:</strong>
                <span className="ms-2 font-monospace" style={{ fontSize: '0.7rem' }}>
                    {syncDebugInfo.sync_id ? syncDebugInfo.sync_id.substring(0, 8) + '...' : 'N/A'}
                </span>
            </div>
            <div className="col-6">
                <strong>네트워크 지연:</strong>
                <span className={`badge ms-2 ${
                    syncDebugInfo.network_latency < 0.1 ? 'bg-success' :
                    syncDebugInfo.network_latency < 0.3 ? 'bg-warning' : 'bg-danger'
                }`}>
                    {((syncDebugInfo.network_latency || 0) * 1000).toFixed(0)}ms
                </span>
            </div>
            <div className="col-6">
                <strong>Sync 상태:</strong>
                <span className={`badge ms-2 ${
                    syncDebugInfo.sync_status === 'broadcasting' ? 'bg-primary' :
                    syncDebugInfo.sync_status === 'idle' ? 'bg-secondary' :
                    syncDebugInfo.sync_status === 'error' ? 'bg-danger' : 'bg-info'
                }`}>
                    {syncDebugInfo.sync_status || 'unknown'}
                </span>
            </div>
            <div className="col-6">
                <strong>활성 브로드캐스트:</strong>
                <span className="badge bg-info ms-2">{syncDebugInfo.active_broadcasts || 0}</span>
            </div>
            <div className="col-12">
                <strong>캐릭터:</strong>
                <span className="badge bg-warning text-dark ms-2">{streamerId}</span>
                <small className="ms-2 text-muted">
                    (JSON 기반 비디오 관리)
                </small>
            </div>
        </div>
    </div>
);

// 🆕 Enhanced Queue 시스템 디버그 정보 서브 컴포넌트
const EnhancedQueueDebugInfo = ({ queueStatus, sessionInfo, detailedQueueInfo, queueDebugMode, setQueueDebugMode }) => {
    return (
        <div className="mt-3">
            {/* Queue Debug Mode 선택 버튼 */}
            <div className="mb-2 d-flex justify-content-between align-items-center">
                <h6 className="text-success mb-0">📋 Queue 시스템 상태</h6>
                <div className="btn-group btn-group-sm" role="group">
                    <button 
                        className={`btn ${queueDebugMode === 'overview' ? 'btn-success' : 'btn-outline-success'}`}
                        onClick={() => setQueueDebugMode('overview')}
                    >
                        개요
                    </button>
                    <button 
                        className={`btn ${queueDebugMode === 'detailed' ? 'btn-success' : 'btn-outline-success'}`}
                        onClick={() => setQueueDebugMode('detailed')}
                    >
                        상세
                    </button>
                    <button 
                        className={`btn ${queueDebugMode === 'minimized' ? 'btn-success' : 'btn-outline-success'}`}
                        onClick={() => setQueueDebugMode('minimized')}
                    >
                        최소화
                    </button>
                </div>
            </div>

            {/* Queue Debug 패널들 */}
            {queueDebugMode === 'overview' && (
                <QueueDebugInfoOverview 
                    queueStatus={queueStatus}
                    sessionInfo={sessionInfo}
                    detailedQueueInfo={detailedQueueInfo}
                />
            )}

            {queueDebugMode === 'detailed' && (
                <div>
                    <QueueFlowDebugPanel 
                        detailedQueueInfo={detailedQueueInfo}
                        queueStatus={queueStatus}
                        sessionInfo={sessionInfo}
                        isMinimized={false}
                    />
                    <RequestQueueDebugPanel 
                        detailedQueueInfo={detailedQueueInfo}
                        isMinimized={false}
                    />
                    <ResponseQueueDebugPanel 
                        detailedQueueInfo={detailedQueueInfo}
                        queueStatus={queueStatus}
                        isMinimized={false}
                    />
                </div>
            )}

            {queueDebugMode === 'minimized' && (
                <div>
                    <QueueFlowDebugPanel 
                        detailedQueueInfo={detailedQueueInfo}
                        queueStatus={queueStatus}
                        sessionInfo={sessionInfo}
                        isMinimized={true}
                    />
                    <RequestQueueDebugPanel 
                        detailedQueueInfo={detailedQueueInfo}
                        isMinimized={true}
                    />
                    <ResponseQueueDebugPanel 
                        detailedQueueInfo={detailedQueueInfo}
                        queueStatus={queueStatus}
                        isMinimized={true}
                    />
                </div>
            )}
        </div>
    );
};

// 기본 Queue 정보 개요 (기존 QueueDebugInfo 개선)
const QueueDebugInfoOverview = ({ queueStatus, sessionInfo, detailedQueueInfo }) => (
    <div className="p-2 bg-success bg-opacity-10 rounded">
        <div className="row g-1 small">
            {/* 세션 정보 */}
            <div className="col-12">
                <strong>세션 ID:</strong>
                <span className="ms-2 font-monospace" style={{ fontSize: '0.7rem' }}>
                    {sessionInfo?.session_id ? sessionInfo.session_id.substring(0, 12) + '...' : 'N/A'}
                </span>
            </div>
            
            {/* Queue 상태 */}
            <div className="col-6">
                <strong>Queue 길이:</strong>
                <span className={`badge ms-2 ${
                    (sessionInfo?.queue_length || 0) === 0 ? 'bg-secondary' :
                    (sessionInfo?.queue_length || 0) <= 2 ? 'bg-success' :
                    (sessionInfo?.queue_length || 0) <= 5 ? 'bg-warning' : 'bg-danger'
                }`}>
                    {sessionInfo?.queue_length || 0}
                </span>
            </div>
            
            <div className="col-6">
                <strong>처리 상태:</strong>
                <span className={`badge ms-2 ${
                    sessionInfo?.is_processing ? 'bg-primary' : 'bg-secondary'
                }`}>
                    {sessionInfo?.is_processing ? '처리 중' : '대기'}
                </span>
            </div>
            
            {/* 시퀀스 정보 */}
            <div className="col-6">
                <strong>현재 Seq:</strong>
                <span className="badge bg-info ms-2">{sessionInfo?.current_seq || 0}</span>
            </div>
            
            <div className="col-6">
                <strong>마지막 처리 Seq:</strong>
                <span className="badge bg-info ms-2">{queueStatus?.lastProcessedSeq || -1}</span>
            </div>
            
            {/* 성능 지표 (상세 정보가 있는 경우) */}
            {detailedQueueInfo?.metrics && (
                <>
                    <div className="col-6">
                        <strong>총 처리:</strong>
                        <span className="badge bg-success ms-2">{detailedQueueInfo.metrics.total_processed || 0}</span>
                    </div>
                    <div className="col-6">
                        <strong>취소됨:</strong>
                        <span className="badge bg-danger ms-2">{detailedQueueInfo.metrics.cancelled_requests || 0}</span>
                    </div>
                </>
            )}
            
            {/* 현재 처리 중인 요청 */}
            {(sessionInfo?.current_request || sessionInfo?.is_processing) && (
                <div className="col-12 mt-1">
                    <strong>처리 중:</strong>
                    <span className="ms-2 text-muted" style={{ fontSize: '0.8rem' }}>
                        "{sessionInfo?.current_request || '...'}"
                    </span>
                </div>
            )}
            
            {/* 업타임 */}
            <div className="col-12 mt-1">
                <strong>세션 업타임:</strong>
                <span className="ms-2 text-muted">
                    {sessionInfo?.uptime_ms ? `${(sessionInfo.uptime_ms / 1000).toFixed(1)}초` : 'N/A'}
                </span>
            </div>
            
            {/* 지터버퍼 정보 */}
            <div className="col-6">
                <strong>지터버퍼:</strong>
                <span className="badge bg-warning text-dark ms-2">300ms</span>
            </div>
            
            <div className="col-6">
                <strong>패킷 해시 캐시:</strong>
                <span className="badge bg-secondary ms-2">{sessionInfo?.recent_hashes_count || 0}/50</span>
            </div>
        </div>
    </div>
);

export default DebugPanel;