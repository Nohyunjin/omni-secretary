'use client';

import { useCallback, useEffect, useState } from 'react';
import { useChat } from '../../hooks/useChat';
import { useEmailScan } from '../../hooks/useEmailScan';
import { Message } from '../../types/chat';
import { getApiKey } from '../../utils/storage';
import { ChatHeader } from './ChatHeader';
import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';
import { SuggestedPrompts } from './SuggestedPrompts';

// 빈 초기 메시지 (안내 인사 없이 바로 스캔 시작)
const initialMessages: Message[] = [];

export default function ChatUI() {
  const [isActive, setIsActive] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [input, setInput] = useState('');

  // 채팅 관련 상태 및 함수
  const {
    messages,
    isProcessing: chatProcessing,
    sendMessage,
    resetConversation,
  } = useChat({
    initialMessages,
    apiKey,
  });

  // 메시지 설정 핸들러 (useCallback으로 감싸서 종속성 문제 해결)
  const handleSetMessages = useCallback(
    (newMessages: Message[] | ((prev: Message[]) => Message[])) => {
      if (typeof newMessages === 'function') {
        resetConversation();
        const result = newMessages([]);
        result.forEach((msg) => {
          // 각 메시지를 추가
          sendMessage(msg.content);
        });
      } else {
        resetConversation();
        if (newMessages.length > 0) {
          // 첫 번째 메시지만 설정 (이메일 스캔 결과)
          const assistantMsg: Message = {
            ...newMessages[0],
            role: 'assistant',
          };
          resetConversation();
          // 메시지를 직접 설정할 방법이 필요할 수 있음
          // 현재는 sendMessage를 통해 간접적으로 구현
          sendMessage(assistantMsg.content);
        }
      }
    },
    [resetConversation, sendMessage]
  );

  // 이메일 스캔 관련 상태 및 함수
  const {
    emailStats,
    autoScanComplete,
    isProcessing: scanProcessing,
    startAutoScan,
    simulateDemoScan,
    resetScanStatus,
  } = useEmailScan({
    apiKey,
    // 채팅 메시지 업데이트 함수 전달
    setMessages: handleSetMessages,
  });

  // 이메일 스캔 시작 메서드 (useCallback으로 감싸서 종속성 문제 해결)
  const handleStartAutoScan = useCallback(() => {
    if (apiKey) {
      setTimeout(() => {
        startAutoScan();
      }, 500);
    }
  }, [apiKey, startAutoScan]);

  // 통합 로딩 상태
  const isProcessing = chatProcessing || scanProcessing;

  // API 키 성공 이벤트를 감지하여 채팅 UI 활성화
  useEffect(() => {
    const handleApiSuccess = (event: CustomEvent) => {
      setIsActive(true);
      const providedApiKey = event.detail?.apiKey || '';
      setApiKey(providedApiKey);

      // API 키가 입력되면 자동으로 이메일 스캔 요청 시작
      if (providedApiKey) {
        handleStartAutoScan();
      }
    };

    // 체험 모드 이벤트도 감지
    const handleDemoStart = () => {
      setIsActive(true);
      // 데모 모드에서는 메시지 초기화 후 가상의 자동 스캔 시작
      resetConversation();
      simulateDemoScan();
    };

    // 로컬 스토리지에서 API 키 복원
    const savedKey = getApiKey();
    if (savedKey) {
      setApiKey(savedKey);
    }

    window.addEventListener('api-key-success', handleApiSuccess as EventListener);
    window.addEventListener('start-demo', handleDemoStart);

    return () => {
      window.removeEventListener('api-key-success', handleApiSuccess as EventListener);
      window.removeEventListener('start-demo', handleDemoStart);
    };
  }, [handleStartAutoScan, resetConversation, simulateDemoScan]);

  // 메시지 전송 처리
  const handleSendMessage = async () => {
    if (!input.trim() || isProcessing) return;

    // API 키 확인
    if (!apiKey) {
      // API 키 모달 열기
      window.dispatchEvent(new Event('open-api-modal'));
      return;
    }

    await sendMessage(input);
    setInput('');
  };

  // 제안 프롬프트 클릭 처리
  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
  };

  // 대화 초기화 & 새 스캔 시작
  const handleResetConversation = () => {
    resetConversation();
    resetScanStatus();
    handleStartAutoScan();
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
      <ChatHeader
        isProcessing={isProcessing}
        emailStats={emailStats}
        autoScanComplete={autoScanComplete}
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
        resetConversation={handleResetConversation}
        setIsActive={setIsActive}
      />

      {/* 메시지 영역 */}
      <MessageList messages={messages} isProcessing={isProcessing} />

      {/* 제안 프롬프트 */}
      <SuggestedPrompts onPromptClick={handlePromptClick} />

      {/* 입력 영역 */}
      <MessageInput
        input={input}
        setInput={setInput}
        isProcessing={isProcessing}
        handleSendMessage={handleSendMessage}
      />
    </div>
  );
}
