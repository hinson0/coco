import os
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from asr import recognize_speech
from ocr import recognize_image
from glm import parse_bill, chat_query, format_transactions

load_dotenv()

app = FastAPI()


# ── 请求模型 ──────────────────────────────────────────────

class AsrRequest(BaseModel):
    audioBase64: str

class OcrRequest(BaseModel):
    imageBase64: str

class BillParseRequest(BaseModel):
    text: str
    categories: list[str] = []

class ChatRequest(BaseModel):
    message: str
    transactions: list[dict] = []


# ── 路由 ──────────────────────────────────────────────────

@app.post("/api/record/asr")
async def record_asr(req: AsrRequest):
    try:
        text = recognize_speech(req.audioBase64)
        return {"text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"语音识别失败：{e}")


@app.post("/api/record/ocr")
async def record_ocr(req: OcrRequest):
    try:
        text = recognize_image(req.imageBase64)
        return {"text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"图片识别失败：{e}")


@app.post("/api/bill/parse")
async def bill_parse(req: BillParseRequest):
    try:
        result = parse_bill(req.text, req.categories)
        if not isinstance(result.get("amount"), (int, float)):
            raise ValueError("GLM 返回格式异常：缺少 amount")
        if result.get("type") not in ("expense", "income"):
            raise ValueError("GLM 返回格式异常：type 无效")
        if not result.get("categoryName"):
            raise ValueError("GLM 返回格式异常：缺少 categoryName")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"账单解析失败：{e}")


@app.post("/api/chat")
async def chat(req: ChatRequest):
    try:
        summary = format_transactions(req.transactions)
        reply = chat_query(req.message, summary)
        return {"text": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"对话失败：{e}")
