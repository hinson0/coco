from pydantic import BaseModel


class OcrRequest(BaseModel):
    imageBase64: str


class Transaction(BaseModel):
    amount: float
    category: str
    note: str
    occurred_at: str
    type: str  # expense | income


class OcrBillData(BaseModel):
    type: str = "bill"
    transaction: Transaction


class OcrErrorData(BaseModel):
    type: str = "error"
    message: str


class OcrResponse(BaseModel):
    data: OcrBillData | OcrErrorData
