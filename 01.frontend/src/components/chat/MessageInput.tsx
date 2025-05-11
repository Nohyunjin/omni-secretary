import { MicIcon, PaperclipIcon, SendIcon } from 'lucide-react';
import { ChangeEvent, KeyboardEvent, useEffect, useRef } from 'react';

type MessageInputProps = {
  input: string;
  setInput: (value: string) => void;
  isProcessing: boolean;
  handleSendMessage: () => void;
};

export const MessageInput = ({
  input,
  setInput,
  isProcessing,
  handleSendMessage,
}: MessageInputProps) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 텍스트 영역 높이 자동 조정
  const adjustTextareaHeight = () => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  };

  // 키 입력 이벤트 처리
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 입력 값 변경 처리
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    adjustTextareaHeight();
  };

  // 텍스트 영역 초기화 (메시지 전송 후)
  useEffect(() => {
    if (!input && inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }, [input]);

  return (
    <div className="border-t p-3 shrink-0 bg-white dark:bg-slate-900">
      <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-full px-4 py-2 border border-slate-200 dark:border-slate-700">
        <button className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 flex-shrink-0">
          <PaperclipIcon className="w-4 h-4 text-slate-500" />
        </button>

        <textarea
          ref={inputRef}
          value={input}
          onChange={handleChange}
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
  );
};
