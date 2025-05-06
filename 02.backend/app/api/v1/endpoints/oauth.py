import httpx
from fastapi import APIRouter, Request, Response
from fastapi.responses import HTMLResponse, RedirectResponse
from loguru import logger

router = APIRouter()


@router.get("/oauth2callback")
async def oauth2callback(code: str = None, error: str = None):
    """
    OAuth2 콜백 처리 엔드포인트

    이 엔드포인트는 Gmail OAuth 인증 과정에서 구글로부터 리디렉션되는 콜백 요청을 처리합니다.
    인증 코드를 다시 Gmail MCP 서버로 전달합니다.
    """
    if error:
        logger.error(f"OAuth 인증 오류: {error}")
        return {"status": "error", "message": f"인증 실패: {error}"}

    if not code:
        logger.error("인증 코드가 없습니다")
        return {"status": "error", "message": "인증 코드가 없습니다"}

    try:
        # Gmail MCP 서버에 인증 코드 전달
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "http://localhost:3200/oauth2callback", json={"code": code}
            )

            if response.status_code == 200:
                logger.info("OAuth 인증 코드가 성공적으로 전달되었습니다")
                # 사용자에게 성공 메시지를 HTML로 제공
                html_content = """
                <!DOCTYPE html>
                <html>
                <head>
                    <title>인증 완료</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            text-align: center;
                            margin-top: 50px;
                        }
                        .success {
                            color: #4CAF50;
                            font-size: 24px;
                            margin-bottom: 20px;
                        }
                        .message {
                            font-size: 16px;
                        }
                    </style>
                </head>
                <body>
                    <div class="success">인증이 완료되었습니다!</div>
                    <div class="message">이 창을 닫고 애플리케이션으로 돌아가셔도 됩니다.</div>
                </body>
                </html>
                """
                return HTMLResponse(content=html_content)
            else:
                logger.error(
                    f"인증 코드 전달 실패: {response.status_code} {response.text}"
                )
                return {
                    "status": "error",
                    "message": f"인증 코드 전달 실패: {response.status_code}",
                }

    except Exception as e:
        logger.error(f"OAuth 콜백 처리 중 오류 발생: {str(e)}")
        return {"status": "error", "message": f"OAuth 콜백 처리 중 오류 발생: {str(e)}"}


@router.get("/gmail/start-auth")
async def start_gmail_auth():
    """
    Gmail 인증 프로세스 시작

    이 엔드포인트는 Gmail 인증 프로세스를 시작하고 인증 URL을 반환합니다.
    """
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "http://localhost:3200/execute",
                json={
                    "tool": "gmail_start_auth",
                    "args": {"callbackUrl": "http://localhost:8000/oauth2callback"},
                },
            )

            if response.status_code == 200:
                result = response.json()
                if "result" in result and "authUrl" in result["result"]:
                    auth_url = result["result"]["authUrl"]
                    logger.info(f"Gmail 인증 URL 생성됨: {auth_url}")
                    return {"status": "success", "authUrl": auth_url}
                else:
                    logger.error("MCP 서버에서 인증 URL을 반환하지 않았습니다")
                    return {"status": "error", "message": "인증 URL을 얻지 못했습니다"}
            else:
                logger.error(
                    f"MCP 서버 요청 실패: {response.status_code} {response.text}"
                )
                return {
                    "status": "error",
                    "message": f"MCP 서버 요청 실패: {response.status_code}",
                }

    except Exception as e:
        logger.error(f"Gmail 인증 시작 중 오류 발생: {str(e)}")
        return {"status": "error", "message": f"Gmail 인증 시작 중 오류 발생: {str(e)}"}


@router.get("/gmail/auth-status")
async def gmail_auth_status():
    """
    Gmail 인증 상태 확인

    이 엔드포인트는 현재 Gmail 인증 상태를 확인합니다.
    """
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "http://localhost:3200/execute",
                json={"tool": "gmail_auth_status", "args": {}},
            )

            if response.status_code == 200:
                result = response.json()
                if "result" in result:
                    logger.info(f"Gmail 인증 상태: {result['result']}")
                    return {"status": "success", "authStatus": result["result"]}
                else:
                    logger.error("MCP 서버에서 인증 상태를 반환하지 않았습니다")
                    return {"status": "error", "message": "인증 상태를 얻지 못했습니다"}
            else:
                logger.error(
                    f"MCP 서버 요청 실패: {response.status_code} {response.text}"
                )
                return {
                    "status": "error",
                    "message": f"MCP 서버 요청 실패: {response.status_code}",
                }

    except Exception as e:
        logger.error(f"Gmail 인증 상태 확인 중 오류 발생: {str(e)}")
        return {
            "status": "error",
            "message": f"Gmail 인증 상태 확인 중 오류 발생: {str(e)}",
        }
