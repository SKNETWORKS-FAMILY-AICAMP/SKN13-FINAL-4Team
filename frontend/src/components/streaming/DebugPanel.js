import React, { useState } from 'react';
import { Button, Alert } from 'react-bootstrap';
import api from '../../utils/unifiedApiClient';


// TTS 모델명을 사용자 친화적으로 변환하는 함수
const formatTTSModel = (modelName) => {
    const modelMapping = {
        'eleven_multilingual_v2': 'Multilingual v2',
        'eleven_turbo_v2_5': 'Turbo v2.5',
        'eleven_turbo_v2': 'Turbo v2',
        'eleven_monolingual_v1': 'Monolingual v1',
        'eleven_multilingual_v1': 'Multilingual v1'
    };
    return modelMapping[modelName] || modelName;
};

// 음성 이름을 사용자 친화적으로 변환하는 함수
const formatVoiceName = (voiceName) => {
    const voiceMapping = {
        'aneunjin': '안은진',
        'kimtaeri': '김태리', 
        'kimminjeong': '김민정',
        'jinseonkyu': '진선규',
        'parkchangwook': '박창욱',
        'jiyoung': '지영'
    };
    return voiceMapping[voiceName] || voiceName;
};

const DebugPanel = ({ 
    debugInfo, 
    syncDebugInfo, 
    revealedSubtitle, 
    currentVideo, 
    videoTransitionRef, 
    showSubtitle, 
    streamerId, 
    isBroadcastingEnabled
}) => {
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

                {/* AI 모델 정보 */}
                <div className="col-12 mb-2">
                    <strong>🤖 AI 모델:</strong>
                    <span className="badge bg-success ms-2">
                        {debugInfo.aiModel || 'gpt-5-nano'}
                    </span>
                    <small className="ms-2 text-muted">
                        (Chat Completion)
                    </small>
                </div>

                {/* TTS 음성 모델 정보 */}
                <div className="col-12 mb-2">
                    <strong>🎤 음성 모델:</strong>
                    <div className="d-flex flex-wrap gap-1 mt-1">
                        {debugInfo.voiceModel && (
                            <span className="badge bg-info text-white" title={`원본: ${debugInfo.voiceModel}`}>
                                {formatTTSModel(debugInfo.voiceModel)}
                            </span>
                        )}
                        {debugInfo.voiceName && (
                            <span className="badge bg-secondary" title={`음성 ID: ${debugInfo.voiceName}`}>
                                {formatVoiceName(debugInfo.voiceName)}
                            </span>
                        )}
                        {!debugInfo.voiceModel && !debugInfo.voiceName && (
                            <span className="badge bg-secondary">
                                N/A
                            </span>
                        )}
                    </div>
                    <small className="text-muted">
                        {debugInfo.voiceModel && debugInfo.voiceName ? 
                            `${debugInfo.voiceModel} • ${debugInfo.voiceName}` : 
                            '모델 버전 및 음성 ID'
                        }
                    </small>
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
                
                {/* 오디오 재생 상태 */}
                <div className="col-6">
                    <strong>재생:</strong>
                    <span className={`badge ms-2 ${debugInfo.isPlaying ? 'bg-success' : 'bg-secondary'}`}>
                        {debugInfo.isPlaying ? '▶️ 재생중' : '⏸️ 정지'}
                    </span>
                </div>
                
                {/* 오디오 진행률 */}
                <div className="col-6">
                    <strong>오디오:</strong>
                    <span className="badge bg-info ms-2">
                        {debugInfo.currentTime ? debugInfo.currentTime.toFixed(1) : 0}s / {debugInfo.audioDuration ? debugInfo.audioDuration.toFixed(1) : 0}s
                    </span>
                </div>
                
                {/* 텍스트 진행률 */}
                <div className="col-6">
                    <strong>텍스트:</strong>
                    <span className="badge bg-warning text-dark ms-2">
                        {debugInfo.textProgress ? Math.round(debugInfo.textProgress) : 0}%
                    </span>
                    <small className="ms-2">
                        ({debugInfo.revealedChars || 0} / {debugInfo.totalChars || 0})
                    </small>
                </div>
            </div>


            {/* 자막 표시 */}
            {showSubtitle && revealedSubtitle && (
                <div className="mt-3 p-2 bg-info bg-opacity-10 rounded">
                    <h6 className="text-info mb-2">💬 현재 자막</h6>
                    <div className="small text-dark bg-white p-2 rounded border">
                        "{revealedSubtitle}"
                    </div>
                </div>
            )}

            {/* 비디오 정보 */}
            <VideoDebugInfo 
                currentVideo={currentVideo} 
                videoTransitionRef={videoTransitionRef} 
                showSubtitle={showSubtitle} 
            />

            {/* Broadcasting 정보 */}
            {isBroadcastingEnabled && (
                <BroadcastingDebugInfo 
                    syncDebugInfo={syncDebugInfo}
                    streamerId={streamerId}
                />
            )}

            {/* 개발자 도구 */}
            <DevToolsPanel />

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


// 개발자 도구 패널
const DevToolsPanel = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const addDevCredits = async (amount) => {
        if (isLoading) return;
        
        setIsLoading(true);
        setMessage(null);

        try {
            const response = await api.post('/api/users/dev/add-credits/', {
                amount: amount
            });

            setMessage({
                type: 'success',
                text: `🎉 ${amount.toLocaleString()} 크레딧이 추가되었습니다! (잔액: ${response.data.balance?.toLocaleString()} C)`
            });

            // 3초 후 메시지 자동 제거
            setTimeout(() => setMessage(null), 3000);
            
        } catch (error) {
            console.error('개발용 크레딧 추가 실패:', error);
            setMessage({
                type: 'error',
                text: `❌ 크레딧 추가 실패: ${error.response?.data?.error || '서버 오류'}`
            });
            
            // 5초 후 에러 메시지 자동 제거
            setTimeout(() => setMessage(null), 5000);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="mt-3 p-2 bg-danger bg-opacity-10 rounded border border-danger">
            <h6 className="text-danger mb-2">🔧 개발자 도구</h6>
            
            {message && (
                <Alert variant={message.type === 'success' ? 'success' : 'danger'} className="p-2 small mb-3">
                    {message.text}
                </Alert>
            )}
            
            <div className="row g-1">
                <div className="col-12">
                    <small className="text-muted">테스트용 크레딧 추가 (개발 환경 전용)</small>
                </div>
                <div className="col-6 col-md-3">
                    <Button 
                        variant="outline-danger" 
                        size="sm" 
                        className="w-100"
                        disabled={isLoading}
                        onClick={() => addDevCredits(10000)}
                    >
                        +10K
                    </Button>
                </div>
                <div className="col-6 col-md-3">
                    <Button 
                        variant="outline-danger" 
                        size="sm" 
                        className="w-100"
                        disabled={isLoading}
                        onClick={() => addDevCredits(50000)}
                    >
                        +50K
                    </Button>
                </div>
                <div className="col-6 col-md-3">
                    <Button 
                        variant="outline-danger" 
                        size="sm" 
                        className="w-100"
                        disabled={isLoading}
                        onClick={() => addDevCredits(100000)}
                    >
                        +100K
                    </Button>
                </div>
                <div className="col-6 col-md-3">
                    <Button 
                        variant="outline-danger" 
                        size="sm" 
                        className="w-100"
                        disabled={isLoading}
                        onClick={() => addDevCredits(1000000)}
                    >
                        +1M
                    </Button>
                </div>
            </div>
            
            {isLoading && (
                <div className="mt-2 text-center">
                    <small className="text-muted">
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        크레딧 추가 중...
                    </small>
                </div>
            )}
        </div>
    );
};

export default DebugPanel;