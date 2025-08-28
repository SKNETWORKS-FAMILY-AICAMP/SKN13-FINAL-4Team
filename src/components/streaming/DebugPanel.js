import React from 'react';

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

            {/* Voice Settings (ElevenLabs) */}
            {debugInfo.voiceSettings && Object.keys(debugInfo.voiceSettings).length > 0 && (
                <ElevenLabsDebugInfo voiceSettings={debugInfo.voiceSettings} />
            )}

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

// ElevenLabs 음성 설정 디버그 정보
const ElevenLabsDebugInfo = ({ voiceSettings }) => (
    <div className="mt-3 p-2 bg-primary bg-opacity-10 rounded">
        <h6 className="text-primary mb-2">🎙️ ElevenLabs 설정</h6>
        <div className="row g-1 small">
            {voiceSettings.elevenLabsVoice && (
                <div className="col-12">
                    <strong>음성:</strong>
                    <span className="badge bg-primary ms-2">{getVoiceName(voiceSettings.elevenLabsVoice)}</span>
                </div>
            )}
            
            {voiceSettings.elevenLabsModel && (
                <div className="col-12">
                    <strong>모델:</strong>
                    <span className="badge bg-info ms-2">{getModelDescription(voiceSettings.elevenLabsModel)}</span>
                </div>
            )}
            
            <div className="col-6">
                <strong>안정성:</strong>
                <span className="badge bg-success ms-2">{voiceSettings.elevenLabsStability}</span>
            </div>
            <div className="col-6">
                <strong>유사성:</strong>
                <span className="badge bg-warning text-dark ms-2">{voiceSettings.elevenLabsSimilarity}</span>
            </div>
            <div className="col-6">
                <strong>스타일:</strong>
                <span className="badge bg-secondary ms-2">{voiceSettings.elevenLabsStyle || 0}</span>
            </div>
            <div className="col-6">
                <strong>Speaker Boost:</strong>
                <span className={`badge ms-2 ${voiceSettings.elevenLabsSpeakerBoost ? 'bg-success' : 'bg-secondary'}`}>
                    {voiceSettings.elevenLabsSpeakerBoost ? 'ON' : 'OFF'}
                </span>
            </div>
        </div>
    </div>
);

export default DebugPanel;