import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChat } from '../src/hooks/useChat';
import { useEmailScan } from '../src/hooks/useEmailScan';
import * as apiService from '../src/services/api';

// API 서비스 함수 모킹
vi.mock('../src/services/api', () => ({
  fetchAgentResponse: vi.fn(),
  processStreamResponse: vi.fn(),
}));

// 스토리지 모킹
const mockSessionStorage: Record<string, string> = {};
Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: vi.fn((key: string) => mockSessionStorage[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      mockSessionStorage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete mockSessionStorage[key];
    }),
  },
  writable: true,
});

describe('useChat 훅 테스트', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockSessionStorage).forEach((key) => delete mockSessionStorage[key]);
  });

  it('초기 상태가 올바르게 설정되는지 확인', () => {
    const initialMessages = [
      {
        id: 'test',
        role: 'assistant' as const,
        content: '안녕하세요',
        timestamp: new Date(),
      },
    ];

    const { result } = renderHook(() => useChat({ initialMessages, apiKey: 'test-key' }));

    expect(result.current.messages).toEqual(initialMessages);
    expect(result.current.isProcessing).toBe(false);
  });

  it('sendMessage 함수가 올바르게 작동하는지 확인', async () => {
    // 스트리밍 응답 모킹
    const mockResponse = { ok: true };
    (apiService.fetchAgentResponse as any).mockResolvedValue(mockResponse);

    // processStreamResponse가 콜백 함수를 호출하도록 모킹
    (apiService.processStreamResponse as any).mockImplementation((response: any, onChunk: any) => {
      onChunk('테스트 응답', '테스트 응답');
      return Promise.resolve();
    });

    const { result } = renderHook(() => useChat({ initialMessages: [], apiKey: 'test-key' }));

    // 메시지 전송 액션
    act(() => {
      result.current.sendMessage('테스트 메시지');
    });

    // 상태 업데이트 대기
    await waitFor(() => {
      expect(result.current.messages.length).toBe(2);
    });

    // 사용자 메시지가 추가되었는지 확인
    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[0].content).toBe('테스트 메시지');

    // 응답 메시지가 추가되었는지 확인
    expect(result.current.messages[1].role).toBe('assistant');
    expect(result.current.messages[1].content).toContain('테스트 응답');

    // API 호출이 올바르게 이루어졌는지 확인
    expect(apiService.fetchAgentResponse).toHaveBeenCalledWith('테스트 메시지', 'test-key', []);
  });

  it('resetConversation 함수가 올바르게 작동하는지 확인', () => {
    // 세션 스토리지에 메시지 저장
    mockSessionStorage['omni_secretary_messages'] = JSON.stringify([
      { id: '1', role: 'user', content: '테스트', timestamp: new Date().toISOString() },
    ]);

    const { result } = renderHook(() => useChat({ initialMessages: [], apiKey: 'test-key' }));

    // 대화 초기화 액션
    act(() => {
      result.current.resetConversation();
    });

    // 메시지가 비워졌는지 확인
    expect(result.current.messages).toEqual([]);

    // 세션 스토리지에서 메시지가 삭제되었는지 확인
    expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('omni_secretary_messages');
  });
});

describe('useEmailScan 훅 테스트', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockSessionStorage).forEach((key) => delete mockSessionStorage[key]);
  });

  it('startAutoScan 함수가 올바르게 작동하는지 확인', async () => {
    // API 응답 모킹
    const mockResponse = { ok: true };
    (apiService.fetchAgentResponse as any).mockResolvedValue(mockResponse);

    // 스트리밍 처리 모킹
    (apiService.processStreamResponse as any).mockImplementation((response: any, onChunk: any) => {
      onChunk('이메일 스캔 결과', '이메일 스캔 결과');
      return Promise.resolve();
    });

    // 메시지 설정 콜백 함수 모킹
    const setMessagesMock = vi.fn();

    const { result } = renderHook(() =>
      useEmailScan({ apiKey: 'test-key', setMessages: setMessagesMock })
    );

    // 초기 상태 확인
    expect(result.current.autoScanComplete).toBe(false);
    expect(result.current.isProcessing).toBe(false);

    // 스캔 시작 액션
    act(() => {
      result.current.startAutoScan();
    });

    // 상태 업데이트 대기
    await waitFor(() => {
      expect(result.current.autoScanComplete).toBe(true);
    });

    // API 호출 확인
    expect(apiService.fetchAgentResponse).toHaveBeenCalled();

    // 메시지 설정 함수가 호출되었는지 확인
    expect(setMessagesMock).toHaveBeenCalled();
  });

  it('simulateDemoScan 함수가 올바르게 작동하는지 확인', async () => {
    // 타이머 모킹
    vi.useFakeTimers();

    // 메시지 설정 콜백 함수 모킹
    const setMessagesMock = vi.fn();

    const { result } = renderHook(() => useEmailScan({ apiKey: '', setMessages: setMessagesMock }));

    // 데모 스캔 시작
    act(() => {
      result.current.simulateDemoScan();
    });

    // 처리 중 상태 확인
    expect(result.current.isProcessing).toBe(true);

    // 타이머 진행
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // 메시지 설정 함수가 호출되었는지 확인
    expect(setMessagesMock).toHaveBeenCalled();

    // 스캔 완료 상태 확인
    expect(result.current.autoScanComplete).toBe(true);
    expect(result.current.isProcessing).toBe(false);

    // 실제 타이머 복원
    vi.useRealTimers();
  });

  it('resetScanStatus 함수가 올바르게 작동하는지 확인', () => {
    // 세션 스토리지에 스캔 완료 상태 저장
    mockSessionStorage['auto_scan_complete'] = 'true';

    const { result } = renderHook(() => useEmailScan({ apiKey: 'test-key', setMessages: vi.fn() }));

    // 초기 상태 - 이미 완료로 설정
    expect(result.current.autoScanComplete).toBe(true);

    // 스캔 상태 초기화
    act(() => {
      result.current.resetScanStatus();
    });

    // 상태가 초기화되었는지 확인
    expect(result.current.autoScanComplete).toBe(false);
  });
});
