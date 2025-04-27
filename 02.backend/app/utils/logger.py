import sys

from loguru import logger

# 로그 세팅
logger.remove()
logger.add(
    sys.stdout,
    level="DEBUG",
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level}</level> | <cyan>{name}:{line}</cyan> - <level>{message}</level>",
)


def get_logger(name: str = "omni") -> logger:
    """
    모듈별로 로거 인스턴스를 가져오는 함수
    """
    return logger.bind(module=name)
