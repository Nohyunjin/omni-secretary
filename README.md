# Omni Secretary

개인 비서 AI 시스템입니다. Gmail, 캘린더 등 다양한 서비스와 연동하여 작업을 자동화합니다.

## 시스템 구성

- **프론트엔드**: React 기반 웹 애플리케이션 (01.frontend)
- **백엔드**: FastAPI 기반 백엔드 서버 (02.backend)
- **MCP 서버**: Model-Control-Panel 서버, 외부 서비스와의 연동 담당 (03.mcp-server)

## 설치 방법

### 1. 프론트엔드

```bash
cd 01.frontend
pnpm install
```

### 2. 백엔드

```bash
cd 02.backend
uv venv
source .venv/bin/activate  # Windows에서는: .venv\Scripts\activate
uv pip install -r requirements.txt
```

### 3. MCP 서버

```bash
cd 03.mcp-server/gmail-mcp
npm install
```

## 실행 방법

### 개별 실행:

1. **프론트엔드**:

```bash
cd 01.frontend
pnpm run build
pnpm start
```

2. **백엔드**:

```bash
cd 02.backend
uv run run.py
```

## Gmail 인증 설정

Gmail API를 사용하기 위해서는 OAuth2 인증이 필요합니다:

1. 백엔드와 MCP 서버가 실행 중인지 확인합니다.
2. 다음 URL에 접속하여 인증 프로세스를 시작합니다:

```
http://localhost:8000/gmail/start-auth
```

3. 반환된 URL을 브라우저에서 열고 Google 계정으로 로그인합니다.
4. 인증이 완료되면 자동으로 콜백 URL로 리디렉션됩니다.

## API 엔드포인트

### 백엔드 API

- **상태 확인**: `GET http://localhost:8000/`
- **에이전트 실행**: `POST http://localhost:8000/api/v1/agent/run`
- **Gmail 인증 시작**: `GET http://localhost:8000/gmail/start-auth`
- **Gmail 인증 상태 확인**: `GET http://localhost:8000/gmail/auth-status`

### MCP 서버 API

- **상태 확인**: `GET http://localhost:3200/status`
- **도구 목록**: `GET http://localhost:3200/tools`
- **도구 실행**: `POST http://localhost:3200/execute`

## 문제 해결

- **포트 충돌**: 다른 애플리케이션이 사용 중인 포트가 있는 경우, 설정 파일에서 포트 번호를 변경하세요.
- **인증 오류**: OAuth 인증 중 오류가 발생하면 로그를 확인하고 인증 과정을 다시 시도하세요.
- **연결 오류**: MCP 서버와 백엔드 간의 연결이 실패하면 양쪽 서버가 모두 실행 중인지 확인하세요.

## 라이선스

MIT License
