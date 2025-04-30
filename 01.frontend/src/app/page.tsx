'use client';

import ApiKeyModal from '@/components/ApiKeyModal';
import ChatUI from '@/components/chat/ChatUI';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* 헤더 */}
      <header className="w-full p-4 flex items-center justify-between border-b">
        <div className="flex items-center gap-2">
          <Image
            src="/logo.svg"
            alt="Omni Secretary Logo"
            width={36}
            height={36}
            className="dark:invert"
          />
          <h1 className="text-xl font-bold">Omni Secretary</h1>
        </div>
        <a
          href="mailto:contact@omnisecretary.com"
          className="px-4 py-1.5 text-sm rounded-full border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 transition-colors"
        >
          Contact
        </a>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            개인 AI 비서로 이메일 관리를 간편하게
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            중요한 구독 메일을 정리하고, 숨겨진 가치를 발견하세요. 당신만의 비서가 메일함 속 정보를
            효율적으로 관리해 드립니다.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <button
            className="flex-1 px-6 py-3 rounded-lg bg-primary text-white hover:bg-primary-600 transition-colors focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            onClick={() => {
              // API 키 입력 모달 열기 로직
              window.dispatchEvent(new CustomEvent('open-api-modal'));
            }}
          >
            시작하기
          </button>
          <button
            className="flex-1 px-6 py-3 rounded-lg border border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800 transition-colors"
            onClick={() => {
              // 체험 모드 시작 로직
              window.dispatchEvent(new CustomEvent('start-demo'));
            }}
          >
            체험하기
          </button>
        </div>

        <div className="mt-16 w-full max-w-3xl bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">이런 작업을 도와드려요</h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">✓</span>
                <span>구독 메일 요약 및 분류</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">✓</span>
                <span>중요한 뉴스레터 하이라이트</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">✓</span>
                <span>메일 정리 및 자동화 제안</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">✓</span>
                <span>개인화된 응답 작성 도움</span>
              </li>
            </ul>
          </div>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="w-full p-4 border-t text-center text-sm text-slate-500">
        © 2025 Omni Secretary. All rights reserved.
      </footer>

      {/* 모달 및 컴포넌트 */}
      <ApiKeyModal />
      <ChatUI />
    </div>
  );
}
