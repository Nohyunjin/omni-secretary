# Omni Secretary

**OmniSecretary**는 하나의 지능형 개인 비서가 다양한 작업(이메일 정리, 교통 경로 추천, 일정 관리 등)을 능동적으로 수행할 수 있도록 설계된 에이전트 기반 플랫폼입니다.

## 주요 기능

- **이메일 정리**: 구독 메일 요약 및 분류
- **교통 비서**: 한국 내 최적의 출발 시간 및 경로 추천 (추가 예정)
- **일정 관리 비서**: 예정된 일정 등록 및 알림 기능 (추가 예정)

## 아키텍처

- **프론트엔드**: Next.js 15 (React 19), TypeScript, TailwindCSS
- **백엔드**: FastAPI (Python)
- **MCP 서버**: 이메일 처리 및 AI 도구 관리
- **AI 통합**: OpenAI API 연동

## 레포지토리 구성

- `/01.frontend` - 사용자 인터페이스 (OpenAI API 키 입력, 채팅 UI)
- `/02.backend` - 핵심 API 서버 (OpenAI 통신, MCP 연동)
- `/03.mcp-server` - Gmail MCP 서버 (이메일 데이터 처리)
- `/00.docs` - 프로젝트 문서 및 개발 명세서

## 개발 로드맵

- [x] 프론트엔드 개발 - API 키 입력 모달 + Chat UI (4/29)
- [ ] 백엔드 개발 - OpenAI + MCP 연동 ~~(4/30)~~ - 지연 (5/2)
- [ ] Gmail MCP 개발 ~~(5/1)~~ - 지연 (5/3)
- [ ] 서비스 통합 및 테스트 ~~(5/2)~~ - 지연 (5/4)

## 시작하기

### 프론트엔드 실행

```bash
cd 01.frontend
pnpm install
pnpm run dev
```

### 백엔드 실행

```bash
cd 02.backend
uv venv
uv pip install -r requirements.txt
source .venv/bin/activate  # Windows: .venv\Scripts\activate
python run.py
```

## 라이선스

MIT License
