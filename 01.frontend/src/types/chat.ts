// 메시지 타입 정의
export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

// 이메일 카테고리 상태 (UI 표시용)
export type EmailStats = {
  important: number;
  subscription: number;
  event: number;
  promotion: number;
  junk: number;
};

// 제안 프롬프트
export const SUGGESTED_PROMPTS = [
  '지난 달 구독 메일을 요약해줘',
  '중요한 뉴스레터만 보여줘',
  '읽지 않은 메일을 정리해줘',
  '스팸 메일을 찾아줘',
];

// 자동 이메일 스캔 프롬프트
export const AUTO_SCAN_PROMPT = `오늘 받은 이메일만 스캔하고 다음 카테고리로 분류해서 요약해줘:
- 중요 메일 (⭐): 긴급한 회의, 중요한 공지, 개인적으로 중요한 메일
- 구독 메일 (📧): 뉴스레터, 정기 구독 서비스 메일
- 이벤트 메일 (🎉): 초대장, 행사 알림, 기념일 관련 메일
- 프로모션 메일 (🛍️): 마케팅, 할인, 상품 광고 메일
- 스팸/정크 메일 (🗑️): 원치 않는 메일, 악성 메일

각 카테고리별 개수와 오늘 온 중요한 이메일 몇 개만 알려줘.`;

// 세션 스토리지 키
export const STORAGE_KEY = 'omni_secretary_messages';
