from app.api.v1.endpoints import agent, mcp, oauth
from fastapi import APIRouter

api_router = APIRouter()

# 에이전트 엔드포인트 등록
api_router.include_router(agent.router, prefix="/agent", tags=["agent"])
# MCP 엔드포인트 등록
api_router.include_router(mcp.router, prefix="/mcp", tags=["mcp"])
# OAuth 엔드포인트 등록
api_router.include_router(oauth.router, prefix="/oauth", tags=["oauth"])
