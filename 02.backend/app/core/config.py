from pydantic import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "OmniSecretary"
    API_V1_PREFIX: str = "/api/v1"
    MCP_SERVER_URL: str = "http://localhost:8001"

    # CORS 설정
    ALLOWED_ORIGINS: list[str] = ["*"]

    class Config:
        env_file = ".env"


settings = Settings()
