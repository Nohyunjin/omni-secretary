import os
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """애플리케이션 설정"""

    # API 설정
    API_HOST: str = Field(default="0.0.0.0")
    API_PORT: int = Field(default=8000)

    # 기본 LLM 모델 설정
    DEFAULT_MODEL: str = Field(default="gpt-4")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


# 설정 객체 인스턴스화
settings = Settings()
