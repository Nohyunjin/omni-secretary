import { useState } from 'react';
import { fetchAgentResponse, processStreamResponse } from '../services/api';
import { Message, STORAGE_KEY } from '../types/chat';
import { saveMessages } from '../utils/storage';

type ChatHookProps = {
  initialMessages: Message[];
  apiKey: string;
};

type ChatHookReturn = {
  messages: Message[];
  isProcessing: boolean;
  sendMessage: (text: string) => Promise<void>;
  resetConversation: () => void;
};

export const useChat = ({ initialMessages, apiKey }: ChatHookProps): ChatHookReturn => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isProcessing, setIsProcessing] = useState(false);

  // 메시지 전송 및 응답 처리
  const sendMessage = async (text: string) => {
    if (!text.trim() || isProcessing || !apiKey) return;

    // 사용자 메시지 추가
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsProcessing(true);

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
      const response = await fetchAgentResponse(text.trim(), apiKey, messageHistory);

      // AI 응답 메시지 초기화
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiResponse]);

      // 메시지 ID 저장
      const aiMessageId = aiResponse.id;

      // 스트리밍 응답 처리
      await processStreamResponse(response, (content, fullContent) => {
        // 기존 메시지 업데이트
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId ? { ...msg, content: msg.content + content } : msg
          )
        );
      });
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

  // 대화 초기화
  const resetConversation = () => {
    setMessages([]);
    // 세션 스토리지에서 메시지 삭제 (테스트 호환성 유지)
    sessionStorage.removeItem(STORAGE_KEY);
  };

  // 메시지 저장
  const saveConversation = () => {
    saveMessages(messages);
  };

  // 메시지가 변경될 때마다 저장
  if (messages.length > 0) {
    saveConversation();
  }

  return {
    messages,
    isProcessing,
    sendMessage,
    resetConversation,
  };
};
