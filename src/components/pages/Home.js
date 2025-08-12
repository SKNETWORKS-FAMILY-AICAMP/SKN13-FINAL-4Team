// frontend/src/components/Home.js

import React from 'react';

function Home() {
  return (
    <div>
      {/* Jumbotron 스타일의 Hero 섹션 */}
      <div className="p-5 mb-4 mt-4 bg-light rounded-3">
        <div className="container-fluid py-5">
          <h1 className="display-5 fw-bold">실시간 채팅에 참여하세요!</h1>
          <p className="col-md-8 fs-4">
            Django Channels와 React로 구현된 실시간 채팅 애플리케이션입니다. 
            아래 버튼을 눌러 지금 바로 대화를 시작해보세요.
          </p>
          <a className="btn btn-primary btn-lg" href="/chat/lobby" role="button">
            채팅방 입장하기
          </a>
        </div>
      </div>

      {/* 카드 형태의 피처 섹션 */}
      <div className="row align-items-md-stretch">
        <div className="col-md-6 mb-4">
          <div className="h-100 p-5 text-bg-dark rounded-3">
            <h2>실시간 통신</h2>
            <p>WebSocket을 사용하여 사용자와 서버 간의 지연 없는 양방향 통신을 구현했습니다. 메시지가 즉시 전달되는 것을 경험해보세요.</p>
            <button className="btn btn-outline-light" type="button">자세히 보기</button>
          </div>
        </div>
        <div className="col-md-6 mb-4">
          <div className="h-100 p-5 bg-light border rounded-3">
            <h2>최신 기술 스택</h2>
            <p>백엔드는 Django & Channels, 프론트엔드는 React, 그리고 전체 환경은 Docker로 구성되어 확장성과 이식성을 높였습니다.</p>
            <button className="btn btn-outline-secondary" type="button">자세히 보기</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;