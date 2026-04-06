from pydantic import BaseModel


class AsrRequest(BaseModel):
    audioBase64: str


class AsrData(BaseModel):
    asrText: str


class AsrResponse(BaseModel):
    data: AsrData
