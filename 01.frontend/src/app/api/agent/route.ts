import { API_PATHS, getApiUrl } from '@/app/config';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, api_key, stream = true } = body;

    if (!text) {
      return NextResponse.json({ error: '텍스트가 제공되지 않았습니다.' }, { status: 400 });
    }

    if (!api_key) {
      return NextResponse.json({ error: 'API 키가 제공되지 않았습니다.' }, { status: 400 });
    }

    const apiUrl = getApiUrl(API_PATHS.agent);
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
