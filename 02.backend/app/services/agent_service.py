from typing import Any


# 임시 Mock LLM 응답 함수
async def mock_llm_response(user_input: str) -> str:
    """
    임시로 사용자 입력에 대해 mock 응답을 생성하는 함수.
    실제로는 MCP 서버 호출 또는 LLM API 호출로 대체할 예정.
    """
    # TODO: 실제 LLM 호출로 교체
    return (
        f"'{user_input}'에 대해 출발 시간을 계산 중입니다. 자세한 경로를 확인해 주세요."
    )


# 사용자 입력 처리 메인 함수
async def process_user_input(user_input: str) -> str:
    """
    사용자 입력을 받아 Agent 응답을 생성하는 서비스 함수.
    현재는 mock 응답을 사용하며, 추후 MCP 서버 연동 예정.
    """
    try:
        response_text = await mock_llm_response(user_input)

        return response_text
    except Exception as e:
        raise RuntimeError(f"Agent processing failed: {str(e)}")
