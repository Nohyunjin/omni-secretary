import { useEffect, useState } from 'react';
import { fetchAgentResponse, processStreamResponse } from '../services/api';
import { AUTO_SCAN_PROMPT, EmailStats, Message } from '../types/chat';
import { extractEmailStats } from '../utils/email';
import {
  getEmailStats,
  isAutoScanComplete,
  setAutoScanComplete as saveAutoScanStatus,
  saveEmailStats,
} from '../utils/storage';

type EmailScanHookProps = {
  apiKey: string;
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
};

type EmailScanHookReturn = {
  emailStats: EmailStats | null;
  autoScanComplete: boolean;
  isProcessing: boolean;
  startAutoScan: () => Promise<void>;
  simulateDemoScan: () => void;
  resetScanStatus: () => void;
};

export const useEmailScan = ({ apiKey, setMessages }: EmailScanHookProps): EmailScanHookReturn => {
  const [emailStats, setEmailStats] = useState<EmailStats | null>(null);
  const [autoScanComplete, setAutoScanComplete] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // 초기화: 저장된 스캔 완료 상태 및 통계 복원
  useEffect(() => {
    if (apiKey) {
      // 자동 스캔을 이미 완료했는지 확인
      const scanComplete = isAutoScanComplete();
      if (scanComplete) {
        setAutoScanComplete(true);

        // 이전 이메일 통계 복원
        const savedStats = getEmailStats();
        if (savedStats) {
          setEmailStats(savedStats);
        }
      }
    }
  }, [apiKey]);

  // 자동 이메일 스캔 실행
  const startAutoScan = async () => {
    if (autoScanComplete || !apiKey || isProcessing) return;

    setIsProcessing(true);
    setMessages([]);

    try {
      // AI 응답 요청
      const response = await fetchAgentResponse(AUTO_SCAN_PROMPT, apiKey, []);

      let fullContent = '';
      let hasCreatedMessage = false;

      // 스트리밍 응답 처리
      await processStreamResponse(response, (content, updatedFullContent) => {
        fullContent = updatedFullContent;

        // 첫 번째 응답에서 새 메시지 생성
        if (!hasCreatedMessage) {
          const newMessage: Message = {
            id: 'scan-result-' + Date.now().toString(),
            role: 'assistant',
            content: '📬 이메일 스캔 결과:\n\n' + fullContent,
            timestamp: new Date(),
          };
          setMessages([newMessage]);
          hasCreatedMessage = true;
        } else {
          // 이후 응답에서 메시지 업데이트
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id.startsWith('scan-result-')
                ? { ...msg, content: '📬 이메일 스캔 결과:\n\n' + fullContent }
                : msg
            )
          );
        }
      });

      // 이메일 통계 추출
      const stats = extractEmailStats(fullContent);
      setEmailStats(stats);
      saveEmailStats(stats);

      // 자동 스캔 완료 표시
      setAutoScanComplete(true);
      saveAutoScanStatus(true);
    } catch (error) {
      console.error('자동 이메일 스캔 오류:', error);

      // 오류 메시지 생성
      const errorMessage: Message = {
        id: 'scan-error-' + Date.now().toString(),
        role: 'assistant',
        content: '죄송합니다, 이메일 스캔 중 오류가 발생했습니다.',
        timestamp: new Date(),
      };
      setMessages([errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  // 스캔 상태 초기화
  const resetScanStatus = () => {
    setAutoScanComplete(false);
    saveAutoScanStatus(false);
  };

  // 데모 스캔 시뮬레이션
  const simulateDemoScan = () => {
    if (autoScanComplete || isProcessing) return;

    setIsProcessing(true);
    setMessages([]);

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

      // 메시지 생성
      const resultMessage: Message = {
        id: 'scan-result-' + Date.now().toString(),
        role: 'assistant',
        content: demoResponse,
        timestamp: new Date(),
      };
      setMessages([resultMessage]);

      // 이메일 통계 설정
      const demoStats: EmailStats = {
        important: 3,
        subscription: 5,
        event: 2,
        promotion: 4,
        junk: 3,
      };

      setEmailStats(demoStats);
      saveEmailStats(demoStats);

      // 자동 스캔 완료 표시
      setAutoScanComplete(true);
      saveAutoScanStatus(true);
      setIsProcessing(false);
    }, 2000);
  };

  return {
    emailStats,
    autoScanComplete,
    isProcessing,
    startAutoScan,
    simulateDemoScan,
    resetScanStatus,
  };
};
