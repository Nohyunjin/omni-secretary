import uvicorn

from app.core.config import settings

if __name__ == "__main__":
    # FastAPI 애플리케이션 실행
    uvicorn.run(
        "app.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=True,  # 개발 모드에서 코드 변경 시 자동 리로드
    )
