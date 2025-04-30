'use client';

import { useEffect, useState } from 'react';

export default function ApiKeyModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [saveKey, setSaveKey] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // 로컬 스토리지에서 API 키 복원
    const savedKey = localStorage.getItem('api_key');
    if (savedKey) {
      setApiKey(savedKey);
    }

    // 모달 열기 이벤트 리스너
    const handleOpenModal = () => setIsOpen(true);
    window.addEventListener('open-api-modal', handleOpenModal);

    return () => {
      window.removeEventListener('open-api-modal', handleOpenModal);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!apiKey.trim()) {
      setError('API 키를 입력해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      // TODO: API 키 유효성 검사 로직

      // 키 저장
      if (saveKey) {
        localStorage.setItem('api_key', apiKey);
      }

      // 성공 후 모달 닫기
      setIsOpen(false);

      // Chat UI 활성화 (이벤트 디스패치)
      window.dispatchEvent(
        new CustomEvent('api-key-success', {
          detail: { apiKey },
        })
      );
    } catch (err) {
      setError('API 키 검증 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-md overflow-hidden shadow-xl">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">API 키 입력</h2>
          <p className="text-slate-600 dark:text-slate-300 mb-6">
            Omni Secretary를 사용하기 위해 OpenAI API 키를 입력해주세요.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="apiKey" className="block text-sm font-medium mb-1">
                OpenAI API 키
              </label>
              <input
                type="password"
                id="apiKey"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full p-2 border rounded-md dark:bg-slate-700 dark:border-slate-600"
              />
            </div>

            <div className="mb-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={saveKey}
                  onChange={(e) => setSaveKey(e.target.checked)}
                  className="rounded text-primary"
                />
                <span className="text-sm">이 기기에 API 키 저장하기</span>
              </label>
            </div>

            {error && (
              <div className="mb-4 p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm rounded-md border border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
                disabled={isLoading}
              >
                취소
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm rounded-md bg-primary text-white hover:bg-primary-600 disabled:opacity-50 disabled:pointer-events-none"
                disabled={isLoading}
              >
                {isLoading ? '확인 중...' : '확인'}
              </button>
            </div>
          </form>
        </div>

        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-700/50 text-xs text-slate-500 dark:text-slate-400">
          <p>
            API 키는 안전하게 관리됩니다. 저장 시 이 기기에만 저장되며 서버로 전송되지 않습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
