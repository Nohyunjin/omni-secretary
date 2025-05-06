import asyncio
import platform
import sys

import uvicorn
from loguru import logger

if __name__ == "__main__":
    # 중요: Windows에서 ProactorEventLoop 설정 (서브프로세스 지원에 필수)
    if sys.platform.startswith("win"):
        try:
            # Windows에서 ProactorEventLoop 설정
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
            # 설정 확인
            policy = asyncio.get_event_loop_policy()
            logger.info(f"Windows 환경 감지: {policy.__class__.__name__} 사용 설정됨")

            # 새 이벤트 루프 생성 (이 방식이 확실합니다)
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            logger.info(f"새 이벤트 루프 생성됨: {loop.__class__.__name__}")
        except Exception as e:
            logger.error(f"이벤트 루프 설정 오류: {e}")

    # app.main에서 FastAPI 앱 인스턴스를 가져옵니다
    try:
        from app.main import app
    except ImportError:
        logger.error("FastAPI 앱 인스턴스를 app.main에서 찾을 수 없습니다.")
        raise

    # 설정에서 호스트 및 포트 가져오기
    try:
        from app.core.config import settings

        host = settings.API_HOST
        port = settings.API_PORT
        logger.info(f"Uvicorn 서버 시작 예정: 호스트={host}, 포트={port}")
    except ImportError:
        logger.warning(
            "app.core.config 모듈을 찾을 수 없어 기본 호스트/포트 사용: 0.0.0.0:8000"
        )
        host = "0.0.0.0"
        port = 8000

    # Uvicorn 서버 실행 (Windows에서는 ProactorEventLoop 사용을 위해 설정 추가)
    if sys.platform.startswith("win"):
        uvicorn.run(
            app,
            host=host,
            port=port,
            loop="asyncio",  # ProactorEventLoop 사용
            limit_concurrency=10,  # 동시 연결 제한
            workers=1,  # Windows에서는 다중 워커 사용 시 문제가 발생할 수 있으므로 1로 제한
        )
    else:
        # Unix/Linux/Mac에서는 기본 설정 사용
        uvicorn.run(app, host=host, port=port)
