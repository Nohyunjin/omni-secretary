// API 기본 URL
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

// API 경로
export const API_PATHS = {
  agent: '/api/v1/agent/query',
};

// 전체 API URL 반환
export const getApiUrl = (path: string): string => {
  return `${API_BASE_URL}${path}`;
};
