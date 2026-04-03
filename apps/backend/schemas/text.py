from pydantic import BaseModel

from schemas.ocr import Transaction


class TextRequest(BaseModel):
    text: str


class TextBillData(BaseModel):
    type: str = "bill"
    transaction: Transaction


class TextNlData(BaseModel):
    type: str = "nl_result"
    message: str


class TextErrorData(BaseModel):
    type: str = "error"
    message: str


class TextResponse(BaseModel):
    data: TextBillData | TextNlData | TextErrorData
