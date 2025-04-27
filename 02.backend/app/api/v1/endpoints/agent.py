from app.schemas.agent import AgentQueryRequest, AgentQueryResponse
from app.services.agent_service import process_user_input
from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.post("/query", response_model=AgentQueryResponse)
async def query_agent(request: AgentQueryRequest):
    try:
        response = await process_user_input(request.user_input)
        return AgentQueryResponse(agent_response=response)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
