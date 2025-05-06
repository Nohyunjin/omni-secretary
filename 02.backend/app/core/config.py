import json
import os
from typing import Any, Dict, List, Optional, Union

from loguru import logger
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class MCPServerConfig(BaseSettings):
    """MCP 서버 구성 설정"""

    command: str = Field("node", description="MCP 서버 실행 명령어")
    args: List[str] = Field(default_factory=list, description="MCP 서버 실행 인자")
    enabled: bool = Field(True, description="MCP 서버 활성화 여부")
    transport: str = Field("stdio", description="MCP 서버 통신 방식 (stdio 또는 sse)")
    url: Optional[str] = Field(None, description="SSE 방식 사용 시 서버 URL")
    env: Dict[str, str] = Field(default_factory=dict, description="MCP 서버 환경 변수")

    model_config = SettingsConfigDict(
        extra="allow",
    )


class Settings(BaseSettings):
    """애플리케이션 설정"""

    # API 설정
    API_HOST: str = Field(default="0.0.0.0")
    API_PORT: int = Field(default=8000)

    # 기본 LLM 모델 설정
    DEFAULT_MODEL: str = Field(default="gpt-4o-mini")

    # 설정 디렉토리
    CONFIG_DIR: str = Field(
        default=os.path.join(os.path.expanduser("~"), ".omni-secretary"),
        description="설정 파일 저장 디렉토리",
    )

    # MCP 서버 구성
    MCP_SERVERS: Dict[str, Dict[str, Any]] = Field(
        default={
            "gmail": {
                "command": "npx.cmd" if os.name == "nt" else "npx",
                "args": ["@gongrzhe/server-gmail-autoauth-mcp"],
                "enabled": True,
                "transport": "stdio",
                "env": {
                    "GMAIL_CREDENTIALS_PATH": os.path.join(
                        os.path.expanduser("~"), ".gmail-mcp", "credentials.json"
                    )
                },
            },
            # SSE 방식 MCP 서버 예제 (비활성화)
            "echo-sse": {
                "url": "http://localhost:3000",
                "enabled": False,
                "transport": "sse",
            },
        },
        description="사용 가능한 MCP 서버 목록 (서비스명: 설정)",
    )

    # MCP 서버 관리 설정
    MCP_AUTO_START: bool = Field(
        True, description="백엔드 시작 시 MCP 서버 자동 시작 여부"
    )
    MCP_RETRY_INTERVAL: int = Field(5, description="MCP 서버 연결 재시도 간격(초)")
    MCP_MAX_RETRIES: int = Field(3, description="MCP 서버 연결 최대 재시도 횟수")

    # HTTP 통신 설정
    HTTP_TIMEOUT: int = Field(30, description="HTTP 요청 타임아웃(초)")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    def get_mcp_server_config(self, server_name: str) -> MCPServerConfig:
        """지정된 이름의 MCP 서버 설정을 반환합니다."""
        if server_name not in self.MCP_SERVERS:
            raise ValueError(f"MCP 서버 '{server_name}'가 설정에 없습니다.")

        return MCPServerConfig(**self.MCP_SERVERS[server_name])

    def save_config(self) -> None:
        """현재 설정을 파일에 저장합니다."""
        os.makedirs(self.CONFIG_DIR, exist_ok=True)
        config_path = os.path.join(self.CONFIG_DIR, "config.json")

        # 저장할 설정 데이터 구성
        config_data = {
            "MCP_SERVERS": self.MCP_SERVERS,
            "MCP_AUTO_START": self.MCP_AUTO_START,
            "MCP_RETRY_INTERVAL": self.MCP_RETRY_INTERVAL,
            "MCP_MAX_RETRIES": self.MCP_MAX_RETRIES,
            "DEFAULT_MODEL": self.DEFAULT_MODEL,
            "HTTP_TIMEOUT": self.HTTP_TIMEOUT,
        }

        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(config_data, f, ensure_ascii=False, indent=2)

    @classmethod
    def load_config(cls) -> "Settings":
        """설정 파일에서 설정을 로드합니다."""
        config_dir = os.path.join(os.path.expanduser("~"), ".omni-secretary")
        config_path = os.path.join(config_dir, "config.json")

        # 기본 설정으로 초기화 (린터 에러 무시)
        settings = cls()  # type: ignore[call-arg]

        # 설정 파일이 존재하면 로드
        if os.path.exists(config_path):
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    config_data = json.load(f)

                # 설정 값 업데이트 (더 안전한 방식 고려 가능)
                for key, value in config_data.items():
                    if hasattr(settings, key):
                        # TODO: Pydantic 모델의 타입 변환 및 유효성 검사 활용 고려
                        setattr(settings, key, value)
            except json.JSONDecodeError:
                logger.error(
                    f"설정 파일({config_path}) 파싱 오류. 기본 설정을 사용합니다."
                )
            except Exception as e:
                logger.error(
                    f"설정 파일({config_path}) 로드 중 오류 발생: {e}. 기본 설정을 사용합니다."
                )

        # 로드된 설정 로깅 (디버깅용)
        logger.debug(f"로드된 설정 MCP_SERVERS: {settings.MCP_SERVERS}")
        logger.debug(f"로드된 설정 MCP_AUTO_START: {settings.MCP_AUTO_START}")

        return settings


# 설정 객체 인스턴스화
settings = Settings.load_config()
