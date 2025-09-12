import React from 'react';
import panelStyles from './Panels.module.css';
import { Button } from 'react-bootstrap';
import DebugPanel from './DebugPanel';

const SettingsPanel = ({
    // 패널 표시 상태
    showDebug,
    setShowDebug,
    
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
    if (!showDebug) {
        return null;
    }

    const handleCloseAll = () => {
        setShowDebug(false);
    };

    return (
        <div className={panelStyles.overlay}>
            <div className={panelStyles.floating}>
                {/* 헤더 */}
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="mb-0">🔧 디버그 패널</h5>
                    <Button 
                        variant="outline-secondary" 
                        size="sm" 
                        onClick={handleCloseAll}
                        title="패널 닫기"
                    >
                        ✕
                    </Button>
                </div>
                
                {/* 디버그 콘텐츠 */}
                <div className="debug-content">
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
                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;