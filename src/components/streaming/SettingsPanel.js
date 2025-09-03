import React from 'react';
import panelStyles from './Panels.module.css';
import { Button } from 'react-bootstrap';
import DebugPanel from './DebugPanel';
import TTSConfigManager from '../tts/TTSConfigManager';

const SettingsPanel = ({
    // 패널 표시 상태
    showDebug,
    showSettingsManager,
    setShowDebug,
    setShowSettingsManager,
    
    // 디버그 정보
    debugInfo,
    syncDebugInfo,
    revealedSubtitle,
    currentVideo,
    videoTransitionRef,
    showSubtitle,
    streamerId,
    isBroadcastingEnabled,
    
    // 사용자 정보
    isLoggedIn,
    username
}) => {
    // 패널이 하나도 활성화되지 않은 경우 null 반환
    if (!showDebug && !showSettingsManager) {
        return null;
    }

    const handleTabSwitch = (targetTab) => {
        // 모든 탭을 먼저 비활성화
        setShowDebug(false);
        setShowSettingsManager(false);
        
        // 타겟 탭만 활성화
        switch(targetTab) {
            case 'debug':
                setShowDebug(true);
                break;
            case 'settings':
                setShowSettingsManager(true);
                break;
            default:
                // 알 수 없는 탭인 경우 아무것도 하지 않음
                break;
        }
    };

    const handleCloseAll = () => {
        setShowDebug(false);
        setShowSettingsManager(false);
    };

    return (
        <div className={panelStyles.overlay}>
            <div className={panelStyles.floating}>
                {/* 탭 헤더 */}
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <div className="d-flex gap-2">
                        <Button 
                            variant={showDebug ? "info" : "outline-info"}
                            size="sm" 
                            onClick={() => handleTabSwitch('debug')}
                        >
                            🔧 디버그
                        </Button>
                        <Button 
                            variant={showSettingsManager ? "warning" : "outline-warning"}
                            size="sm" 
                            onClick={() => handleTabSwitch('settings')}
                        >
                            ⚙️ TTS 설정
                        </Button>
                    </div>
                    <Button 
                        variant="outline-secondary" 
                        size="sm" 
                        onClick={handleCloseAll}
                        title="패널 닫기"
                    >
                        ✕
                    </Button>
                </div>
                
                {/* 탭 콘텐츠 */}
                <div className="settings-content">
                    {/* 디버그 패널 */}
                    {showDebug && (
                        <DebugPanel 
                            debugInfo={debugInfo}
                            syncDebugInfo={syncDebugInfo}
                            revealedSubtitle={revealedSubtitle}
                            currentVideo={currentVideo}
                            videoTransitionRef={videoTransitionRef}
                            showSubtitle={showSubtitle}
                            streamerId={streamerId}
                            isBroadcastingEnabled={isBroadcastingEnabled}
                        />
                    )}
                    
                    {/* TTS 설정 관리 패널 */}
                    {showSettingsManager && (
                        <div className="settings-manager-content">
                            <TTSConfigManager 
                                streamerId={streamerId}
                                isLoggedIn={isLoggedIn}
                                username={username}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;