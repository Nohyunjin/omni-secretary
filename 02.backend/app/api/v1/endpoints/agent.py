import asyncio
import json
from typing import Any, AsyncGenerator, Dict, List, Optional

from app.core.config import settings
from app.services.agent_service import process_user_input
from app.services.mcp_service import (
    cleanup_mcp_servers,
    initialize_mcp_servers,
    mcp_server_manager,
)
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from loguru import logger
from openai import AsyncOpenAI
from openai.types.chat import (
    ChatCompletionAssistantMessageParam,
    ChatCompletionMessageParam,
    ChatCompletionSystemMessageParam,
    ChatCompletionUserMessageParam,
)
from pydantic import BaseModel, Field

router = APIRouter()


class UserQuery(BaseModel):
    text: str
    api_key: Optional[str] = Field(None, description="OpenAI API 키", exclude=True)
    stream: Optional[bool] = False
    model: Optional[str] = Field(
        None, description="사용할 모델 (기본값: DEFAULT_MODEL)"
    )
    messageHistory: Optional[List[Dict[str, str]]] = Field(
        [], description="이전 메시지 기록 (멀티턴 대화를 위해 사용)"
    )

    class Config:
        # API 키가 문서와 로그에 노출되지 않도록 설정
        schema_extra = {
            "example": {
                "text": "내일 서울 날씨는 어때?",
                "api_key": "sk-...",
                "stream": False,
                "model": "gpt-4",
                "messageHistory": [
                    {"role": "user", "content": "안녕하세요"},
                    {
                        "role": "assistant",
                        "content": "안녕하세요! 무엇을 도와드릴까요?",
                    },
                ],
            }
        }


class MCPServerRequest(BaseModel):
    name: str
    config: Dict[str, Any]


async def generate_openai_stream(
    text: str,
    api_key: str,
    model: Optional[str] = None,
    message_history: Optional[List[Dict[str, str]]] = None,
) -> AsyncGenerator[str, None]:
    """OpenAI API를 사용하여 스트리밍 응답을 생성합니다. SSE 형식으로 반환합니다."""
    try:
        client = AsyncOpenAI(api_key=api_key)
        model_name = model or settings.DEFAULT_MODEL

        # 시스템 메시지와 이전 대화 기록을 포함한 메시지 배열 구성
        messages: List[ChatCompletionMessageParam] = [
            ChatCompletionSystemMessageParam(
                role="system",
                content="당신은 유용한 비서 역할을 하는 AI입니다.",
            )
        ]

        # 이전 메시지 기록이 있으면 변환하여 추가
        if message_history and len(message_history) > 0:
            for msg in message_history:
                if msg["role"] == "user":
                    messages.append(
                        ChatCompletionUserMessageParam(
                            role="user", content=msg["content"]
                        )
                    )
                elif msg["role"] == "assistant":
                    messages.append(
                        ChatCompletionAssistantMessageParam(
                            role="assistant", content=msg["content"]
                        )
                    )

        # 현재 사용자 쿼리 추가
        messages.append(ChatCompletionUserMessageParam(role="user", content=text))

        stream = await client.chat.completions.create(
            model=model_name,
            messages=messages,
            max_tokens=1000,
            stream=True,
        )

        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                content = chunk.choices[0].delta.content
                # SSE 형식으로 데이터 전송, ensure_ascii=False로 한글 원본 전송
                event_data = json.dumps({"content": content}, ensure_ascii=False)
                yield f"data: {event_data}"

        # 스트림 종료 이벤트 전송
        yield f"data: {json.dumps({'content': '', 'finish_reason': 'stop'}, ensure_ascii=False)}"
    except Exception as e:
        error_msg = str(e)
        if api_key and api_key in error_msg:
            error_msg = error_msg.replace(api_key, "[API_KEY]")
        yield f"data: {json.dumps({'error': error_msg}, ensure_ascii=False)}"


async def generate_openai_stream_with_mcp(
    text: str,
    api_key: str,
    model: Optional[str] = None,
    message_history: Optional[List[Dict[str, str]]] = None,
) -> AsyncGenerator[str, None]:
    """OpenAI API와 MCP 도구를 사용하여 스트리밍 응답을 생성합니다. SSE 형식으로 반환합니다."""
    try:
        client = AsyncOpenAI(api_key=api_key)
        model_name = model or settings.DEFAULT_MODEL

        # 반복 제어 변수
        max_iterations = 10  # 최대 도구 호출 반복 횟수
        iteration = 0

        # MCP 서버에서 사용 가능한 도구 목록 가져오기
        all_tools = await mcp_server_manager.get_all_tools()
        available_tools = []

        # 모든 MCP 서버의 도구를 추가
        for server_name, tools in all_tools.items():
            logger.info(
                f"스트리밍 모드: {server_name} 서버에서 도구 {len(tools)}개 발견"
            )
            for tool in tools:
                try:
                    # 도구 스키마 변환
                    schema = tool.get("inputSchema", {})
                    available_tools.append(
                        {
                            "type": "function",
                            "function": {
                                "name": tool.get("name"),
                                "description": tool.get("description", ""),
                                "parameters": schema,
                            },
                        }
                    )
                except Exception as e:
                    logger.error(f"도구 '{tool.get('name')}' 변환 오류: {str(e)}")

        logger.info(f"스트리밍 모드: 사용 가능한 도구 {len(available_tools)}개")

        # 시스템 메시지와 이전 대화 기록을 포함한 메시지 배열 구성
        messages: List[ChatCompletionMessageParam] = [
            ChatCompletionSystemMessageParam(
                role="system",
                content="당신은 유용한 비서 역할을 하는 AI입니다. 사용자의 요청을 해결하기 위해 적절한 도구를 필요한 만큼 사용하세요. 복잡한 작업은 여러 도구를 순차적으로 사용하여 해결할 수 있습니다. 도구 사용이 필요 없다면 바로 응답하세요.",
            )
        ]

        # 이전 메시지 기록이 있으면 변환하여 추가
        if message_history and len(message_history) > 0:
            logger.info(f"이전 메시지 기록 {len(message_history)}개 추가")
            for msg in message_history:
                if msg["role"] == "user":
                    messages.append(
                        ChatCompletionUserMessageParam(
                            role="user", content=msg["content"]
                        )
                    )
                elif msg["role"] == "assistant":
                    messages.append(
                        ChatCompletionAssistantMessageParam(
                            role="assistant", content=msg["content"]
                        )
                    )

        # 현재 사용자 쿼리 추가
        messages.append(ChatCompletionUserMessageParam(role="user", content=text))

        # 도구가 없는 경우 일반 스트리밍 응답 생성
        if not available_tools:
            logger.warning(
                "사용 가능한 MCP 도구가 없어 일반 스트리밍 응답을 생성합니다."
            )
            stream = await client.chat.completions.create(
                model=model_name,
                messages=messages,
                max_tokens=1000,
                stream=True,
            )

            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    event_data = json.dumps({"content": content}, ensure_ascii=False)
                    yield f"data: {event_data}"

            yield f"data: {json.dumps({'content': '', 'finish_reason': 'stop'}, ensure_ascii=False)}"
            return

        # AI가 작업을 완료할 때까지 도구 호출 루프 실행
        while iteration < max_iterations:
            # AI에게 현재 상태를 전달하고 다음 행동 결정 요청
            response = await client.chat.completions.create(
                model=model_name,
                messages=messages,  # type: ignore
                tools=available_tools,
                tool_choice="auto",
                max_tokens=1000,
            )

            # 도구 호출이 없으면 최종 응답으로 간주하고 스트리밍
            if not response.choices[0].message.tool_calls:
                # 최종 응답 내용 스트리밍
                assistant_message = response.choices[0].message.content or ""

                # 첫 번째 반복이 아닌 경우에만 구분선 표시
                if iteration > 0:
                    yield f"data: {json.dumps({'content': '최종 응답:'}, ensure_ascii=False)}"

                # 응답을 작은 청크로 나눠서 스트리밍
                chunk_size = 20
                for i in range(0, len(assistant_message), chunk_size):
                    chunk = assistant_message[i : i + chunk_size]
                    event_data = json.dumps({"content": chunk}, ensure_ascii=False)
                    yield f"data: {event_data}"
                    await asyncio.sleep(0.01)  # 스트리밍 효과를 위한 작은 지연

                yield f"data: {json.dumps({'content': '', 'finish_reason': 'stop'}, ensure_ascii=False)}"
                return

            # 도구 호출이 있는 경우 처리
            assistant_message = response.choices[0].message
            assistant_dict = {
                "role": "assistant",
                "content": assistant_message.content or "",
            }

            # tool_calls 정보 추가
            if assistant_message.tool_calls:
                assistant_dict["tool_calls"] = [
                    {
                        "id": tool_call.id,
                        "type": "function",
                        "function": {
                            "name": tool_call.function.name,
                            "arguments": tool_call.function.arguments,
                        },
                    }
                    for tool_call in assistant_message.tool_calls
                ]

            messages.append(assistant_dict)  # type: ignore

            # 첫 반복이거나 이전 반복에서도 도구를 사용한 경우의 메시지 표시
            if iteration == 0:
                yield f"data: {json.dumps({'content': '🔍 요청을 처리하기 위해 도구를 사용합니다...'}, ensure_ascii=False)}"
            else:
                yield f"data: {json.dumps({'content': f'🔄 추가 정보가 필요하여 도구를 다시 사용합니다({iteration+1}/{max_iterations})...'}, ensure_ascii=False)}"

            # 각 도구 호출에 대해 처리
            for tool_call in assistant_message.tool_calls:
                function_name = tool_call.function.name
                function_args = tool_call.function.arguments

                # JSON 문자열을 파이썬 딕셔너리로 변환
                try:
                    args_dict = json.loads(function_args)
                except json.JSONDecodeError:
                    args_dict = {}

                # 사용자에게 도구 호출 정보 표시
                yield f"data: {json.dumps({'content': f'🧰 도구 사용: {function_name}'}, ensure_ascii=False)}"
                logger.info(f"도구 {function_name} 호출 (인자: {args_dict})")

                # 도구 실행
                result = None

                # 기본 에코 도구는 직접 처리
                if function_name == "echo":
                    result = args_dict.get("text", "")
                else:
                    # MCP 서버에서 도구 찾기
                    server_name, tool_info = mcp_server_manager.find_tool(function_name)

                    if server_name:
                        # MCP 서버를 통해 도구 실행
                        try:
                            success, result = await mcp_server_manager.execute_tool(
                                server_name, function_name, args_dict
                            )
                            if not success:
                                logger.warning(
                                    f"도구 '{function_name}' 실행 실패: {result}"
                                )
                                yield f"data: {json.dumps({'content': f'⚠️ 도구 실행 실패: {result}'}, ensure_ascii=False)}"
                        except Exception as e:
                            logger.error(f"도구 '{function_name}' 실행 오류: {str(e)}")
                            result = f"도구 실행 오류: {str(e)}"
                            yield f"data: {json.dumps({'content': f'⚠️ 도구 실행 오류: {str(e)}'}, ensure_ascii=False)}"
                    else:
                        result = f"사용할 수 없는 도구: {function_name}"
                        yield f"data: {json.dumps({'content': f'⚠️ 사용할 수 없는 도구: {function_name}'}, ensure_ascii=False)}"

                # 결과를 메시지에 추가
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "name": function_name,
                        "content": str(result),
                    }
                )  # type: ignore

                # 도구 실행 결과 요약을 사용자에게 표시 (너무 길면 축약)
                result_str = str(result)
                if len(result_str) > 100:
                    short_result = result_str[:100] + "... (결과 축약됨)"
                    yield f"data: {json.dumps({'content': f'📋 결과: {short_result}'}, ensure_ascii=False)}"
                else:
                    yield f"data: {json.dumps({'content': f'📋 결과: {result_str}'}, ensure_ascii=False)}"

            # 다음 반복으로
            iteration += 1

        # 최대 반복 횟수 도달 시
        if iteration >= max_iterations:
            yield f"data: {json.dumps({'content': f'⚠️ 최대 도구 호출 횟수({max_iterations}회)에 도달했습니다. 최종 응답을 생성합니다.'}, ensure_ascii=False)}"

            # 최종 응답 생성
            final_response = await client.chat.completions.create(
                model=model_name,
                messages=messages,  # type: ignore
                max_tokens=1000,
            )

            final_answer = (
                final_response.choices[0].message.content
                or "응답을 생성할 수 없습니다."
            )
            yield f"data: {json.dumps({'content': f'{final_answer}'}, ensure_ascii=False)}"
            yield f"data: {json.dumps({'content': '', 'finish_reason': 'stop'}, ensure_ascii=False)}"

    except Exception as e:
        error_msg = str(e)
        if api_key and api_key in error_msg:
            error_msg = error_msg.replace(api_key, "[API_KEY]")
        logger.error(f"스트리밍 MCP 응답 생성 오류: {error_msg}")
        yield f"data: {json.dumps({'error': error_msg}, ensure_ascii=False)}"


@router.post("/query")
async def query_agent(query: UserQuery):
    """
    에이전트에 쿼리를 보내고 응답을 받는 엔드포인트.

    stream=True일 경우에도 MCP 도구를 사용합니다.
    """
    try:
        if not query.api_key:
            raise HTTPException(status_code=400, detail="OpenAI API 키가 필요합니다")

        # 스트림 모드와 관계없이 process_user_input을 사용해 응답 생성
        # (내부적으로 MCP 도구 활용)
        response = await process_user_input(
            query.text, query.api_key, query.model, message_history=query.messageHistory
        )

        # 응답 형식만 스트림 여부에 따라 다르게 처리
        if query.stream:
            # 생성된 전체 응답을 스트리밍 형식으로 반환
            async def stream_response():
                # 응답을 적절한 크기로 나누어 스트리밍 (예: 10자씩)
                chunk_size = 10
                for i in range(0, len(response), chunk_size):
                    chunk = response[i : i + chunk_size]
                    event_data = json.dumps({"content": chunk}, ensure_ascii=False)
                    yield f"data: {event_data}"
                    # 실제 스트리밍 효과를 위한 작은 지연
                    await asyncio.sleep(0.05)

                # 스트림 종료 이벤트 전송
                yield f"data: {json.dumps({'content': '', 'finish_reason': 'stop'}, ensure_ascii=False)}"

            return StreamingResponse(
                stream_response(),
                media_type="text/event-stream",
            )
        else:
            # 일반 JSON 응답
            logger.info(f"에이전트 응답: {response[:100]}...")
            return JSONResponse({"response": response})

    except Exception as e:
        # 오류 메시지에 API 키가 포함되지 않도록 주의
        error_msg = str(e)
        if query.api_key and query.api_key in error_msg:
            error_msg = error_msg.replace(query.api_key, "[API_KEY]")
        raise HTTPException(status_code=500, detail=error_msg)


@router.get("/mcp/servers")
async def get_mcp_servers():
    """MCP 서버 목록 조회"""
    try:
        status = await mcp_server_manager.get_all_server_status()
        return JSONResponse(
            {
                "servers": status,
                "config": settings.MCP_SERVERS,
            }
        )
    except Exception as e:
        logger.error(f"MCP 서버 목록 조회 중 오류 발생: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mcp/servers/{server_name}/start")
async def start_mcp_server(server_name: str, background_tasks: BackgroundTasks):
    """MCP 서버 시작"""
    if server_name not in settings.MCP_SERVERS:
        raise HTTPException(
            status_code=404, detail=f"서버 '{server_name}'를 찾을 수 없습니다"
        )

    # 백그라운드에서 서버 시작
    background_tasks.add_task(mcp_server_manager.start_server, server_name)
    return JSONResponse({"message": f"서버 '{server_name}' 시작 중"})


@router.post("/mcp/servers/{server_name}/stop")
async def stop_mcp_server(server_name: str):
    """MCP 서버 중지"""
    if server_name not in settings.MCP_SERVERS:
        raise HTTPException(
            status_code=404, detail=f"서버 '{server_name}'를 찾을 수 없습니다"
        )

    result = await mcp_server_manager.stop_server(server_name)
    if result:
        return JSONResponse({"message": f"서버 '{server_name}' 중지됨"})
    else:
        raise HTTPException(status_code=500, detail=f"서버 '{server_name}' 중지 실패")


@router.get("/mcp/servers/{server_name}/tools")
async def get_mcp_server_tools(server_name: str):
    """MCP 서버의 도구 목록 조회"""
    if server_name not in settings.MCP_SERVERS:
        raise HTTPException(
            status_code=404, detail=f"서버 '{server_name}'를 찾을 수 없습니다"
        )

    if server_name not in mcp_server_manager.servers:
        raise HTTPException(
            status_code=400, detail=f"서버 '{server_name}'가 실행 중이 아닙니다"
        )

    tools = mcp_server_manager.servers[server_name].get("tools", [])
    return JSONResponse({"tools": tools})


@router.post("/mcp/servers")
async def add_mcp_server(server: MCPServerRequest):
    """MCP 서버 추가"""
    if server.name in settings.MCP_SERVERS:
        raise HTTPException(
            status_code=400, detail=f"서버 '{server.name}'가 이미 존재합니다"
        )

    # 설정에 서버 추가
    settings.MCP_SERVERS[server.name] = server.config
    settings.save_config()

    return JSONResponse(
        {"message": f"서버 '{server.name}' 추가됨", "server": server.config}
    )


@router.put("/mcp/servers/{server_name}")
async def update_mcp_server(server_name: str, server: Dict[str, Any]):
    """MCP 서버 설정 업데이트"""
    if server_name not in settings.MCP_SERVERS:
        raise HTTPException(
            status_code=404, detail=f"서버 '{server_name}'를 찾을 수 없습니다"
        )

    # 실행 중인 서버 중지
    if server_name in mcp_server_manager.servers:
        await mcp_server_manager.stop_server(server_name)

    # 설정 업데이트
    settings.MCP_SERVERS[server_name] = server
    settings.save_config()

    return JSONResponse(
        {"message": f"서버 '{server_name}' 업데이트됨", "server": server}
    )


@router.delete("/mcp/servers/{server_name}")
async def delete_mcp_server(server_name: str):
    """MCP 서버 삭제"""
    if server_name not in settings.MCP_SERVERS:
        raise HTTPException(
            status_code=404, detail=f"서버 '{server_name}'를 찾을 수 없습니다"
        )

    # 실행 중인 서버 중지
    if server_name in mcp_server_manager.servers:
        await mcp_server_manager.stop_server(server_name)

    # 설정에서 서버 삭제
    del settings.MCP_SERVERS[server_name]
    settings.save_config()

    return JSONResponse({"message": f"서버 '{server_name}' 삭제됨"})


@router.get("/mcp-tools", response_model=Dict[str, Any], tags=["agent"])
async def get_mcp_tools() -> Dict[str, Any]:
    """
    사용 가능한 MCP 도구 목록을 반환합니다.
    """
    try:
        # 모든 서버 상태 조회
        servers_status = await mcp_server_manager.get_all_server_status()

        # 모든 MCP 서버의 도구 목록 조회
        all_tools = await mcp_server_manager.get_all_tools()

        # 각 서버의 상태와 도구 목록을 합침
        result = {
            "servers": servers_status,
            "tools": all_tools,
            "total_tools_count": sum(len(tools) for tools in all_tools.values()),
        }

        return result
    except Exception as e:
        logger.error(f"MCP 도구 목록 조회 중 오류: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"MCP 도구 목록 조회 중 오류: {str(e)}"
        )


@router.post("/stream")
async def stream_agent(query: UserQuery):
    """
    에이전트에 쿼리를 보내고 스트리밍 형식으로 응답을 받는 엔드포인트.
    MCP 도구가 통합된 스트리밍 응답을 직접 생성합니다.
    """
    try:
        if not query.api_key:
            raise HTTPException(status_code=400, detail="OpenAI API 키가 필요합니다")

        # 직접 스트리밍 응답 생성 (MCP 도구 활용)
        return StreamingResponse(
            generate_openai_stream_with_mcp(
                query.text,
                query.api_key,
                query.model,
                message_history=query.messageHistory,
            ),
            media_type="text/event-stream",
        )

    except Exception as e:
        # 오류 메시지에 API 키가 포함되지 않도록 주의
        error_msg = str(e)
        if query.api_key and query.api_key in error_msg:
            error_msg = error_msg.replace(query.api_key, "[API_KEY]")
        raise HTTPException(status_code=500, detail=error_msg)
