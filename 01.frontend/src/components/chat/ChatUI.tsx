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

export default function ChatUI() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // API 키 성공 이벤트를 감지하여 채팅 UI 활성화
  useEffect(() => {
    const handleApiSuccess = () => {
      setIsActive(true);
    };

    // 체험 모드 이벤트도 감지
    const handleDemoStart = () => {
      setIsActive(true);
    };

    window.addEventListener('api-key-success', handleApiSuccess);
    window.addEventListener('start-demo', handleDemoStart);

    return () => {
      window.removeEventListener('api-key-success', handleApiSuccess);
      window.removeEventListener('start-demo', handleDemoStart);
    };
  }, []);

  // 메시지가 추가될 때마다 스크롤 맨 아래로 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 텍스트 영역 높이 자동 조정
  const adjustTextareaHeight = () => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  };

  // 메시지 전송 처리
  const handleSendMessage = async () => {
    if (!input.trim() || isProcessing) return;

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
      // 여기서 실제 AI 응답을 처리할 예정
      // 지금은 간단한 에코로 구현
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `메일 분석 중... "${input.trim()}"에 대한 결과를 보여드릴게요.`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiResponse]);
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
        <div className="ml-auto flex items-center gap-1">
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
        {isProcessing && (
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
