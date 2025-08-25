import React, { useState } from 'react';

/**
 * TTS 엔진 상태 확인 디버그 도구
 * 독립적으로 실행 가능한 진단 도구
 */
const TTSDebugTool = () => {
  const [debugLogs, setDebugLogs] = useState([]);
  const [isChecking, setIsChecking] = useState(false);
  const [testResults, setTestResults] = useState({});

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev, { 
      timestamp, 
      message, 
      type,
      id: Date.now() + Math.random()
    }]);
  };

  const clearLogs = () => {
    setDebugLogs([]);
    setTestResults({});
  };

  const checkEngineStatus = async () => {
    setIsChecking(true);
    clearLogs();

    try {
      const baseUrl = window.location.protocol + '//' + window.location.hostname + ':8000';
      
      addLog(`🔧 현재 페이지: ${window.location.href}`, 'info');
      addLog(`🔧 baseUrl: ${baseUrl}`, 'info');
      
      // 1. 기본 연결 테스트
      addLog('📡 Django 서버 연결 테스트 중...', 'info');
      
      try {
        const pingResponse = await fetch(`${baseUrl}/admin/`, { 
          method: 'HEAD',
          mode: 'no-cors' 
        });
        addLog(`✅ Django 서버 연결 성공`, 'success');
      } catch (error) {
        addLog(`❌ Django 서버 연결 실패: ${error.message}`, 'error');
        return;
      }

      // 2. TTS 상태 API 테스트
      addLog('📡 TTS 상태 API 호출 중...', 'info');
      
      const statusResponse = await fetch(`${baseUrl}/api/chat/ai/tts/status/`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      addLog(`📡 상태 API 응답: ${statusResponse.status} ${statusResponse.statusText}`, statusResponse.ok ? 'success' : 'error');
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        addLog(`📊 상태 데이터: ${JSON.stringify(statusData, null, 2)}`, 'info');
        
        setTestResults(statusData);
        
        // 엔진별 상태 분석
        if (statusData.engines) {
          Object.entries(statusData.engines).forEach(([engine, info]) => {
            const status = info.available ? '✅ 사용가능' : '❌ 사용불가';
            addLog(`🎤 ${engine}: ${status} - ${info.description}`, info.available ? 'success' : 'warning');
          });
        }
      } else {
        const errorText = await statusResponse.text().catch(() => 'Unknown error');
        addLog(`❌ 상태 API 오류: ${errorText}`, 'error');
      }

      // 3. 실제 TTS API 테스트
      if (testResults.engines) {
        for (const [engine, info] of Object.entries(testResults.engines)) {
          if (info.available) {
            addLog(`🧪 ${engine} TTS 실제 테스트 중...`, 'info');
            
            try {
              const token = localStorage.getItem('accessToken');
              const testResponse = await fetch(`${baseUrl}/api/chat/ai/tts/`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  text: 'test',
                  engine: engine,
                  voice: engine === 'openai' ? 'nova' : 'default',
                  speed: 1.0
                })
              });

              if (testResponse.ok) {
                const audioBlob = await testResponse.blob();
                addLog(`✅ ${engine} TTS 테스트 성공 (${audioBlob.size} bytes)`, 'success');
              } else {
                const errorData = await testResponse.json().catch(() => ({}));
                addLog(`❌ ${engine} TTS 테스트 실패: ${errorData.error || 'Unknown error'}`, 'error');
              }
            } catch (error) {
              addLog(`❌ ${engine} TTS 테스트 예외: ${error.message}`, 'error');
            }
          }
        }
      }

    } catch (error) {
      addLog(`💥 전체 테스트 실패: ${error.message}`, 'error');
    } finally {
      setIsChecking(false);
    }
  };

  // MeloTTS 상세 진단
  const checkMeloTTSDetails = async () => {
    addLog('🔍 MeloTTS 상세 진단 시작...', 'info');
    
    const baseUrl = window.location.protocol + '//' + window.location.hostname + ':8000';
    
    try {
      // Django 백엔드에서 MeloTTS 초기화 상태 확인
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${baseUrl}/api/chat/ai/tts/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: 'Hello MeloTTS test',
          engine: 'melotts',
          voice: 'default',
          speed: 1.0
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        addLog(`🔍 MeloTTS 오류 응답: ${JSON.stringify(errorData, null, 2)}`, 'error');
        
        // 백엔드 로그도 확인해보자
        addLog('💡 백엔드 Docker 로그 확인 방법:', 'info');
        addLog('docker-compose logs backend | grep -i melo', 'info');
      } else {
        addLog('✅ MeloTTS 정상 작동', 'success');
      }
    } catch (error) {
      addLog(`🔍 MeloTTS 진단 실패: ${error.message}`, 'error');
    }
  };

  const getLogColor = (type) => {
    switch (type) {
      case 'success': return 'text-success';
      case 'error': return 'text-danger';
      case 'warning': return 'text-warning';
      default: return 'text-info';
    }
  };

  return (
    <div className="container mt-4">
      <div className="card">
        <div className="card-header bg-dark text-white">
          <h4 className="mb-0">🔧 TTS 엔진 상태 진단 도구</h4>
        </div>
        <div className="card-body">
          <div className="mb-3">
            <button 
              className="btn btn-primary me-2"
              onClick={checkEngineStatus}
              disabled={isChecking}
            >
              {isChecking ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  진단 중...
                </>
              ) : (
                '🩺 전체 진단 실행'
              )}
            </button>
            
            <button 
              className="btn btn-warning me-2"
              onClick={checkMeloTTSDetails}
              disabled={isChecking}
            >
              🔍 MeloTTS 상세 진단
            </button>
            
            <button 
              className="btn btn-secondary"
              onClick={clearLogs}
            >
              🗑️ 로그 지우기
            </button>
          </div>

          {/* 테스트 결과 요약 */}
          {Object.keys(testResults).length > 0 && (
            <div className="alert alert-info mb-3">
              <h6>📊 테스트 결과 요약:</h6>
              <pre>{JSON.stringify(testResults, null, 2)}</pre>
            </div>
          )}

          {/* 디버그 로그 */}
          <div className="bg-dark text-light p-3 rounded" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <h6 className="text-warning">📋 디버그 로그:</h6>
            {debugLogs.length === 0 ? (
              <p className="text-muted">로그가 없습니다. 진단을 실행해보세요.</p>
            ) : (
              debugLogs.map(log => (
                <div key={log.id} className="mb-1">
                  <span className="text-muted">[{log.timestamp}]</span>{' '}
                  <span className={getLogColor(log.type)}>{log.message}</span>
                </div>
              ))
            )}
          </div>

          {/* 추가 정보 */}
          <div className="mt-3">
            <small className="text-muted">
              <strong>사용법:</strong><br/>
              1. "전체 진단 실행" - 모든 TTS 엔진 상태를 종합적으로 확인<br/>
              2. "MeloTTS 상세 진단" - MeloTTS 관련 문제를 상세히 분석<br/>
              3. Docker 백엔드 로그: <code>docker-compose logs backend</code>
            </small>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TTSDebugTool;