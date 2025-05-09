import { Message, STORAGE_KEY } from '../types/chat';

// API 키 저장
export const saveApiKey = (apiKey: string): void => {
  localStorage.setItem('api_key', apiKey);
};

// API 키 가져오기
export const getApiKey = (): string | null => {
  return localStorage.getItem('api_key');
};

// 메시지 저장
export const saveMessages = (messages: Message[]): void => {
  if (messages.length > 0) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }
};

// 메시지 복원
export const loadMessages = (): Message[] => {
  const savedMessages = sessionStorage.getItem(STORAGE_KEY);
  if (savedMessages) {
    try {
      const parsedMessages = JSON.parse(savedMessages);
      // 타임스탬프를 Date 객체로 변환
      return parsedMessages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }));
    } catch (e) {
      console.error('저장된 메시지를 불러오는데 실패했습니다.', e);
    }
  }
  return [];
};

// 이메일 통계 저장
export const saveEmailStats = (stats: any): void => {
  sessionStorage.setItem('email_stats', JSON.stringify(stats));
};

// 이메일 통계 가져오기
export const getEmailStats = (): any | null => {
  const savedStats = sessionStorage.getItem('email_stats');
  if (savedStats) {
    try {
      return JSON.parse(savedStats);
    } catch (e) {
      console.error('저장된 이메일 통계를 불러오는데 실패했습니다.', e);
    }
  }
  return null;
};

// 자동 스캔 완료 표시
export const setAutoScanComplete = (complete: boolean): void => {
  sessionStorage.setItem('auto_scan_complete', complete ? 'true' : 'false');
};

// 자동 스캔 완료 상태 확인
export const isAutoScanComplete = (): boolean => {
  return sessionStorage.getItem('auto_scan_complete') === 'true';
};
