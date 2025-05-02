import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChatUI from '../ChatUI';

// 모의 함수들
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// 로컬 스토리지 모킹
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// fetch 모킹
global.fetch = vi.fn();

describe('ChatUI 컴포넌트', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorageMock.clear();

    // ReadableStream 모킹
    const mockReader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data:{"content":"안녕하세요"}'),
        })
        .mockResolvedValueOnce({
          done: true,
          value: undefined,
        }),
    };

    const mockBody = {
      getReader: () => mockReader,
    };

    // 성공적인 API 응답 모킹
    (global.fetch as any).mockResolvedValue({
      ok: true,
      headers: {
        get: () => 'text/event-stream',
      },
      body: mockBody,
    });
  });

  it('초기 상태에서는 컴포넌트가 렌더링되지 않아야 함', () => {
    // Arrange
    render(<ChatUI />);

    // Assert
    expect(screen.queryByText('Omni Secretary')).toBeNull();
  });

  it('API 키가 있을 때 컴포넌트가 렌더링되어야 함', () => {
    // Arrange
    localStorageMock.setItem('api_key', 'test_api_key');

    // Act
    const customEvent = new CustomEvent('api-key-success', {
      detail: { apiKey: 'test_api_key' },
    });
    window.dispatchEvent(customEvent);

    render(<ChatUI />);

    // Assert
    expect(screen.getByText('Omni Secretary')).toBeInTheDocument();
  });

  it('메시지를 보낼 수 있어야 함', async () => {
    // Arrange
    localStorageMock.setItem('api_key', 'test_api_key');
    const user = userEvent.setup();

    // Act
    const customEvent = new CustomEvent('api-key-success', {
      detail: { apiKey: 'test_api_key' },
    });
    window.dispatchEvent(customEvent);

    render(<ChatUI />);

    // 채팅 입력
    const inputElement = screen.getByPlaceholderText('메시지를 입력하세요...');
    await user.type(inputElement, '안녕하세요');

    // 전송 버튼 클릭
    const sendButton = screen.getByLabelText('메시지 보내기');
    await user.click(sendButton);

    // Assert
    await waitFor(() => {
      // 사용자 메시지가 UI에 표시되는지 확인
      expect(screen.getByText('안녕하세요')).toBeInTheDocument();

      // API가 호출되었는지 확인
      expect(global.fetch).toHaveBeenCalledWith('/api/agent', expect.any(Object));
    });
  });

  it('제안된 프롬프트를 클릭하면 입력 필드에 설정되어야 함', async () => {
    // Arrange
    localStorageMock.setItem('api_key', 'test_api_key');
    const user = userEvent.setup();

    // Act
    const customEvent = new CustomEvent('api-key-success', {
      detail: { apiKey: 'test_api_key' },
    });
    window.dispatchEvent(customEvent);

    render(<ChatUI />);

    // 제안된 프롬프트 클릭
    const promptButton = screen.getByText('지난 달 구독 메일을 요약해줘');
    await user.click(promptButton);

    // Assert
    const inputElement = screen.getByPlaceholderText(
      '메시지를 입력하세요...'
    ) as HTMLTextAreaElement;
    expect(inputElement.value).toBe('지난 달 구독 메일을 요약해줘');
  });

  it('창 확대/축소 기능이 작동해야 함', async () => {
    // Arrange
    localStorageMock.setItem('api_key', 'test_api_key');
    const user = userEvent.setup();

    // Act
    const customEvent = new CustomEvent('api-key-success', {
      detail: { apiKey: 'test_api_key' },
    });
    window.dispatchEvent(customEvent);

    render(<ChatUI />);

    const chatContainer = document.querySelector('.fixed.z-40');
    expect(chatContainer).toHaveClass('bottom-4 right-4');

    // 확대 버튼 클릭
    const maximizeButton = screen.getByLabelText('창 확대');
    await user.click(maximizeButton);

    // Assert - 확대된 상태 확인
    await waitFor(() => {
      expect(chatContainer).toHaveClass('inset-4');
    });

    // 축소 버튼 클릭
    const minimizeButton = screen.getByLabelText('창 축소');
    await user.click(minimizeButton);

    // 축소된 상태 확인
    await waitFor(() => {
      expect(chatContainer).toHaveClass('bottom-4 right-4');
    });
  });

  it('닫기 버튼을 클릭하면 챗 UI가 닫혀야 함', async () => {
    // Arrange
    localStorageMock.setItem('api_key', 'test_api_key');
    const user = userEvent.setup();

    // Act
    const customEvent = new CustomEvent('api-key-success', {
      detail: { apiKey: 'test_api_key' },
    });
    window.dispatchEvent(customEvent);

    render(<ChatUI />);

    // 닫기 버튼 클릭
    const closeButton = screen.getByLabelText('닫기');
    await user.click(closeButton);

    // Assert
    expect(screen.queryByText('Omni Secretary')).toBeNull();
  });
});
