/*
[2025-07-31: Lee] 본 화면은 임시 홈 화면입니다.
이 화면은 나중에 API로부터 방송 데이터를 받아와서 동적으로 렌더링할 예정입니다.
현재는 가상의 방송 데이터 본 코드에서 직접 생성하여 사용하고 있습니다.

Features:
* 
*/


import React from 'react';
import { Link } from 'react-router-dom'; // Link 임포트
import './HomeTemporary.css';

// 가상의 방송 데이터 (나중에는 API로부터 받아와야 합니다)
const broadcasts = [
  {
    id: 1,
    isLive: true,
    thumbnailUrl: 'https://via.placeholder.com/400x225.png?text=LIVE+Stream+1',
    streamerName: '잼민이',
    streamTitle: '리액트 초보 탈출기 1일차',
    viewerCount: 1234,
    duration: '01:23:45',
    streamerId: 'jammin-i' // 스트리밍 페이지로 이동할 ID
  },
  {
    id: 2,
    isLive: false,
    thumbnailUrl: 'https://via.placeholder.com/400x225.png?text=Stream+2+OFF',
    streamerName: '재범님',
    streamTitle: '파이널 프로젝트 코딩', // 이 제목은 보이지 않음
    viewerCount: 0,
    nextBroadcastTime: '내일 오후 8시 방송 예정',
  },
  {
    id: 3,
    isLive: true,
    thumbnailUrl: 'https://via.placeholder.com/400x225.png?text=LIVE+Stream+3',
    streamerName: '고양이',
    streamTitle: '낮잠 자기 좋은 날씨',
    viewerCount: 5678,
    duration: '03:45:12',
  },
  {
    id: 4,
    isLive: false,
    thumbnailUrl: 'https://via.placeholder.com/400x225.png?text=Stream+4+OFF',
    streamerName: '강아지',
    streamTitle: '산책 방송', // 이 제목은 보이지 않음
    viewerCount: 0,
    nextBroadcastTime: '오늘 오후 10시 방송 예정',
  },
];

const HomeTemporary = () => {
  return (
    <div className="home-temporary-container">
      <h2>스트리밍 목록</h2>
      <div className="broadcast-list">
        {broadcasts.map((broadcast) => {
          const cardContent = (
            <div className="broadcast-card">
              <div className="thumbnail-container">
                <img src={broadcast.thumbnailUrl} alt={`${broadcast.streamerName}의 방송 썸네일`} />
                <div className={`status-badge ${broadcast.isLive ? 'live' : 'off'}`}>
                  {broadcast.isLive ? 'LIVE' : 'OFF'}
                </div>
              </div>
              <div className="info-container">
                <p className="streamer-name">{broadcast.streamerName}</p>
                {broadcast.isLive && (
                  <p className="stream-title">{broadcast.streamTitle}</p>
                )}
                <div className="bottom-info">
                  {broadcast.isLive && (
                      <p className="viewer-count">시청자 {broadcast.viewerCount.toLocaleString()}명</p>
                  )}
                  <p className="time-info">
                    {broadcast.isLive ? broadcast.duration : broadcast.nextBroadcastTime}
                  </p>
                </div>
              </div>
            </div>
          );

          // "잼민이" 방송에만 링크를 적용합니다.
          if (broadcast.streamerName === '잼민이') {
            return (
              <Link to={`/stream/${broadcast.streamerId}`} key={broadcast.id} className="broadcast-card-link">
                {cardContent}
              </Link>
            );
          }
          
          return <div key={broadcast.id}>{cardContent}</div>;
        })}
      </div>
    </div>
  );
};

export default HomeTemporary;
