from pydantic import BaseModel

from schemas.ocr import Transaction


class ChatRequest(BaseModel):
    text: str


class ChatTextData(BaseModel):
    type: str = "text"
    content: str


class ChatBillData(BaseModel):
    type: str = "bill"
    transaction: Transaction


class ChatResponse(BaseModel):
    data: ChatBillData | ChatTextData
