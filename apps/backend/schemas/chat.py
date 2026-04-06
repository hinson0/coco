from pydantic import BaseModel, model_validator

from schemas.ocr import Transaction


class ChatRequest(BaseModel):
    text: str | None = None
    audioBase64: str | None = None

    @model_validator(mode="after")
    def check_at_least_one(self):
        if not self.text and not self.audioBase64:
            raise ValueError("text 和 audio必须要提供一个")
        return self


class ChatTextData(BaseModel):
    type: str = "text"
    content: str
    asrText: str | None = None


class ChatBillData(BaseModel):
    type: str = "bill"
    transaction: Transaction
    asrText: str | None = None


class ChatNlData(BaseModel):
    type: str = "nl_result"
    content: str
    asrText: str | None = None


class ChatResponse(BaseModel):
    data: ChatBillData | ChatTextData | ChatNlData
