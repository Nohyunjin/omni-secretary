import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChatUI from '../../../src/components/chat/ChatUI';

// 모의 함수들
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// process 객체 모킹 - 테스트 환경 시뮬레이션
vi.mock('process', () => ({
  env: {
    NODE_ENV: 'test',
  },
}));

// 로컬 스토리지 및 세션 스토리지 모킹
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

// 윈도우 객체의 이벤트 디스패치 모킹
const dispatchEventMock = vi.fn();
const addEventListenerMock = vi.fn();
const removeEventListenerMock = vi.fn();

// fetch 함수 모킹
global.fetch = vi.fn();

describe('ChatUI 컴포넌트', () => {
  let eventHandlers: Record<string, EventListenerOrEventListenerObject[]> = {};

  const mockDispatchEvent = vi.fn();
  const mockAddEventListener = vi.fn(
    (event: string, handler: EventListenerOrEventListenerObject) => {
      if (!eventHandlers[event]) {
        eventHandlers[event] = [];
      }
      eventHandlers[event].push(handler);
    }
  );
  const mockRemoveEventListener = vi.fn();

  // fetch 함수 모킹
  global.fetch = vi.fn();

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
    Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });
    window.dispatchEvent = mockDispatchEvent;
    window.addEventListener = mockAddEventListener;
    window.removeEventListener = mockRemoveEventListener;

    Element.prototype.scrollIntoView = vi.fn();

    vi.clearAllMocks();
    localStorageMock.clear();
    sessionStorageMock.clear();
    eventHandlers = {};

    // 데모 응답 생성
    const demoResponse = {
      content: `📬 오늘 받은 이메일 스캔 결과:

⭐ 중요 메일: 3개
- "[긴급] 프로젝트 미팅 일정 변경" (manager@company.com)
- "계약서 검토 요청" (partner@business.org)

📧 구독 메일: 5개
- "오늘의 뉴스레터" (daily@newsletter.com)

🎉 이벤트 메일: 2개
- "온라인 컨퍼런스 시작 1시간 전 알림" (events@conf.com)`,
    };

    // fetch 모킹 설정
    (global.fetch as any).mockResolvedValue({
      ok: true,
      headers: {
        get: () => 'text/event-stream',
      },
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(`data: ${JSON.stringify(demoResponse)}\n\n`),
            })
            .mockResolvedValueOnce({
              done: true,
            }),
        }),
      },
    });
  });

  it('API 키가 없으면 처음에는 렌더링되지 않아야 함', () => {
    render(<ChatUI />);
    expect(screen.queryByText('Omni Secretary')).not.toBeInTheDocument();
  });

  it('api-key-success 이벤트를 받으면 활성화되어야 함', async () => {
    render(<ChatUI />);

    // 이벤트 리스너가 등록되었는지 확인
    expect(mockAddEventListener).toHaveBeenCalledWith('api-key-success', expect.any(Function));

    // 이벤트 발생 시뮬레이션
    await act(async () => {
      // api-key-success 이벤트에 등록된 리스너 실행
      const handlers = eventHandlers['api-key-success'] || [];
      handlers.forEach((handler) => {
        if (typeof handler === 'function') {
          handler(new CustomEvent('api-key-success', { detail: { apiKey: 'test-key' } }));
        }
      });
    });

    // UI가 활성화되었는지 확인 (헤더가 표시됨)
    expect(screen.getByText('Omni Secretary')).toBeInTheDocument();
  });

  it('start-demo 이벤트를 받으면 활성화되어야 함', async () => {
    render(<ChatUI />);

    // 이벤트 리스너가 등록되었는지 확인
    expect(mockAddEventListener).toHaveBeenCalledWith('start-demo', expect.any(Function));

    // 이벤트 발생 시뮬레이션
    await act(async () => {
      // start-demo 이벤트에 등록된 리스너 실행
      const handlers = eventHandlers['start-demo'] || [];
      handlers.forEach((handler) => {
        if (typeof handler === 'function') {
          handler(new Event('start-demo'));
        }
      });
    });

    // UI가 활성화되었는지 확인 (헤더가 표시됨)
    expect(screen.getByText('Omni Secretary')).toBeInTheDocument();
  });

  it('메시지가 표시될 수 있어야 함', async () => {
    // API 키 설정
    localStorageMock.getItem.mockReturnValue('test-key');

    const { container } = render(<ChatUI />);

    // 이벤트 발생하여 컴포넌트 활성화
    await act(async () => {
      const handlers = eventHandlers['start-demo'] || [];
      handlers.forEach((handler) => {
        if (typeof handler === 'function') {
          handler(new Event('start-demo'));
        }
      });
    });

    // 로딩 인디케이터가 표시되는지 확인
    expect(container.querySelectorAll('.animate-bounce').length).toBeGreaterThan(0);
  });

  it('제안된 프롬프트를 클릭하면 입력 필드에 텍스트가 채워져야 함', async () => {
    // 활성화
    localStorageMock.getItem.mockReturnValue('test-key');

    const { container } = render(<ChatUI />);

    // start-demo 이벤트를 통해 컴포넌트 활성화
    await act(async () => {
      const handlers = eventHandlers['start-demo'] || [];
      handlers.forEach((handler) => {
        if (typeof handler === 'function') {
          handler(new Event('start-demo'));
        }
      });
    });

    // 제안 프롬프트 영역 찾기
    const promptsContainer = container.querySelector('.border-t.p-2');

    if (promptsContainer) {
      // 제안 프롬프트 버튼들 찾기
      const promptButtons = promptsContainer.querySelectorAll('button');

      if (promptButtons.length > 0) {
        // 첫 번째 프롬프트 버튼의 텍스트 가져오기
        const promptText = promptButtons[0].textContent || '';

        // 버튼 클릭
        await act(async () => {
          fireEvent.click(promptButtons[0]);
        });

        // 입력 필드 찾기
        const textarea = container.querySelector('textarea');

        // 입력 필드에 텍스트가 설정되었는지 확인
        if (textarea) {
          expect((textarea as HTMLTextAreaElement).value).toBe(promptText);
        } else {
          throw new Error('Textarea element not found');
        }
      } else {
        throw new Error('Prompt buttons not found');
      }
    } else {
      throw new Error('Prompts container not found');
    }
  });

  it('대화 초기화 버튼을 클릭하면 메시지가 초기화되어야 함', async () => {
    // 활성화
    localStorageMock.getItem.mockReturnValue('test-key');

    const { container } = render(<ChatUI />);

    // start-demo 이벤트를 통해 컴포넌트 활성화 - 이렇게 하면 메시지가 로드됨
    await act(async () => {
      const handlers = eventHandlers['start-demo'] || [];
      handlers.forEach((handler) => {
        if (typeof handler === 'function') {
          handler(new Event('start-demo'));
        }
      });
    });

    // fetch 응답이 처리된 후 메시지가 표시되는지 기다림
    await act(async () => {
      // 모의 응답이 처리되는 시간 기다림
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // 초기화 버튼 찾기
    const resetButton = container.querySelector('button[aria-label="대화 초기화"]');
    expect(resetButton).not.toBeNull();

    // 초기화 버튼 클릭
    await act(async () => {
      if (resetButton) {
        fireEvent.click(resetButton);
      }
    });

    // 세션 스토리지에서 메시지가 삭제되었는지 확인
    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('omni_secretary_messages');

    // 로딩 인디케이터가 다시 표시되는지 확인
    expect(container.querySelectorAll('.animate-bounce').length).toBeGreaterThan(0);
  });

  it('창 확대/축소 버튼을 클릭하면 UI 크기가 변경되어야 함', async () => {
    // 활성화
    localStorageMock.getItem.mockReturnValue('test-key');

    const { container } = render(<ChatUI />);

    // start-demo 이벤트를 통해 컴포넌트 활성화
    await act(async () => {
      const handlers = eventHandlers['start-demo'] || [];
      handlers.forEach((handler) => {
        if (typeof handler === 'function') {
          handler(new Event('start-demo'));
        }
      });
    });

    // 컴포넌트가 렌더링 되었는지 확인
    expect(container.textContent).toContain('Omni Secretary');

    // 확대 버튼 찾기
    const maximizeButton = container.querySelector('button[aria-label="창 확대"]');
    expect(maximizeButton).not.toBeNull();

    // 확대 버튼 클릭
    await act(async () => {
      fireEvent.click(maximizeButton!);
    });

    // 확대된 UI 확인 (채팅 UI 컨테이너에 inset-4 클래스가 있는지 확인)
    const chatContainer = container.querySelector('.fixed');
    expect(chatContainer).not.toBeNull();
    expect(chatContainer).toHaveClass('inset-4');

    // 축소 버튼 찾기
    const minimizeButton = container.querySelector('button[aria-label="창 축소"]');
    expect(minimizeButton).not.toBeNull();

    // 축소 버튼 클릭
    await act(async () => {
      fireEvent.click(minimizeButton!);
    });

    // 축소된 UI 확인
    expect(chatContainer).not.toHaveClass('inset-4');
  });

  it('닫기 버튼을 클릭하면 UI가 사라져야 함', async () => {
    // 활성화
    localStorageMock.getItem.mockReturnValue('test-key');

    const { container } = render(<ChatUI />);

    // start-demo 이벤트를 통해 컴포넌트 활성화
    await act(async () => {
      const handlers = eventHandlers['start-demo'] || [];
      handlers.forEach((handler) => {
        if (typeof handler === 'function') {
          handler(new Event('start-demo'));
        }
      });
    });

    // 컴포넌트가 렌더링 되었는지 확인
    expect(container.textContent).toContain('Omni Secretary');

    // 닫기 버튼 찾기
    const closeButton = container.querySelector('button[aria-label="닫기"]');
    expect(closeButton).not.toBeNull();

    // 닫기 버튼 클릭
    await act(async () => {
      fireEvent.click(closeButton!);
    });

    // UI가 사라졌는지 확인
    expect(container.textContent).not.toContain('Omni Secretary');
  });
});
