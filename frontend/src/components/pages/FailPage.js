import React from 'react';
import { useSearchParams } from "react-router-dom";

export function FailPage() {
  const [searchParams] = useSearchParams();

  return (
    <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
      <h1>결제 실패</h1>
      <p>{`에러 코드: ${searchParams.get("code")}`}</p>
      <p>{`실패 사유: ${searchParams.get("message")}`}</p>
      <p>문제가 지속되면 고객센터로 문의해주세요.</p>
    </div>
  );
}

export default FailPage;
