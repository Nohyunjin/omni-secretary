from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.endpoints import agent

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

# API 라우터 등록
app.include_router(agent.router, prefix="/api/v1/agent", tags=["agent"])


@app.get("/")
async def root():
    """
    루트 엔드포인트 - API 상태 확인
    """
    return {"status": "online", "message": "Omni Secretary API is running"}
