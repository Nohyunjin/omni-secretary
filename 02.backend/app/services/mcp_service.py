import asyncio
import json
import os
import signal
import subprocess
import sys  # sys 모듈 추가
import threading
import uuid
from typing import Any, Callable, Dict, List, Optional, Tuple, Union

import httpx
from app.core.config import MCPServerConfig, settings
from loguru import logger

# MCP 프로토콜 상수
MCP_VERSION = "0.1.0"
MCP_CONTENT_TYPE = "application/json"
MCP_PROTOCOL_VERSION = "0.1"
MCP_TOOLS_KEY = "tools"
MCP_ERROR_KEY = "error"
MCP_RESULT_KEY = "result"


class MCPServerManager:
    """MCP 서버 관리 클래스"""

    _instance = None
    _initialized = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MCPServerManager, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if MCPServerManager._initialized:
            return

        self.servers: Dict[str, Dict[str, Any]] = (
            {}
        )  # 서버 이름: {process, config, status}
        self.http_client = httpx.AsyncClient(timeout=settings.HTTP_TIMEOUT)

        MCPServerManager._initialized = True

    async def initialize(self):
        """MCP 서버 관리자 초기화"""
        logger.info("MCP 서버 관리자 초기화 중...")

        # 자동 시작 설정이 활성화된 경우 서버 시작
        if settings.MCP_AUTO_START:
            await self.start_all_servers()

    async def start_all_servers(self):
        """활성화된 모든 MCP 서버 시작"""
        logger.info("모든 활성화된 MCP 서버 시작 중...")

        for server_name, server_config in settings.MCP_SERVERS.items():
            config = MCPServerConfig(**server_config)
            if config.enabled:
                await self.start_server(server_name)

    async def start_server(self, server_name: str) -> bool:
        """지정된 이름의 MCP 서버 시작"""
        if server_name not in settings.MCP_SERVERS:
            logger.error(f"MCP 서버 '{server_name}'가 설정에 없습니다")
            return False

        # 이미 실행 중인 경우 (상태 확인 강화)
        if server_name in self.servers:
            server_info = self.servers[server_name]
            if server_info.get("process") and server_info.get("status") in [
                "running",
                "connecting",
                "connected",
            ]:
                # 프로세스가 있거나, 상태가 아직 종료되지 않은 경우
                process = server_info.get("process")
                pid = process.pid if process else "N/A"
                logger.info(
                    f"MCP 서버 '{server_name}'는 이미 실행 중이거나 시작 중입니다 (PID: {pid}, Status: {server_info.get('status')})"
                )
                # 이미 실행 중이면 True 반환하여 중복 시작 방지
                return True

        try:
            config = settings.get_mcp_server_config(server_name)
            logger.info(
                f"MCP 서버 '{server_name}' 시작: {config.command} {' '.join(config.args)}"
            )

            # 서버 설정에 따라 처리
            if config.transport == "http" or config.transport == "sse":
                # HTTP/SSE 서버는 별도로 시작하지 않고 URL만 확인
                if not config.url:
                    logger.error(
                        f"MCP 서버 '{server_name}'의 URL이 설정되지 않았습니다"
                    )
                    return False

                # 서버 상태 초기화
                self.servers[server_name] = {
                    "config": config,
                    "process": None,
                    "status": "connecting",
                    "tools": [],
                }

                # HTTP 서버 연결 확인
                for attempt in range(settings.MCP_MAX_RETRIES):
                    try:
                        logger.info(
                            f"MCP 서버 '{server_name}' 연결 시도 {attempt+1}/{settings.MCP_MAX_RETRIES}: {config.url}/status"
                        )
                        response = await self.http_client.get(f"{config.url}/status")
                        logger.info(
                            f"MCP 서버 '{server_name}' 응답: {response.status_code} {response.text if response.status_code != 200 else ''}"
                        )

                        if response.status_code == 200:
                            logger.info(
                                f"MCP 서버 '{server_name}'에 연결됨: {config.url}"
                            )
                            self.servers[server_name]["status"] = "connected"

                            # 도구 목록 가져오기
                            tools = await self.fetch_tools(server_name)
                            logger.info(
                                f"MCP 서버 '{server_name}'에서 도구 {len(tools)}개 로드됨"
                            )
                            return True
                    except Exception as e:
                        logger.warning(
                            f"MCP 서버 '{server_name}' 연결 시도 {attempt+1}/{settings.MCP_MAX_RETRIES} 실패: {str(e)}"
                        )

                    # 재시도 전 대기
                    await asyncio.sleep(settings.MCP_RETRY_INTERVAL)

                logger.error(f"MCP 서버 '{server_name}'에 연결할 수 없습니다")
                self.servers[server_name]["status"] = "error"
                return False

            elif config.transport == "stdio":
                # stdio 방식 서버 시작
                env = os.environ.copy()
                env.update(config.env)
                cmd_str = f"{config.command} {' '.join(config.args)}"
                logger.info(f"실행할 명령어: {cmd_str}")

                try:
                    # 현재 이벤트 루프 확인 로깅 추가
                    current_loop = asyncio.get_running_loop()
                    logger.info(f"Current event loop: {current_loop}")

                    # Windows 환경에서 ProactorEventLoop 사용 확인
                    if sys.platform.startswith("win"):
                        if not isinstance(current_loop, asyncio.ProactorEventLoop):
                            logger.warning(
                                "Windows 환경에서 ProactorEventLoop가 아님 - 서브프로세스 생성에 문제가 발생할 수 있습니다"
                            )
                            logger.info(
                                "이벤트 루프 생성을 위해 run.py에서 asyncio.WindowsProactorEventLoopPolicy()를 설정하세요"
                            )

                            # Windows에서는 프로세스 생성 방식을 변경
                            logger.info("Windows 환경에서 subprocess.Popen 사용 시도")

                            # 서버 상태 초기화 (프로세스는 나중에 설정)
                            self.servers[server_name] = {
                                "config": config,
                                "process": None,
                                "status": "starting",
                                "tools": [],
                            }

                            # subprocess.Popen을 이용한 대체 구현
                            # 별도 스레드에서 실행하여 비동기 작업 블로킹 방지
                            def run_process():
                                try:
                                    process = subprocess.Popen(
                                        [config.command] + config.args,
                                        stdout=subprocess.PIPE,
                                        stderr=subprocess.PIPE,
                                        env=env,
                                        text=True,  # 텍스트 모드 사용
                                        bufsize=1,  # 라인 버퍼링
                                    )

                                    # 프로세스 저장 및 상태 업데이트
                                    if server_name in self.servers:
                                        self.servers[server_name]["process"] = process
                                        self.servers[server_name][
                                            "status"
                                        ] = "connected"
                                        logger.info(
                                            f"MCP 서버 '{server_name}' 시작됨: PID {process.pid}"
                                        )

                                        # 출력 로깅
                                        for line in process.stdout:
                                            logger.info(
                                                f"[{server_name} stdout] {line.strip()}"
                                            )

                                        for line in process.stderr:
                                            logger.error(
                                                f"[{server_name} stderr] {line.strip()}"
                                            )

                                        # 프로세스 종료 감지
                                        process.wait()
                                        logger.info(
                                            f"MCP 서버 '{server_name}' 종료됨: 코드 {process.returncode}"
                                        )

                                        # 상태 업데이트
                                        if server_name in self.servers:
                                            self.servers[server_name][
                                                "status"
                                            ] = "stopped"

                                except Exception as proc_error:
                                    logger.error(
                                        f"프로세스 시작/모니터링 중 오류: {str(proc_error)}"
                                    )
                                    if server_name in self.servers:
                                        self.servers[server_name]["status"] = "error"

                            # 별도 스레드에서 프로세스 실행
                            thread = threading.Thread(target=run_process, daemon=True)
                            thread.start()

                            # 비동기 작업은 아니지만 도구 로드를 비동기로 시도
                            asyncio.create_task(
                                self._wait_and_fetch_tools(server_name, 2)
                            )

                            return True

                    # asyncio.create_subprocess_exec 사용 부분 수정
                    process = await asyncio.create_subprocess_exec(
                        config.command,
                        *config.args,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                        stdin=asyncio.subprocess.PIPE,  # stdin 파이프 활성화
                        env=env,
                    )
                    logger.info(f"프로세스 시작됨 - PID: {process.pid}")

                    # 서버 상태 초기화
                    self.servers[server_name] = {
                        "config": config,
                        "process": process,
                        "status": "connected",  # 초기 상태를 바로 'connected'로 설정
                        "tools": [],
                        "pending_requests": {},  # 요청 ID와 콜백을 저장할 딕셔너리
                    }
                    logger.info(f"MCP 서버 '{server_name}' 시작됨: PID {process.pid}")

                    # 출력 모니터링 및 메시지 처리 태스크
                    asyncio.create_task(
                        self._handle_process_output(server_name, process)
                    )

                    # 오류 출력 모니터링 태스크
                    asyncio.create_task(
                        self._monitor_error_output(server_name, process)
                    )

                    # 도구 목록 요청
                    await self.fetch_tools(server_name)

                    return True

                except Exception as start_error:
                    logger.error(f"프로세스 시작 중 오류: {str(start_error)}")
                    import traceback

                    logger.error(
                        f"상세 오류: {traceback.format_exc()}"
                    )  # 상세 오류 로깅 추가
                    # 시작 실패 시 서버 정보 제거 또는 상태 업데이트
                    if server_name in self.servers:
                        self.servers[server_name]["status"] = "error"
                        self.servers[server_name][
                            "process"
                        ] = None  # 프로세스 객체 제거
                    return False

            else:
                logger.error(f"지원되지 않는 MCP 서버 통신 방식: {config.transport}")
                return False

        except Exception as e:
            logger.error(f"MCP 서버 '{server_name}' 시작 처리 중 오류 발생: {str(e)}")
            import traceback

            logger.error(f"상세 오류: {traceback.format_exc()}")
            # 오류 발생 시에도 서버 정보 정리
            if server_name in self.servers:
                self.servers[server_name]["status"] = "error"
                self.servers[server_name]["process"] = None
            return False

    async def _handle_process_output(
        self, server_name: str, process: asyncio.subprocess.Process
    ):
        """프로세스의 stdout을 처리하고 메시지 핸들링"""
        if not process.stdout:
            logger.error(f"[{server_name}] 프로세스의 stdout이 None입니다")
            return

        try:
            # 서버 정보 참조
            if server_name not in self.servers:
                logger.error(f"[{server_name}] 서버 정보가 없습니다")
                return

            server_info = self.servers[server_name]
            pending_requests = server_info.get("pending_requests", {})

            while True:
                try:
                    # 한 줄씩 읽기
                    line = await process.stdout.readline()
                    if not line:  # EOF
                        logger.info(f"[{server_name}] 프로세스 stdout이 닫혔습니다")
                        break

                    # 바이트 -> 문자열 변환
                    line_str = line.decode("utf-8", errors="replace").strip()
                    if not line_str:
                        continue

                    logger.debug(f"[{server_name}] 프로세스 메시지: {line_str}")

                    # JSON 파싱
                    try:
                        message = json.loads(line_str)
                        # 메시지 유형에 따라 처리
                        if "id" in message and "result" in message:
                            # 결과 메시지
                            req_id = message.get("id")
                            if req_id in pending_requests:
                                callback = pending_requests.pop(req_id)
                                if asyncio.iscoroutinefunction(callback):
                                    await callback(message.get("result"))
                                else:
                                    callback(message.get("result"))
                        elif MCP_TOOLS_KEY in message:
                            # 도구 목록 메시지
                            if server_name in self.servers:
                                tools = message.get(MCP_TOOLS_KEY, [])
                                self.servers[server_name]["tools"] = tools
                                self.servers[server_name]["status"] = "connected"
                                logger.info(
                                    f"[{server_name}] {len(tools)}개 도구 로드됨"
                                )
                    except json.JSONDecodeError:
                        logger.warning(f"[{server_name}] JSON 파싱 실패: {line_str}")
                    except Exception as e:
                        logger.error(f"[{server_name}] 메시지 처리 중 오류: {str(e)}")

                except asyncio.CancelledError:
                    logger.warning(f"[{server_name}] stdout 처리 태스크 취소됨")
                    break
                except Exception as e:
                    logger.error(f"[{server_name}] stdout 읽기 오류: {str(e)}")
                    # 계속 시도

            logger.info(f"[{server_name}] stdout 처리 종료")

            # 프로세스 종료 후 서버 상태 업데이트
            if server_name in self.servers:
                self.servers[server_name]["status"] = "stopped"

        except Exception as e:
            logger.error(f"[{server_name}] stdout 처리 메인 루프 오류: {str(e)}")
            # 서버 상태 업데이트
            if server_name in self.servers:
                self.servers[server_name]["status"] = "error"

    async def _monitor_error_output(
        self, server_name: str, process: asyncio.subprocess.Process
    ):
        """프로세스의 stderr만 모니터링"""
        if not process.stderr:
            return

        async def log_stderr():
            while True:
                try:
                    line = await process.stderr.readline()
                    if not line:  # EOF
                        break
                    line_str = line.decode("utf-8", errors="replace").strip()
                    if line_str:
                        logger.error(f"[{server_name} stderr] {line_str}")
                except Exception as e:
                    logger.error(f"[{server_name}] stderr 읽기 오류: {str(e)}")
                    break

        await log_stderr()
        logger.info(f"[{server_name}] stderr 모니터링 종료")

    async def stop_server(self, server_name: str) -> bool:
        """지정된 이름의 MCP 서버 중지"""
        if server_name not in self.servers:
            logger.warning(
                f"MCP 서버 '{server_name}'가 관리 목록에 없거나 이미 중지되었습니다"
            )
            return True  # 이미 없으면 성공으로 간주

        server_info = self.servers[server_name]
        process = server_info.get("process")

        if not process or server_info.get("status") == "stopped":
            logger.info(
                f"MCP 서버 '{server_name}'는 이미 중지되었거나 프로세스가 없습니다."
            )
            # 상태가 이미 stopped이거나 process가 없으면 정리 후 True 반환
            if server_name in self.servers:
                del self.servers[server_name]
            return True

        logger.info(
            f"MCP 서버 '{server_name}' 종료 중 (PID: {process.pid}, Status: {server_info.get('status')})..."
        )

        try:
            # 프로세스 종료 시도 (asyncio.subprocess.Process 사용)
            if process.returncode is None:  # 프로세스가 아직 실행 중일 때만 시도
                try:
                    process.terminate()  # SIGTERM 전송 시도
                    # asyncio.wait_for를 사용하여 타임아웃 처리
                    await asyncio.wait_for(process.wait(), timeout=5.0)
                    logger.info(
                        f"MCP 서버 '{server_name}' 정상 종료됨 (SIGTERM, 코드: {process.returncode})"
                    )
                except asyncio.TimeoutError:
                    logger.warning(
                        f"MCP 서버 '{server_name}'가 5초 내에 종료되지 않아 강제 종료(SIGKILL) 시도..."
                    )
                    if process.returncode is None:  # 아직도 실행 중이면 강제 종료
                        try:
                            process.kill()  # SIGKILL 전송
                            # kill 후에도 종료될 때까지 잠시 기다리는 것이 좋음
                            await asyncio.wait_for(process.wait(), timeout=1.0)
                            logger.info(
                                f"MCP 서버 '{server_name}' 강제 종료됨 (SIGKILL, 코드: {process.returncode})"
                            )
                        except asyncio.TimeoutError:
                            logger.error(
                                f"MCP 서버 '{server_name}' 강제 종료 후에도 1초 내 응답 없음."
                            )
                        except ProcessLookupError:
                            logger.warning(
                                f"MCP 서버 '{server_name}' 프로세스가 강제 종료 시도 중 이미 사라짐."
                            )
                        except Exception as kill_e:
                            logger.error(
                                f"MCP 서버 '{server_name}' 강제 종료 중 오류: {kill_e}"
                            )
                    else:
                        logger.info(
                            f"MCP 서버 '{server_name}' 강제 종료 시도 전 이미 종료됨 (코드: {process.returncode})"
                        )
                except ProcessLookupError:
                    logger.warning(
                        f"MCP 서버 '{server_name}' 프로세스가 terminate 시도 중 이미 사라짐."
                    )
                except Exception as term_e:
                    logger.error(
                        f"MCP 서버 '{server_name}' 종료(terminate/wait) 중 오류: {term_e}"
                    )
            else:
                # 이미 종료된 상태
                logger.info(
                    f"MCP 서버 '{server_name}' 프로세스는 이미 종료된 상태였습니다 (코드: {process.returncode})."
                )

            # 서버 정보 최종 정리
            if server_name in self.servers:
                # 상태를 명확히 'stopped'로 설정
                self.servers[server_name]["status"] = "stopped"
                # 프로세스 객체 참조 제거 (선택적이지만 권장)
                self.servers[server_name]["process"] = None
                # 관리 목록에서 제거
                del self.servers[server_name]
                logger.info(f"MCP 서버 '{server_name}' 관리 목록에서 최종 제거됨")
            return True

        except Exception as e:
            logger.error(f"MCP 서버 '{server_name}' 종료 처리 중 예외 발생: {str(e)}")
            import traceback

            logger.error(f"상세 오류: {traceback.format_exc()}")
            # 오류 발생 시에도 가능한 정리 시도
            if server_name in self.servers:
                self.servers[server_name]["status"] = "error"  # 에러 상태로 설정
                # 프로세스 객체는 제거하지 않을 수도 있음 (디버깅 목적)
                # del self.servers[server_name] # 목록에서 제거할지 여부 결정
            return False

    async def stop_all_servers(self):
        """모든 MCP 서버 중지"""
        logger.info("모든 MCP 서버 종료 중...")

        for server_name in list(self.servers.keys()):
            await self.stop_server(server_name)

    async def fetch_tools(self, server_name: str) -> List[Dict[str, Any]]:
        """MCP 서버에서 사용 가능한 도구 목록을 가져옵니다.
        참고: 현재는 tools를 직접 관리하지 않고 mcp_client.py를 통해 가져옵니다.

        Args:
            server_name: MCP 서버 이름

        Returns:
            사용 가능한 도구 목록 (항상 빈 배열 반환)
        """
        logger.debug(
            f"fetch_tools는 더 이상 사용되지 않습니다. mcp_client.py를 통해 도구를 가져옵니다."
        )
        # 서버 상태만 'connected'로 설정
        if server_name in self.servers:
            self.servers[server_name]["status"] = "connected"
        return []

    async def execute_tool(
        self, server_name: str, tool_name: str, tool_args: Dict[str, Any]
    ) -> Tuple[bool, Any]:
        """MCP 서버의 도구 실행
        이 메서드는 mcp_client_manager를 사용하도록 리디렉션됩니다.
        """
        # 클라이언트를 통해 도구 실행
        from app.services.mcp_client import mcp_client_manager

        try:
            return await mcp_client_manager.execute_tool(
                server_name, tool_name, tool_args
            )
        except Exception as e:
            logger.error(f"도구 실행 중 오류: {str(e)}")
            return False, f"도구 실행 중 오류 발생: {str(e)}"

    async def get_all_tools(self) -> Dict[str, List[Dict[str, Any]]]:
        """모든 MCP 서버의 도구 목록 조회"""
        # 클라이언트에서 도구 가져오기 위해 필요
        from app.services.mcp_client import mcp_client_manager

        result = {}
        logger.info("MCP 서버에서 도구 목록 조회 시작")

        # MCP 클라이언트가 관리하는 서버 목록
        for server_name in mcp_client_manager.clients.keys():
            try:
                # 클라이언트에서 도구 목록 가져오기
                tools = await mcp_client_manager.get_tools(server_name)
                result[server_name] = tools
                logger.info(f"서버 '{server_name}'에서 {len(tools)}개 도구 찾음")
            except Exception as e:
                logger.warning(f"서버 '{server_name}'에서 도구 가져오기 실패: {str(e)}")
                result[server_name] = []

        # 도구가 없는 경우 디버깅
        if not result:
            logger.warning("get_all_tools: 도구를 가져올 수 있는 서버가 없습니다")
            # 클라이언트 상태 확인
            logger.debug(f"MCP 클라이언트 수: {len(mcp_client_manager.clients)}")

        return result

    async def get_server_status(self, server_name: str) -> Dict[str, Any]:
        """서버 상태 조회"""
        if server_name not in self.servers:
            return {"status": "not_running"}

        server_info = self.servers[server_name]

        return {
            "status": server_info["status"],
            "tool_count": len(server_info.get("tools", [])),
            "config": {
                "command": server_info["config"].command,
                "transport": server_info["config"].transport,
                "url": server_info["config"].url,
            },
        }

    async def get_all_server_status(self) -> Dict[str, Dict[str, Any]]:
        """모든 서버 상태 조회"""
        result = {}

        # 실행 중인 서버 상태
        for server_name in self.servers:
            result[server_name] = await self.get_server_status(server_name)

        # 설정은 있지만 실행 중이지 않은 서버
        for server_name in settings.MCP_SERVERS:
            if server_name not in result:
                result[server_name] = {"status": "not_running"}

        return result

    def find_tool(
        self, tool_name: str
    ) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
        """도구 이름으로 서버와 도구 정보 찾기"""
        # 클라이언트에서 도구 가져오기 위해 필요
        from app.services.mcp_client import mcp_client_manager

        # 클라이언트에서 도구 검색
        for server_name, client in mcp_client_manager.clients.items():
            for tool in client.tools:
                if tool.name == tool_name:
                    tool_info = {
                        "name": tool.name,
                        "description": tool.description,
                        "inputSchema": tool.inputSchema,
                    }
                    return server_name, tool_info

        return None, None

    async def _wait_and_fetch_tools(
        self, server_name: str, wait_seconds: int = 2
    ) -> List[Dict[str, Any]]:
        """서버가 준비될 때까지 대기 후 도구 목록 조회"""
        await asyncio.sleep(wait_seconds)  # 서버 초기화 시간 확보
        return await self.fetch_tools(server_name)


# MCP 서버 관리자 인스턴스
mcp_server_manager = MCPServerManager()


async def initialize_mcp_servers():
    """MCP 서버 초기화"""
    await mcp_server_manager.initialize()


async def cleanup_mcp_servers():
    """MCP 서버 정리"""
    await mcp_server_manager.stop_all_servers()
    await mcp_server_manager.http_client.aclose()
