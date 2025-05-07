import { API_PATHS, getApiUrl } from '@/app/config';
import { NextResponse } from 'next/server';

// 시스템 프롬프트 생성 함수
const getSystemPrompt = () => {
  // 오늘 날짜를 YYYY/MM/DD 형식으로 생성
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const formattedDate = `${year}/${month}/${day}`;

  const koreanDate = today.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `당신은 Omni Secretary라는 이메일 비서입니다.
현재 날짜는 ${koreanDate} (${formattedDate})입니다.
사용자가 오늘 받은 메일이나 최근 메일에 대해 물어보면 "after:${formattedDate}" 검색 쿼리를 활용해 적절히 응답해주세요.

마크다운 형식을 사용하지 말고 일반 텍스트로 응답하세요.
숫자는 강조 표시(**) 없이 그냥 숫자만 사용하세요.
응답은 간결하게 작성하세요.`;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, api_key, stream = true, messageHistory = [], systemPrompt = null } = body;

    if (!text) {
      return NextResponse.json({ error: '텍스트가 제공되지 않았습니다.' }, { status: 400 });
    }

    if (!api_key) {
      return NextResponse.json({ error: 'API 키가 제공되지 않았습니다.' }, { status: 400 });
    }

    // 스트리밍 응답을 위한 엔드포인트 선택
    const endpointPath = stream ? API_PATHS.agent_stream : API_PATHS.agent;
    const apiUrl = getApiUrl(endpointPath);

    // 서버 측에서 생성한 시스템 프롬프트 사용
    const serverSystemPrompt = getSystemPrompt();

    // 클라이언트에서 전달된 프롬프트가 있으면 사용, 없으면 서버에서 생성한 프롬프트 사용
    const finalSystemPrompt = systemPrompt || serverSystemPrompt;

    // 시스템 프롬프트가 있으면 메시지 기록 앞에 추가
    const fullMessageHistory = [...messageHistory];
    if (finalSystemPrompt) {
      fullMessageHistory.unshift({
        role: 'system',
        content: finalSystemPrompt,
      });
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        text,
        api_key,
        stream,
        messageHistory: fullMessageHistory,
      }),
    });

    // 스트리밍 응답을 그대로 전달
    if (stream) {
      const responseBody = response.body;
      if (!responseBody) {
        throw new Error('응답 본문이 없습니다.');
      }

      return new NextResponse(responseBody, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // 일반 JSON 응답 처리
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('에이전트 API 오류:', error);
    return NextResponse.json({ error: '서버 내부 오류가 발생했습니다.' }, { status: 500 });
  }
}
