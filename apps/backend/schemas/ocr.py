from pydantic import BaseModel, Field


class OcrRequest(BaseModel):
    imageBase64: str


class Transaction(BaseModel):
    amount: float
    category: str
    note: str
    occurred_at: str = Field(
        min_length=1,
        description="ISO 8601 时间戳；由 router 保证非空（LLM 返回空则回退当前时间）",
    )
    type: str  # expense | income


class OcrBillData(BaseModel):
    type: str = "bill"
    transaction: Transaction


class OcrErrorData(BaseModel):
    type: str = "error"
    message: str


class OcrResponse(BaseModel):
    data: OcrBillData | OcrErrorData
