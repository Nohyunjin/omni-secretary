import asyncio
from typing import Any, Dict, List, Optional

from app.services.mcp_client import mcp_client_manager
from fastapi import APIRouter, BackgroundTasks, Body, HTTPException, Path, Query
from pydantic import BaseModel, Field

router = APIRouter()


class ToolSchema(BaseModel):
    """도구 스키마 정보"""

    name: str = Field(..., description="도구 이름")
    description: Optional[str] = Field(None, description="도구 설명")
    inputSchema: Dict[str, Any] = Field(..., description="입력 스키마")


class ExecuteToolRequest(BaseModel):
    """도구 실행 요청"""

    args: Dict[str, Any] = Field(..., description="도구 실행 인자")


class ExecuteToolResponse(BaseModel):
    """도구 실행 응답"""

    success: bool = Field(..., description="성공 여부")
    result: Any = Field(..., description="실행 결과 또는 오류 메시지")


@router.get("/servers", response_model=List[str])
async def list_servers():
    """사용 가능한 MCP 서버 목록 조회"""
    from app.core.config import settings

    # 설정에서 서버 이름 추출
    server_names = list(settings.MCP_SERVERS.keys())
    return server_names


@router.get("/servers/{server_name}/status")
async def get_server_status(server_name: str = Path(..., description="MCP 서버 이름")):
    """특정 MCP 서버의 연결 상태 조회"""
    # 설정에서 서버 존재 여부 확인
    from app.core.config import settings

    if server_name not in settings.MCP_SERVERS:
        raise HTTPException(
            status_code=404, detail=f"MCP 서버 '{server_name}'가 존재하지 않습니다"
        )

    # 현재 연결 상태 확인
    is_connected = server_name in mcp_client_manager.clients

    return {
        "name": server_name,
        "connected": is_connected,
        "tools_count": (
            len(mcp_client_manager.clients[server_name].tools) if is_connected else 0
        ),
    }


@router.post("/servers/{server_name}/connect")
async def connect_to_server(server_name: str = Path(..., description="MCP 서버 이름")):
    """특정 MCP 서버에 연결"""
    # 설정에서 서버 존재 여부 확인
    from app.core.config import settings

    if server_name not in settings.MCP_SERVERS:
        raise HTTPException(
            status_code=404, detail=f"MCP 서버 '{server_name}'가 존재하지 않습니다"
        )

    # 서버에 연결 시도
    success = await mcp_client_manager.connect_to_server(server_name)
    if not success:
        raise HTTPException(
            status_code=500, detail=f"MCP 서버 '{server_name}'에 연결할 수 없습니다"
        )

    return {
        "status": "connected",
        "message": f"MCP 서버 '{server_name}'에 연결되었습니다",
    }


@router.get("/servers/{server_name}/tools", response_model=List[ToolSchema])
async def list_tools(server_name: str = Path(..., description="MCP 서버 이름")):
    """MCP 서버의 도구 목록 조회"""
    # 설정에서 서버 존재 여부 확인
    from app.core.config import settings

    if server_name not in settings.MCP_SERVERS:
        raise HTTPException(
            status_code=404, detail=f"MCP 서버 '{server_name}'가 존재하지 않습니다"
        )

    # 도구 목록 가져오기
    tools = await mcp_client_manager.get_tools(server_name)
    if not tools:
        raise HTTPException(
            status_code=404,
            detail=f"MCP 서버 '{server_name}'에서 도구를 가져올 수 없습니다",
        )

    return tools


@router.post(
    "/servers/{server_name}/tools/{tool_name}/execute",
    response_model=ExecuteToolResponse,
)
async def execute_tool(
    server_name: str = Path(..., description="MCP 서버 이름"),
    tool_name: str = Path(..., description="실행할 도구 이름"),
    request: ExecuteToolRequest = Body(..., description="도구 실행 인자"),
):
    """MCP 서버의 도구 실행"""
    # 설정에서 서버 존재 여부 확인
    from app.core.config import settings

    if server_name not in settings.MCP_SERVERS:
        raise HTTPException(
            status_code=404, detail=f"MCP 서버 '{server_name}'가 존재하지 않습니다"
        )

    # 도구 실행
    success, result = await mcp_client_manager.execute_tool(
        server_name, tool_name, request.args
    )

    return ExecuteToolResponse(success=success, result=result)
