# 🔧 Backend

OmniSecretary의 핵심 비즈니스 로직과 API 서버를 담당하는 백엔드 디렉토리입니다.

## 기술 스택

FastAPI : Python 비동기 웹 프레임워크

uvicorn : ASGI 서버

httpx : 비동기 HTTP 클라이언트

pydantic : 데이터 검증 및 설정 관리

loguru : 로깅

uv : 빠른 패키지 및 가상환경 관리

## 주요 기능

- 사용자 요청 처리
- 에이전트와 MCP 서버 간 통신
- 외부 API 연동 및 데이터 가공

## 프로젝트 구조

📦02.backend  
┣ 📂app  
┃ ┣ 📂api  
┃ ┃ ┗ 📂v1  
┃ ┃ ┃ ┗ 📂endpoints  
┃ ┃ ┃ ┃ ┗ 📜agent.py  
┃ ┣ 📂core  
┃ ┃ ┗ 📜config.py  
┃ ┣ 📂schemas  
┃ ┃ ┗ 📜agent.py  
┃ ┣ 📂services\  
 ┃ ┃ ┗ 📜agent_service.py  
┃ ┣ 📂utils  
┃ ┃ ┣ 📜logger.py  
┃ ┃ ┗ 📜utils.py  
┃ ┗ 📜main.py  
┣ 📂tests  
┣ 📜README.md  
┗ 📜requirements.txt

## 실행 방법

### 1. 가상 환경 생성

```
cd backend
uv venv
```

### 2. 패키지 설치

```
uv pip install -r requirements.txt
```

### 3. 가상환경 활성화

```
source .venv/bin/activate
```

### 4. 서버 실행

```
uvicorn app.main:app --reload
```
