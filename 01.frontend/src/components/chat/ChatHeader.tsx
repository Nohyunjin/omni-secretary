import { MaximizeIcon, MinimizeIcon, XIcon } from 'lucide-react';
import { EmailStats } from '../../types/chat';

type ChatHeaderProps = {
  isProcessing: boolean;
  emailStats: EmailStats | null;
  autoScanComplete: boolean;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  resetConversation: () => void;
  setIsActive: (active: boolean) => void;
};

export const ChatHeader = ({
  isProcessing,
  emailStats,
  autoScanComplete,
  isExpanded,
  setIsExpanded,
  resetConversation,
  setIsActive,
}: ChatHeaderProps) => {
  return (
    <header className="border-b p-3 flex items-center bg-primary text-white shrink-0">
      <h1 className="text-lg font-bold">Omni Secretary</h1>

      {/* 이메일 스캔 상태 표시 */}
      {isProcessing && (
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
  );
};
