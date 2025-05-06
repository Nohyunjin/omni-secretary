import asyncio
import sys

from app.api.api_list import api_router
from app.core.config import settings
from app.services.mcp_client import cleanup_mcp_clients, initialize_mcp_clients
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

# Windows 환경에서 서브프로세스 생성을 위해 ProactorEventLoop 설정
if sys.platform.startswith("win"):
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        logger.info("Windows 환경 감지: ProactorEventLoop 정책 설정됨 (main.py)")
    except Exception as e:
        logger.warning(f"ProactorEventLoop 설정 중 오류 발생: {e}")

app = FastAPI(
    title="Omni Secretary API", description="개인 비서 AI API", version="0.1.0"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프로덕션 환경에서는 명확한 오리진 지정
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 등록 - api.py에서 정의한 라우터 사용
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    """
    루트 엔드포인트 - API 상태 확인
    """
    # 현재 이벤트 루프 타입 확인
    current_loop = asyncio.get_running_loop()
    loop_type = current_loop.__class__.__name__

    # MCP 클라이언트 상태 확인
    from app.services.mcp_client import mcp_client_manager

    mcp_clients_count = len(mcp_client_manager.clients)

    return {
        "status": "online",
        "message": "Omni Secretary API is running",
        "version": "0.1.0",
        "mcp_servers_count": len(settings.MCP_SERVERS),
        "mcp_clients_connected": mcp_clients_count,
        "event_loop_type": loop_type,
    }


# 애플리케이션 시작 시 초기화
@app.on_event("startup")
async def startup_event():
    """애플리케이션이 시작될 때 초기화 작업을 수행합니다."""
    # MCP 클라이언트 초기화
    await initialize_mcp_clients()

    logger.info("Omni Secretary API 시작 완료")


# 애플리케이션 종료 시 정리
@app.on_event("shutdown")
async def shutdown_event():
    """애플리케이션이 종료될 때 정리 작업을 수행합니다."""
    # MCP 클라이언트 정리
    await cleanup_mcp_clients()

    logger.info("Omni Secretary API 종료 완료")
