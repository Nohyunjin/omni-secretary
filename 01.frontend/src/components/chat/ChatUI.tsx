'use client';

import { MaximizeIcon, MicIcon, MinimizeIcon, PaperclipIcon, SendIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// 메시지 타입 정의
type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

// 이메일 카테고리 상태 (UI 표시용)
type EmailStats = {
  important: number;
  subscription: number;
  event: number;
  promotion: number;
  junk: number;
};

// 예시 시작 메시지
const initialMessages: Message[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content: '안녕하세요! Omni Secretary입니다. 이메일 관리와 관련하여 어떤 도움이 필요하신가요?',
    timestamp: new Date(),
  },
];

// 예시 제안 프롬프트
const suggestedPrompts = [
  '지난 달 구독 메일을 요약해줘',
  '중요한 뉴스레터만 보여줘',
  '읽지 않은 메일을 정리해줘',
  '스팸 메일을 찾아줘',
];

// 자동 이메일 스캔 프롬프트
const AUTO_SCAN_PROMPT =
  '오늘 받은 이메일만 스캔하고 중요, 구독, 이벤트, 프로모션, 스팸 등의 카테고리로 분류해서 요약해줘. 각 카테고리별 개수와 오늘 온 중요한 이메일 몇 개만 알려줘.';

// 세션 스토리지 키
const STORAGE_KEY = 'omni_secretary_messages';

export default function ChatUI() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [emailStats, setEmailStats] = useState<EmailStats | null>(null);
  const [autoScanComplete, setAutoScanComplete] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // API 키 성공 이벤트를 감지하여 채팅 UI 활성화 및 세션 스토리지에서 메시지 복원
  useEffect(() => {
    const handleApiSuccess = (event: CustomEvent) => {
      setIsActive(true);
      const providedApiKey = event.detail?.apiKey || '';
      setApiKey(providedApiKey);

      // API 키가 입력되면 자동으로 이메일 스캔 요청 시작 (모달에서 확인 버튼 클릭 시에만)
      if (providedApiKey) {
        setTimeout(() => {
          autoScanEmails(providedApiKey);
        }, 500); // 약간의 지연을 두어 사용자 경험 향상
      }
    };

    // 체험 모드 이벤트도 감지
    const handleDemoStart = () => {
      setIsActive(true);
      // 데모 모드에서는 가상의 자동 스캔 시작
      setTimeout(() => {
        simulateDemoScan();
      }, 500);
    };

    // 로컬 스토리지에서 API 키 복원
    const savedKey = localStorage.getItem('api_key');
    if (savedKey) {
      setApiKey(savedKey);

      // 자동 스캔을 이미 완료했는지 확인
      const scanComplete = sessionStorage.getItem('auto_scan_complete');
      if (scanComplete === 'true') {
        setAutoScanComplete(true);

        // 이전 이메일 통계 복원
        const savedStats = sessionStorage.getItem('email_stats');
        if (savedStats) {
          try {
            setEmailStats(JSON.parse(savedStats));
          } catch (e) {
            console.error('저장된 이메일 통계를 불러오는데 실패했습니다.', e);
          }
        }
      }
      // 새로고침 시에는 자동 스캔을 실행하지 않음 (이 부분에 있던 autoScanEmails 호출 제거)
    }

    // 세션 스토리지에서 메시지 기록 복원
    const savedMessages = sessionStorage.getItem(STORAGE_KEY);
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        // 타임스탬프를 Date 객체로 변환
        const messagesWithDates = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        setMessages(messagesWithDates);
      } catch (e) {
        console.error('저장된 메시지를 불러오는데 실패했습니다.', e);
      }
    }

    window.addEventListener('api-key-success', handleApiSuccess as EventListener);
    window.addEventListener('start-demo', handleDemoStart);

    return () => {
      window.removeEventListener('api-key-success', handleApiSuccess as EventListener);
      window.removeEventListener('start-demo', handleDemoStart);
    };
  }, []);

  // 자동 이메일 스캔 실행
  const autoScanEmails = async (apiKeyValue: string) => {
    if (isProcessing || autoScanComplete) return;

    setIsProcessing(true);

    // 자동 스캔용 시스템 메시지 (UI에 표시하지 않음)
    const scanMessage: Message = {
      id: 'auto-scan-' + Date.now().toString(),
      role: 'user',
      content: AUTO_SCAN_PROMPT,
      timestamp: new Date(),
    };

    try {
      // 이전 메시지 컨텍스트 준비
      const messageHistory = messages.slice(1).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // 스캔 중임을 알리는 메시지 추가
      const scanningMessage: Message = {
        id: 'scanning-' + Date.now().toString(),
        role: 'assistant',
        content: '메일함에서 중요 정보를 찾고 있습니다...',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, scanningMessage]);

      // AI 응답 요청
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: AUTO_SCAN_PROMPT,
          api_key: apiKeyValue,
          stream: true,
          messageHistory,
        }),
      });

      if (!response.ok) {
        throw new Error('API 응답 오류');
      }

      // 스캐닝 메시지 ID 저장
      const scanningMessageId = scanningMessage.id;

      // 스트리밍 응답 처리
      if (response.headers.get('Content-Type')?.includes('text/event-stream')) {
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
            // 기존 메시지 업데이트
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === scanningMessageId
                  ? { ...msg, content: '📬 이메일 스캔 결과:\n\n' + fullContent }
                  : msg
              )
            );
          }
        }

        // 이메일 통계 추출 (응답에서 대략적인 숫자 추출)
        const stats = extractEmailStats(fullContent);
        setEmailStats(stats);
        sessionStorage.setItem('email_stats', JSON.stringify(stats));
      } else {
        // 일반 JSON 응답 처리 (필요시)
        const data = await response.json();
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === scanningMessageId
              ? {
                  ...msg,
                  content:
                    '📬 이메일 스캔 결과:\n\n' + (data.content || '스캔 결과를 받지 못했습니다.'),
                }
              : msg
          )
        );
      }

      // 자동 스캔 완료 표시
      setAutoScanComplete(true);
      sessionStorage.setItem('auto_scan_complete', 'true');
    } catch (error) {
      console.error('자동 이메일 스캔 오류:', error);

      // 오류 메시지로 변경
      const errorMessage = '죄송합니다, 이메일 스캔 중 오류가 발생했습니다.';
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id.startsWith('scanning-') ? { ...msg, content: errorMessage } : msg
        )
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // 데모 스캔 시뮬레이션
  const simulateDemoScan = () => {
    if (isProcessing || autoScanComplete) return;

    setIsProcessing(true);

    // 스캔 중임을 알리는 메시지 추가
    const scanningMessage: Message = {
      id: 'scanning-' + Date.now().toString(),
      role: 'assistant',
      content: '메일함에서 중요 정보를 찾고 있습니다...',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, scanningMessage]);

    // 데모 응답 시뮬레이션
    setTimeout(() => {
      // 현재 날짜를 표시
      const today = new Date().toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const demoResponse = `📬 오늘(${today}) 받은 이메일 스캔 결과:

⭐ 중요 메일: 3개
- "[긴급] 프로젝트 미팅 일정 변경" (manager@company.com)
- "계약서 검토 요청" (partner@business.org)
- "인터뷰 확정 안내" (hr@recruit.co.kr)

📧 구독 메일: 5개
- "오늘의 뉴스레터" (daily@newsletter.com)
- "새로운 기술 업데이트" (tech@updates.dev)

🎉 이벤트 메일: 2개
- "온라인 컨퍼런스 시작 1시간 전 알림" (events@conf.com)
- "할인 프로모션 마지막 날" (sale@shop.com)

🛍️ 프로모션 메일: 4개
- "오늘만 특가! 50% 할인" (marketing@store.com)
- "점심 배달 쿠폰" (food@delivery.app)

🗑️ 스팸/정크 메일: 3개

오늘 총 17개의 이메일이 도착했으며, 이 중 8개는 아직 읽지 않았습니다.
특히 "계약서 검토 요청"은 오늘 오후 3시까지 회신이 필요한 중요 메일입니다.`;

      // 메시지 업데이트
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id.startsWith('scanning-') ? { ...msg, content: demoResponse } : msg
        )
      );

      // 이메일 통계 설정
      const demoStats: EmailStats = {
        important: 3,
        subscription: 5,
        event: 2,
        promotion: 4,
        junk: 3,
      };

      setEmailStats(demoStats);
      sessionStorage.setItem('email_stats', JSON.stringify(demoStats));

      // 자동 스캔 완료 표시
      setAutoScanComplete(true);
      sessionStorage.setItem('auto_scan_complete', 'true');
      setIsProcessing(false);
    }, 2000);
  };

  // 이메일 통계 추출 함수
  const extractEmailStats = (content: string): EmailStats => {
    const stats: EmailStats = {
      important: 0,
      subscription: 0,
      event: 0,
      promotion: 0,
      junk: 0,
    };

    // 간단한 정규식으로 숫자 추출 (실제로는 더 정교한 파싱 로직 필요)
    const importantMatch = content.match(/중요[^0-9]*(\d+)/i);
    const subscriptionMatch = content.match(/구독[^0-9]*(\d+)/i);
    const eventMatch = content.match(/이벤트[^0-9]*(\d+)/i);
    const promotionMatch = content.match(/프로모션[^0-9]*(\d+)/i);
    const junkMatch = content.match(/스팸|정크[^0-9]*(\d+)/i);

    if (importantMatch) stats.important = parseInt(importantMatch[1]);
    if (subscriptionMatch) stats.subscription = parseInt(subscriptionMatch[1]);
    if (eventMatch) stats.event = parseInt(eventMatch[1]);
    if (promotionMatch) stats.promotion = parseInt(promotionMatch[1]);
    if (junkMatch) stats.junk = parseInt(junkMatch[1]);

    return stats;
  };

  // 메시지가 추가될 때마다 스크롤 맨 아래로 이동 및 세션 스토리지에 저장
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

    // 초기 메시지가 아닌 경우에만 세션 스토리지에 저장
    if (messages.length > initialMessages.length || messages[0].id !== initialMessages[0].id) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  // 텍스트 영역 높이 자동 조정
  const adjustTextareaHeight = () => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  };

  // 대화 기록 초기화
  const resetConversation = () => {
    setMessages(initialMessages);
    sessionStorage.removeItem(STORAGE_KEY);
    setAutoScanComplete(false);
    sessionStorage.removeItem('auto_scan_complete');
  };

  // 메시지 전송 처리
  const handleSendMessage = async () => {
    if (!input.trim() || isProcessing) return;

    // API 키 확인
    if (!apiKey) {
      // API 키 모달 열기
      window.dispatchEvent(new Event('open-api-modal'));
      return;
    }

    // 사용자 메시지 추가
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    // 텍스트 영역 높이 초기화
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    try {
      // 이전 메시지 컨텍스트 준비 (첫 웰컴 메시지 제외)
      const messageHistory =
        messages.length > 1
          ? messages.slice(1).map((msg) => ({
              role: msg.role,
              content: msg.content,
            }))
          : [];

      // AI 응답 요청
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: input.trim(),
          api_key: apiKey,
          stream: true,
          messageHistory, // 이전 메시지 컨텍스트 추가
        }),
      });

      if (!response.ok) {
        throw new Error('API 응답 오류');
      }

      // 스트리밍 응답 처리
      if (response.headers.get('Content-Type')?.includes('text/event-stream')) {
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, aiResponse]);

        const reader = response.body?.getReader();
        if (!reader) throw new Error('응답 본문을 읽을 수 없습니다.');

        // 메시지 ID 저장
        const aiMessageId = aiResponse.id;

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
                }
              } catch (e) {
                // 파싱 오류 무시
              }
            }
          }

          if (content) {
            // 기존 메시지 업데이트
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiMessageId ? { ...msg, content: msg.content + content } : msg
              )
            );
          }
        }
      } else {
        // 일반 JSON 응답 처리
        const data = await response.json();
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.content || '응답을 받지 못했습니다.',
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, aiResponse]);
      }
    } catch (error) {
      // 오류 처리
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '죄송합니다, 요청을 처리하는 중에 오류가 발생했습니다. 다시 시도해주세요.',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  // 키 입력 이벤트 처리
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 제안 프롬프트 클릭 처리
  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  if (!isActive) return null;

  return (
    <div
      className={`fixed z-40 bg-white dark:bg-slate-900 shadow-xl rounded-lg overflow-hidden transition-all duration-300 flex flex-col ${
        isExpanded
          ? 'inset-4 sm:inset-10 lg:inset-20'
          : 'bottom-4 right-4 w-[calc(100%-2rem)] sm:w-96 h-[32rem] max-h-[80vh]'
      }`}
    >
      {/* 헤더 */}
      <header className="border-b p-3 flex items-center bg-primary text-white shrink-0">
        <h1 className="text-lg font-bold">Omni Secretary</h1>

        {/* 이메일 스캔 상태 표시 */}
        {isProcessing && messages.some((m) => m.id.startsWith('scanning-')) && (
          <div className="ml-2 flex items-center text-xs bg-primary-600 px-2 py-0.5 rounded-full">
            <div className="animate-spin mr-1 h-3 w-3 border-2 border-white border-t-transparent rounded-full"></div>
            메일 분석 중...
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          {/* 이메일 통계 표시 */}
          {emailStats && autoScanComplete && (
            <div className="mr-2 text-xs flex items-center space-x-1.5">
              <span title="중요 메일">⭐ {emailStats.important}</span>
              <span title="구독 메일">📧 {emailStats.subscription}</span>
              <span title="이벤트 메일">🎉 {emailStats.event}</span>
              <span title="프로모션 메일">🛍️ {emailStats.promotion}</span>
              <span title="스팸/정크 메일">🗑️ {emailStats.junk}</span>
            </div>
          )}

          <button
            className="p-1.5 rounded-md hover:bg-primary-600 transition-colors"
            onClick={resetConversation}
            aria-label="대화 초기화"
            title="대화 초기화"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
              <path d="M3 3v5h5"></path>
            </svg>
          </button>
          {isExpanded ? (
            <button
              className="p-1.5 rounded-md hover:bg-primary-600 transition-colors"
              onClick={() => setIsExpanded(false)}
              aria-label="창 축소"
            >
              <MinimizeIcon className="w-4 h-4" />
            </button>
          ) : (
            <button
              className="p-1.5 rounded-md hover:bg-primary-600 transition-colors"
              onClick={() => setIsExpanded(true)}
              aria-label="창 확대"
            >
              <MaximizeIcon className="w-4 h-4" />
            </button>
          )}
          <button
            className="p-1.5 rounded-md hover:bg-primary-600 transition-colors"
            onClick={() => setIsActive(false)}
            aria-label="닫기"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg p-3 ${
                message.role === 'user' ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <p className="whitespace-pre-wrap text-sm">{message.content}</p>
              <div
                className={`text-xs mt-1 ${
                  message.role === 'user'
                    ? 'text-primary-100'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {message.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />

        {/* 메시지가 처리 중일 때 표시할 로딩 인디케이터 */}
        {isProcessing && !messages.some((m) => m.id.startsWith('scanning-')) && (
          <div className="flex justify-start">
            <div className="bg-slate-200 dark:bg-slate-700 rounded-lg p-2">
              <div className="flex space-x-1.5">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 제안 프롬프트 */}
      <div className="p-2 border-t border-slate-200 dark:border-slate-700 overflow-x-auto shrink-0">
        <div className="flex gap-2">
          {suggestedPrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handlePromptClick(prompt)}
              className="whitespace-nowrap px-3 py-1 text-xs rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* 입력 영역 */}
      <div className="border-t p-3 shrink-0 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-full px-4 py-2 border border-slate-200 dark:border-slate-700">
          <button className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 flex-shrink-0">
            <PaperclipIcon className="w-4 h-4 text-slate-500" />
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              adjustTextareaHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요..."
            className="flex-1 bg-transparent border-none resize-none focus:ring-0 focus:outline-none max-h-[100px] text-sm py-1 min-h-[20px]"
            rows={1}
          />

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
              aria-label="음성 메시지"
            >
              <MicIcon className="w-4 h-4 text-slate-500" />
            </button>

            <button
              onClick={handleSendMessage}
              disabled={!input.trim() || isProcessing}
              className="p-1.5 rounded-full bg-primary text-white hover:bg-primary-600 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center transition-colors"
              aria-label="메시지 보내기"
            >
              <SendIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
