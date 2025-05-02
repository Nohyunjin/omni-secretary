import asyncio
import os
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from loguru import logger
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from openai import AsyncOpenAI

# 환경 변수 로드
load_dotenv()

# OpenAI API 키 설정
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    logger.warning("OPENAI_API_KEY가 설정되지 않았습니다")

# MCP 서버 경로 설정
MCP_SERVER_PATH = os.getenv("MCP_SERVER_PATH")


class MCPManager:
    """MCP 서버와의 통신을 관리하는 클래스"""

    _instance = None
    _initialized = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MCPManager, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if MCPManager._initialized:
            return

        self.session = None
        self.stdio = None
        self.write = None
        self.exit_stack = None
        self.tools = []
        self.openai = AsyncOpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
        self.server_connected = False

        MCPManager._initialized = True

    async def connect_to_server(self, server_path: Optional[str] = None):
        """MCP 서버에 연결"""
        from contextlib import AsyncExitStack

        if self.server_connected:
            return

        path = server_path or MCP_SERVER_PATH
        if not path:
            logger.error("MCP 서버 경로가 설정되지 않았습니다")
            return False

        try:
            is_python = path.endswith(".py")
            is_js = path.endswith(".js")
            if not (is_python or is_js):
                logger.error("서버 스크립트는 .py 또는 .js 파일이어야 합니다")
                return False

            command = "python" if is_python else "node"
            server_params = StdioServerParameters(
                command=command, args=[path], env=None
            )

            self.exit_stack = AsyncExitStack()
            stdio_transport = await self.exit_stack.enter_async_context(
                stdio_client(server_params)
            )
            self.stdio, self.write = stdio_transport
            self.session = await self.exit_stack.enter_async_context(
                ClientSession(self.stdio, self.write)
            )

            await self.session.initialize()

            # 사용 가능한 도구 목록
            response = await self.session.list_tools()
            self.tools = response.tools
            logger.info(
                f"MCP 서버에 연결되었습니다. 사용 가능한 도구: {[tool.name for tool in self.tools]}"
            )

            self.server_connected = True
            return True
        except Exception as e:
            logger.error(f"MCP 서버 연결 실패: {str(e)}")
            return False

    async def disconnect(self):
        """MCP 서버 연결 종료"""
        if self.exit_stack:
            await self.exit_stack.aclose()
            self.server_connected = False

    async def execute_tool(
        self, tool_name: str, tool_args: Dict[str, Any]
    ) -> Optional[Any]:
        """MCP 도구 실행"""
        if not self.server_connected or not self.session:
            logger.error("MCP 서버에 연결되어 있지 않습니다")
            return None

        try:
            result = await self.session.call_tool(tool_name, tool_args)
            return result.content
        except Exception as e:
            logger.error(f"도구 실행 실패: {str(e)}")
            return None

    async def process_with_openai(self, user_input: str) -> str:
        """OpenAI API를 사용하여 사용자 입력 처리"""
        if not self.openai:
            logger.error("OpenAI API 키가 설정되지 않았습니다")
            return "OpenAI API 설정이 필요합니다."

        if not self.server_connected:
            await self.connect_to_server()
            if not self.server_connected:
                return "MCP 서버에 연결할 수 없습니다."

        try:
            # 도구 정보 가져오기
            available_tools = [
                {
                    "type": "function",
                    "function": {
                        "name": tool.name,
                        "description": tool.description,
                        "parameters": tool.inputSchema,
                    },
                }
                for tool in self.tools
            ]

            # 초기 OpenAI API 호출
            response = await self.openai.chat.completions.create(
                model="gpt-4",
                messages=[
                    {
                        "role": "system",
                        "content": "당신은 유용한 비서 역할을 하는 AI입니다. 필요한 경우 적절한 도구를 사용해서 사용자를 도와주세요.",
                    },
                    {"role": "user", "content": user_input},
                ],
                tools=available_tools if available_tools else None,
                tool_choice="auto",
                max_tokens=1000,
            )

            # 응답 처리 및 도구 호출 처리
            assistant_message = response.choices[0].message
            messages = [
                {
                    "role": "system",
                    "content": "당신은 유용한 비서 역할을 하는 AI입니다. 필요한 경우 적절한 도구를 사용해서 사용자를 도와주세요.",
                },
                {"role": "user", "content": user_input},
                {"role": "assistant", "content": assistant_message.content or ""},
            ]

            # 도구 호출이 있는지 확인
            if assistant_message.tool_calls:
                # 각 도구 호출에 대해 처리
                for tool_call in assistant_message.tool_calls:
                    function_name = tool_call.function.name
                    function_args = tool_call.function.arguments

                    # JSON 문자열을 파이썬 딕셔너리로 변환
                    try:
                        import json

                        args_dict = json.loads(function_args)
                    except json.JSONDecodeError:
                        args_dict = {}

                    # 도구 실행
                    logger.info(f"도구 {function_name} 호출 (인자: {args_dict})")
                    result = await self.execute_tool(function_name, args_dict)

                    # 결과를 OpenAI에 다시 전달
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "name": function_name,
                            "content": str(result),
                        }
                    )

                # 도구 결과를 바탕으로 최종 응답 생성
                final_response = await self.openai.chat.completions.create(
                    model="gpt-4", messages=messages, max_tokens=1000
                )

                return (
                    final_response.choices[0].message.content
                    or "응답을 생성할 수 없습니다."
                )
            else:
                # 도구 호출이 없는 경우 바로 응답 반환
                return assistant_message.content or "응답을 생성할 수 없습니다."

        except Exception as e:
            logger.error(f"처리 중 오류 발생: {str(e)}")
            return f"처리 중 오류가 발생했습니다: {str(e)}"


# MCP 매니저 인스턴스
mcp_manager = MCPManager()


async def process_user_input(user_input: str) -> str:
    """
    사용자 입력을 받아 MCP와 OpenAI를 통해 처리하는 함수
    """
    try:
        # MCP 서버와 OpenAI를 사용하여 처리
        response_text = await mcp_manager.process_with_openai(user_input)
        return response_text
    except Exception as e:
        logger.error(f"처리 중 오류 발생: {str(e)}")
        return f"처리 중 오류가 발생했습니다: {str(e)}"


# 애플리케이션 종료 시 MCP 연결 정리를 위한 함수
async def cleanup_mcp():
    """애플리케이션 종료 시 MCP 리소스 정리"""
    await mcp_manager.disconnect()
