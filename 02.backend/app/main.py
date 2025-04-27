from app.api.v1.endpoints import agent
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def create_app() -> FastAPI:
    app = FastAPI(
        title="OmniSecretary API",
        description="Backend API server for OmniSecretary project.",
        version="1.0.0",
    )

    # CORS 설정
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # API 라우터 등록
    app.include_router(agent.router, prefix="/api/v1/agent", tags=["Agent"])

    return app


app = create_app()
