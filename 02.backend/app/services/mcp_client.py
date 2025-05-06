#!/usr/bin/env python
import asyncio
import json
import os
import sys
from contextlib import AsyncExitStack
from typing import Any, Dict, List, Optional, Tuple

from app.core.config import settings
from loguru import logger
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


class MCPClient:
    """MCP 클라이언트 - 표준 MCP 프로토콜을 사용하여 MCP 서버와 통신합니다"""

    def __init__(self, server_name: str):
        """MCP 클라이언트 초기화

        Args:
            server_name: 연결할 MCP 서버 이름 (config에 정의된 이름)
        """
        # 세션 및 클라이언트 객체 초기화
        self.server_name = server_name
        self.session: Optional[ClientSession] = None
        self.exit_stack = AsyncExitStack()
        self.tools = []

    async def connect(self) -> bool:
        """서버에 연결

        Returns:
            연결 성공 여부
        """
        try:
            # 서버 설정 가져오기
            if self.server_name not in settings.MCP_SERVERS:
                logger.error(f"MCP 서버 '{self.server_name}'가 설정에 없습니다")
                return False

            server_config = settings.get_mcp_server_config(self.server_name)

            if not server_config.enabled:
                logger.error(f"MCP 서버 '{self.server_name}'가 비활성화되어 있습니다")
                return False

            # 서버 프로세스 설정
            command = server_config.command
            args = server_config.args
            env = os.environ.copy()
            env.update(server_config.env)

            logger.info(
                f"MCP 서버 '{self.server_name}' 연결 중: {command} {' '.join(args)}"
            )

            server_params = StdioServerParameters(command=command, args=args, env=env)

            stdio_transport = await self.exit_stack.enter_async_context(
                stdio_client(server_params)
            )
            self.stdio, self.write = stdio_transport
            self.session = await self.exit_stack.enter_async_context(
                ClientSession(self.stdio, self.write)
            )

            await self.session.initialize()

            # 사용 가능한 도구 목록 가져오기
            await self.refresh_tools()

            return True
        except Exception as e:
            logger.exception(
                f"MCP 서버 '{self.server_name}' 연결 중 오류 발생: {str(e)}"
            )
            return False

    async def refresh_tools(self) -> List[Dict[str, Any]]:
        """서버에서 사용 가능한 도구 목록 새로고침"""
        if not self.session:
            raise RuntimeError(
                f"MCP 서버 '{self.server_name}'에 연결되어 있지 않습니다"
            )

        try:
            response = await self.session.list_tools()
            self.tools = response.tools

            logger.info(
                f"MCP 서버 '{self.server_name}'에서 {len(self.tools)}개 도구 로드됨: {[tool.name for tool in self.tools]}"
            )

            return self.get_tool_details()
        except Exception as e:
            logger.exception(f"도구 목록 가져오기 중 오류 발생: {str(e)}")
            return []

    def get_tool_details(self) -> List[Dict[str, Any]]:
        """현재 로드된 도구 상세 정보 반환"""
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "inputSchema": tool.inputSchema,
            }
            for tool in self.tools
        ]

    async def execute_tool(
        self, tool_name: str, tool_args: Dict[str, Any]
    ) -> Tuple[bool, Any]:
        """도구 실행

        Args:
            tool_name: 실행할 도구 이름
            tool_args: 도구 실행 인자

        Returns:
            (성공 여부, 결과 또는 오류 메시지)
        """
        if not self.session:
            logger.error(f"MCP 서버 '{self.server_name}'에 연결되어 있지 않습니다")
            return False, "서버에 연결되어 있지 않습니다"

        logger.debug(
            f"도구 실행 요청: {tool_name}, 인자: {json.dumps(tool_args, ensure_ascii=False)}"
        )

        try:
            result = await self.session.call_tool(tool_name, tool_args)

            # 결과 처리
            response_text = ""
            if hasattr(result, "content"):
                response_text = "\n".join(
                    [
                        content.text
                        for content in result.content
                        if hasattr(content, "text") and content.text
                    ]
                )

            logger.debug(f"도구 실행 결과: {response_text}")
            return True, response_text
        except Exception as e:
            error_msg = f"도구 실행 중 오류 발생: {str(e)}"
            logger.exception(error_msg)
            return False, error_msg

    async def close(self):
        """리소스 정리"""
        try:
            await self.exit_stack.aclose()
            logger.info(f"MCP 클라이언트 '{self.server_name}' 정리 완료")
        except Exception as e:
            logger.exception(f"MCP 클라이언트 정리 중 오류 발생: {str(e)}")


class MCPClientManager:
    """MCP 클라이언트 관리자"""

    _instance = None
    _initialized = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MCPClientManager, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if MCPClientManager._initialized:
            return

        self.clients: Dict[str, MCPClient] = {}
        MCPClientManager._initialized = True

    async def initialize(self):
        """모든 활성화된 MCP 서버에 연결"""
        logger.info("MCP 클라이언트 관리자 초기화 중...")

        # 모든 MCP 서버 연결
        for server_name, server_config in settings.MCP_SERVERS.items():
            if settings.get_mcp_server_config(server_name).enabled:
                await self.connect_to_server(server_name)

    async def connect_to_server(self, server_name: str) -> bool:
        """특정 서버에 연결

        Args:
            server_name: 연결할 MCP 서버 이름

        Returns:
            연결 성공 여부
        """
        # 이미 연결된 클라이언트가 있는 경우, 재사용
        if server_name in self.clients:
            logger.info(f"MCP 서버 '{server_name}'에 이미 연결되어 있습니다")
            return True

        # 새로운 클라이언트 생성 및 연결
        client = MCPClient(server_name)
        success = await client.connect()

        if success:
            self.clients[server_name] = client
            return True
        else:
            return False

    async def get_tools(self, server_name: str) -> List[Dict[str, Any]]:
        """특정 서버의 도구 목록 가져오기

        Args:
            server_name: MCP 서버 이름

        Returns:
            도구 목록
        """
        if server_name not in self.clients:
            connected = await self.connect_to_server(server_name)
            if not connected:
                logger.error(f"MCP 서버 '{server_name}'에 연결할 수 없습니다")
                return []

        return self.clients[server_name].get_tool_details()

    async def execute_tool(
        self, server_name: str, tool_name: str, tool_args: Dict[str, Any]
    ) -> Tuple[bool, Any]:
        """특정 서버의 도구 실행

        Args:
            server_name: MCP 서버 이름
            tool_name: 실행할 도구 이름
            tool_args: 도구 실행 인자

        Returns:
            (성공 여부, 결과 또는 오류 메시지)
        """
        if server_name not in self.clients:
            connected = await self.connect_to_server(server_name)
            if not connected:
                logger.error(f"MCP 서버 '{server_name}'에 연결할 수 없습니다")
                return False, f"MCP 서버 '{server_name}'에 연결할 수 없습니다"

        return await self.clients[server_name].execute_tool(tool_name, tool_args)

    async def close_all(self):
        """모든 클라이언트 정리"""
        for server_name, client in self.clients.items():
            await client.close()

        self.clients.clear()
        logger.info("모든 MCP 클라이언트가 정리되었습니다")

    async def close(self, server_name: str):
        """특정 서버 클라이언트 정리"""
        if server_name in self.clients:
            await self.clients[server_name].close()
            del self.clients[server_name]
            logger.info(f"MCP 클라이언트 '{server_name}'가 정리되었습니다")


# MCP 클라이언트 관리자 인스턴스
mcp_client_manager = MCPClientManager()


async def initialize_mcp_clients():
    """MCP 클라이언트 초기화"""
    await mcp_client_manager.initialize()


async def cleanup_mcp_clients():
    """MCP 클라이언트 정리"""
    await mcp_client_manager.close_all()
