import json
from typing import AsyncGenerator, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.agent_service import mcp_manager, process_user_input

router = APIRouter()


class UserQuery(BaseModel):
    text: str
    api_key: Optional[str] = Field(None, description="OpenAI API 키", exclude=True)
    stream: Optional[bool] = False
    use_mcp: Optional[bool] = Field(True, description="MCP 서버를 사용할지 여부")
    mcp_server_path: Optional[str] = Field(None, description="MCP 서버 경로 (옵션)")

    class Config:
        # API 키가 문서와 로그에 노출되지 않도록 설정
        schema_extra = {
            "example": {
                "text": "내일 서울 날씨는 어때?",
                "api_key": "sk-...",
                "stream": False,
                "use_mcp": True,
            }
        }


async def generate_openai_stream(text: str, api_key: str) -> AsyncGenerator[str, None]:
    """OpenAI API를 사용하여 스트리밍 응답을 생성합니다. SSE 형식으로 반환합니다."""
    try:
        client = AsyncOpenAI(api_key=api_key)
        stream = await client.chat.completions.create(
            model=settings.DEFAULT_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "당신은 유용한 비서 역할을 하는 AI입니다.",
                },
                {"role": "user", "content": text},
            ],
            max_tokens=1000,
            stream=True,
        )

        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                content = chunk.choices[0].delta.content
                # SSE 형식으로 데이터 전송, ensure_ascii=False로 한글 원본 전송
                event_data = json.dumps({"content": content}, ensure_ascii=False)
                yield f"data: {event_data}\n\n"

        # 스트림 종료 이벤트 전송
        yield f"data: {json.dumps({'content': '', 'finish_reason': 'stop'}, ensure_ascii=False)}\n\n"
    except Exception as e:
        error_msg = str(e)
        if api_key and api_key in error_msg:
            error_msg = error_msg.replace(api_key, "[API_KEY]")
        yield f"data: {json.dumps({'error': error_msg}, ensure_ascii=False)}\n\n"


@router.post("/query")
async def query_agent(query: UserQuery):
    """
    에이전트에 쿼리를 보내고 응답을 받는 엔드포인트.

    - use_mcp=True일 경우 MCP 서버와 OpenAI를 사용합니다.
    - use_mcp=False일 경우 OpenAI API를 직접 호출합니다.
    - stream=True일 경우 스트리밍 응답을 반환합니다 (MCP를 사용하지 않는 경우).
    """
    try:
        # MCP 사용 케이스
        if query.use_mcp:
            # MCP 서버 경로가 지정된 경우 연결 시도
            if query.mcp_server_path:
                await mcp_manager.connect_to_server(query.mcp_server_path)

            # MCP와 OpenAI를 사용하여 처리
            response = await process_user_input(query.text)
            return JSONResponse({"response": response})

        # OpenAI API 직접 호출 케이스
        else:
            if not query.api_key:
                raise HTTPException(
                    status_code=400, detail="OpenAI API 키가 필요합니다"
                )

            if query.stream:
                # 스트리밍 응답 반환
                return StreamingResponse(
                    generate_openai_stream(query.text, query.api_key),
                    media_type="text/event-stream",
                )
            else:
                # 일반 응답 반환 - 직접 OpenAI API 호출
                client = AsyncOpenAI(api_key=query.api_key)
                response = await client.chat.completions.create(
                    model=settings.DEFAULT_MODEL,
                    messages=[
                        {
                            "role": "system",
                            "content": "당신은 유용한 비서 역할을 하는 AI입니다.",
                        },
                        {"role": "user", "content": query.text},
                    ],
                    max_tokens=1000,
                )
                content = response.choices[0].message.content
                # None 체크 추가
                if content is None:
                    content = "응답을 생성할 수 없습니다."
                return JSONResponse({"response": content})
    except Exception as e:
        # 오류 메시지에 API 키가 포함되지 않도록 주의
        error_msg = str(e)
        if query.api_key and query.api_key in error_msg:
            error_msg = error_msg.replace(query.api_key, "[API_KEY]")
        raise HTTPException(status_code=500, detail=error_msg)
