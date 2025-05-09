import { EmailStats } from '../types/chat';

// 이메일 통계 추출 함수
export const extractEmailStats = (content: string): EmailStats => {
  const stats: EmailStats = {
    important: 0,
    subscription: 0,
    event: 0,
    promotion: 0,
    junk: 0,
  };

  // 마크다운 강조 표시와 함께 숫자를 추출하는 정규식 개선
  const importantMatch = content.match(/중요[^0-9]*(\**)(\d+)(\**)/i);
  const subscriptionMatch = content.match(/구독[^0-9]*(\**)(\d+)(\**)/i);
  const eventMatch = content.match(/이벤트[^0-9]*(\**)(\d+)(\**)/i);
  const promotionMatch = content.match(/프로모션[^0-9]*(\**)(\d+)(\**)/i);
  // 스팸 또는 정크라는 단어 뒤의 숫자 추출
  const junkMatch = content.match(/(스팸|정크)[^0-9]*(\**)(\d+)(\**)/i);

  // 그룹 인덱스 조정하여 항상 숫자 부분만 추출
  if (importantMatch) stats.important = parseInt(importantMatch[2]);
  if (subscriptionMatch) stats.subscription = parseInt(subscriptionMatch[2]);
  if (eventMatch) stats.event = parseInt(eventMatch[2]);
  if (promotionMatch) stats.promotion = parseInt(promotionMatch[2]);
  // 스팸/정크 메일 숫자 추출
  if (junkMatch) stats.junk = parseInt(junkMatch[3]);

  return stats;
};
