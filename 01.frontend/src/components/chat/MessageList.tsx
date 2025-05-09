import { useEffect, useRef } from 'react';
import { Message } from '../../types/chat';

type MessageListProps = {
  messages: Message[];
  isProcessing: boolean;
};

export const MessageList = ({ messages, isProcessing }: MessageListProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 메시지가 추가될 때마다 스크롤 맨 아래로 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
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
                message.role === 'user' ? 'text-primary-100' : 'text-slate-500 dark:text-slate-400'
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
  );
};
