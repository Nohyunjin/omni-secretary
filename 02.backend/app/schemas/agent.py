from pydantic import BaseModel


class AgentQueryRequest(BaseModel):
    user_input: str


class AgentQueryResponse(BaseModel):
    agent_response: str
