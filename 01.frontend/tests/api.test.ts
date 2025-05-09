import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAgentResponse, processStreamResponse } from '../src/services/api';

// 전역 fetch 모킹
const originalFetch = global.fetch;

describe('API 호출 테스트', () => {
  // 테스트 전에 fetch를 모킹 함수로 대체
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  // 테스트 후 원래 fetch 복원
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('fetchAgentResponse가 올바른 파라미터로 호출되는지 테스트', async () => {
    // Mock 응답 설정
    const mockResponse = {
      ok: true,
      headers: {
        get: vi.fn().mockReturnValue('text/event-stream'),
      },
      body: {
        getReader: vi.fn().mockReturnValue({
          read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
        }),
      },
    };

    // fetch 모킹
    (global.fetch as any).mockResolvedValue(mockResponse);

    // 테스트할 파라미터
    const text = 'test query';
    const apiKey = 'test-api-key';
    const messageHistory = [
      { role: 'user' as const, content: '이전 메시지' },
      { role: 'assistant' as const, content: '이전 응답' },
    ];

    // API 호출
    await fetchAgentResponse(text, apiKey, messageHistory);

    // fetch가 올바른 URL과 메서드로 호출되었는지 확인
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/agent',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );

    // fetch가 올바른 body로 호출되었는지 확인
    const fetchCall = (global.fetch as any).mock.calls[0];
    const requestBody = JSON.parse(fetchCall[1].body);
    expect(requestBody).toEqual({
      text,
      api_key: apiKey,
      stream: true,
      messageHistory,
    });
  });

  it('processStreamResponse가 스트리밍 데이터를 올바르게 처리하는지 테스트', async () => {
    // 스트림 응답을 시뮬레이션하기 위한 모의 데이터
    const encoder = new TextEncoder();
    const mockChunk1 = encoder.encode('data: {"content": "안녕"}\n\n');
    const mockChunk2 = encoder.encode('data: {"content": "하세요"}\n\n');

    let readCallCount = 0;
    const mockReader = {
      read: vi.fn().mockImplementation(() => {
        readCallCount++;
        if (readCallCount === 1) {
          return Promise.resolve({ done: false, value: mockChunk1 });
        } else if (readCallCount === 2) {
          return Promise.resolve({ done: false, value: mockChunk2 });
        } else {
          return Promise.resolve({ done: true, value: undefined });
        }
      }),
    };

    const mockResponse = {
      headers: {
        get: vi.fn().mockReturnValue('text/event-stream'),
      },
      body: {
        getReader: vi.fn().mockReturnValue(mockReader),
      },
    };

    // 콜백 모킹
    const onChunk = vi.fn();

    // 스트림 처리 함수 호출
    await processStreamResponse(mockResponse as unknown as Response, onChunk);

    // onChunk가 올바르게 호출되었는지 확인
    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenNthCalledWith(1, '안녕', '안녕');
    expect(onChunk).toHaveBeenNthCalledWith(2, '하세요', '안녕하세요');
  });

  it('API 에러 처리가 올바르게 되는지 테스트', async () => {
    // 에러 응답 모킹
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    // API 호출이 에러를 던지는지 확인
    await expect(fetchAgentResponse('query', 'api-key')).rejects.toThrow('API 응답 오류');
  });
});
