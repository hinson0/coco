from typing import Literal

from pydantic import BaseModel

from schemas.ocr import Transaction


class StreamChunkEvent(BaseModel):
    type: Literal["chunk"] = "chunk"
    text: str


class StreamBillEvent(BaseModel):
    type: Literal["bill"] = "bill"
    transaction: Transaction
    asr_text: str | None = None


class StreamTextEvent(BaseModel):
    type: Literal["text"] = "text"
    content: str
    asr_text: str | None = None


class StreamAsrEvent(BaseModel):
    type: Literal["asr"] = "asr"
    text: str


class StreamErrorEvent(BaseModel):
    type: Literal["error"] = "error"
    message: str


StreamEvent = (
    StreamChunkEvent
    | StreamBillEvent
    | StreamTextEvent
    | StreamAsrEvent
    | StreamErrorEvent
)


def sse_line(event: StreamEvent) -> str:
    """格式化为 SSE `data:` 行（含双换行结尾）。"""
    return f"data: {event.model_dump_json()}\n\n"


SSE_DONE = "data: [DONE]\n\n"
