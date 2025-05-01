from fastapi import APIRouter

from app.api.endpoints import agent

api_router = APIRouter()

# 에이전트 엔드포인트 등록
api_router.include_router(agent.router, prefix="/agent", tags=["agent"])
