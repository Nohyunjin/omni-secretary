type MessageHistory = {
  role: 'user' | 'assistant';
  content: string;
}[];

// AI 응답 요청 함수
export const fetchAgentResponse = async (
  text: string,
  apiKey: string,
  messageHistory: MessageHistory = []
) => {
  const response = await fetch('/api/agent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      api_key: apiKey,
      stream: true,
      messageHistory,
    }),
  });

  if (!response.ok) {
    throw new Error('API 응답 오류');
  }

  return response;
};

// 스트리밍 응답 처리
export const processStreamResponse = async (
  response: Response,
  onChunk: (content: string, fullContent: string) => void
) => {
  if (!response.headers.get('Content-Type')?.includes('text/event-stream')) {
    // 일반 JSON 응답 처리
    const data = await response.json();
    onChunk(data.content || '응답을 받지 못했습니다.', data.content || '응답을 받지 못했습니다.');
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('응답 본문을 읽을 수 없습니다.');

  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // 디코딩 및 파싱
    const text = new TextDecoder().decode(value);
    const lines = text.split('\n');

    let content = '';
    for (const line of lines) {
      if (line.startsWith('data:')) {
        try {
          const data = JSON.parse(line.substring(5));
          if (data.content) {
            content += data.content;
            fullContent += data.content;
          }
        } catch (e) {
          // 파싱 오류 무시
        }
      }
    }

    if (content) {
      onChunk(content, fullContent);
    }
  }
};
