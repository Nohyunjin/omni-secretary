import asyncio
import json
import os
import traceback
from typing import Any, Dict, List, Optional, Tuple

import httpx
from app.core.config import settings
from app.services.mcp_service import mcp_server_manager
from dotenv import load_dotenv
from loguru import logger
from openai import AsyncOpenAI

# 환경 변수 로드
load_dotenv()


class AgentService:
    """AI 에이전트 서비스"""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AgentService, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        pass

    async def process_with_openai(
        self,
        user_input: str,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        message_history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """OpenAI API를 사용하여 사용자 입력 처리"""
        if not api_key:
            # 환경 변수에서 API 키 가져오기 (백업용)
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                logger.error("OpenAI API 키가 제공되지 않았습니다")
                return "OpenAI API 키가 필요합니다. 설정에서 API 키를 제공해주세요."

        # 사용할 모델 결정
        model_name = model or settings.DEFAULT_MODEL

        # API 키로 OpenAI 클라이언트 초기화
        openai_client = AsyncOpenAI(api_key=api_key)

        try:
            # MCP 서버에서 사용 가능한 도구 목록 가져오기
            try:
                all_tools = await mcp_server_manager.get_all_tools()

                # 도구 목록을 OpenAI 형식으로 변환
                available_tools = []

                # 모든 MCP 서버의 도구를 추가
                for server_name, tools in all_tools.items():
                    logger.info(f"{server_name} 서버에서 도구 {len(tools)}개 발견")
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
                            logger.error(
                                f"도구 '{tool.get('name')}' 변환 오류: {str(e)}"
                            )

                # 도구 목록이 없으면 빈 배열 반환
                if not available_tools:
                    logger.warning("사용 가능한 MCP 도구가 없습니다.")
                    # all_tools가 비어 있는지 확인
                    if not all_tools:
                        logger.warning("all_tools가 비어 있습니다")
                    else:
                        # 서버별 도구 개수 로깅
                        for server_name, tools in all_tools.items():
                            logger.warning(f"{server_name} 서버 도구 수: {len(tools)}")
            except Exception as e:
                logger.error(f"MCP 도구 목록 가져오기 실패: {str(e)}")
                available_tools = []

            logger.info(f"사용 가능한 도구: {len(available_tools)}개")

            # 메시지 배열 초기화
            system_message = {
                "role": "system",
                "content": "당신은 유용한 비서 역할을 하는 AI입니다. 사용자의 질문에 최대한 도움이 되도록 답변해주세요.",
            }

            # 기본 메시지 배열 구성
            messages = [system_message]

            # 이전 메시지 기록이 있으면 추가
            if message_history and len(message_history) > 0:
                logger.info(f"이전 메시지 기록 {len(message_history)}개 추가")
                messages.extend(message_history)

            # 현재 사용자 쿼리 추가
            messages.append({"role": "user", "content": user_input})

            # 도구가 없으면 일반 응답만 생성
            if not available_tools:
                # 일반 응답 생성
                response = await openai_client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    max_tokens=1000,
                )
                answer = (
                    response.choices[0].message.content or "응답을 생성할 수 없습니다."
                )
                logger.info(f"일반 응답: {answer[:100]}...")
                return answer

            # 도구를 사용하는 경우, 시스템 프롬프트 수정
            messages[0] = {
                "role": "system",
                "content": "당신은 유용한 비서 역할을 하는 AI입니다. 필요한 경우 적절한 도구를 사용해서 사용자를 도와주세요.",
            }

            # 초기 OpenAI API 호출
            response = await openai_client.chat.completions.create(
                model=model_name,
                messages=messages,
                tools=available_tools,
                tool_choice="auto",
                max_tokens=1000,
            )

            # 도구 호출이 있는지 확인
            assistant_message = response.choices[0].message
            if assistant_message.tool_calls:
                # 메시지 배열 재구성 (이미 이전 대화 내용 포함)
                tool_messages = messages.copy()

                # 어시스턴트 메시지를 원본 그대로 (tool_calls 포함) 추가
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

                tool_messages.append(assistant_dict)

                # 각 도구 호출에 대해 처리
                for tool_call in assistant_message.tool_calls:
                    function_name = tool_call.function.name
                    function_args = tool_call.function.arguments

                    # JSON 문자열을 파이썬 딕셔너리로 변환
                    try:
                        args_dict = json.loads(function_args)
                    except json.JSONDecodeError:
                        args_dict = {}

                    logger.info(f"도구 {function_name} 호출 (인자: {args_dict})")

                    # 도구 실행
                    result = None

                    # 기본 에코 도구는 직접 처리
                    if function_name == "echo":
                        result = args_dict.get("text", "")
                    else:
                        # MCP 서버에서 도구 찾기
                        server_name, tool_info = mcp_server_manager.find_tool(
                            function_name
                        )

                        if server_name:
                            # MCP 서버를 통해 도구 실행
                            try:
                                success, result = await mcp_server_manager.execute_tool(
                                    server_name, function_name, args_dict
                                )
                                # 성공하지 않았으면 오류 메시지 사용
                                if not success:
                                    logger.warning(
                                        f"도구 '{function_name}' 실행 실패: {result}"
                                    )
                            except Exception as e:
                                logger.error(
                                    f"도구 '{function_name}' 실행 오류: {str(e)}"
                                )
                                result = f"도구 실행 오류: {str(e)}"
                        else:
                            result = f"사용할 수 없는 도구: {function_name}"

                    # 결과를 OpenAI에 다시 전달
                    tool_messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "name": function_name,
                            "content": str(result),
                        }
                    )

                # 도구 결과를 바탕으로 최종 응답 생성
                logger.info(f"최종 응답을 위한 메시지: {len(tool_messages)}개")
                final_response = await openai_client.chat.completions.create(
                    model=model_name, messages=tool_messages, max_tokens=1000
                )

                final_answer = (
                    final_response.choices[0].message.content
                    or "응답을 생성할 수 없습니다."
                )
                logger.info(f"최종 응답: {final_answer[:100]}...")
                return final_answer
            else:
                # 도구 호출이 없는 경우 바로 응답 반환
                answer = assistant_message.content or "응답을 생성할 수 없습니다."
                logger.info(f"도구 없는 응답: {answer[:100]}...")
                return answer

        except Exception as e:
            logger.error(f"처리 중 오류 발생: {str(e)}")
            logger.error(f"상세 오류: {traceback.format_exc()}")
            return f"처리 중 오류가 발생했습니다: {str(e)}"


# 에이전트 서비스 인스턴스
agent_service = AgentService()


async def process_user_input(
    user_input: str,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
    message_history: Optional[List[Dict[str, str]]] = None,
) -> str:
    """
    사용자 입력을 받아 처리하는 함수

    Args:
        user_input: 사용자 질문 또는 요청
        api_key: OpenAI API 키 (옵션)
        model: 사용할 모델 이름 (옵션)
        message_history: 이전 메시지 기록 (멀티턴 대화를 위해 사용)
    """
    try:
        # OpenAI로 처리
        response_text = await agent_service.process_with_openai(
            user_input, api_key, model, message_history
        )
        return response_text
    except Exception as e:
        logger.error(f"처리 중 오류 발생: {str(e)}")
        return f"처리 중 오류가 발생했습니다: {str(e)}"
