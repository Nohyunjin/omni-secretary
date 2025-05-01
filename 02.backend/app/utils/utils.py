from datetime import datetime, timedelta

import httpx
from app.core.config import settings
from app.utils.logger import get_logger

log = get_logger("utils")


async def call_mcp_server(task_name: str, input_data: dict) -> dict:
    """
    MCP 서버에 Task 요청을 보내고 결과를 받아오는 함수.
    """
    url = f"{settings.MCP_SERVER_URL}/v1/tasks/{task_name}"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=input_data)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        log.error(f"MCP 서버 호출 실패: {str(e)}")
        raise RuntimeError(f"MCP 서버 호출 실패: {str(e)}")


def calculate_departure_time(arrival_time_iso: str, duration_minutes: int) -> str:
    """
    도착 시간과 소요 시간으로 출발 시간을 계산하는 함수.
    """
    arrival_time = datetime.fromisoformat(arrival_time_iso)
    departure_time = arrival_time - timedelta(minutes=duration_minutes)
    return departure_time.isoformat()
