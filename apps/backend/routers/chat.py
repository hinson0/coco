import re

from config import settings
from fastapi import APIRouter, Request
from jose import jwt
from schemas.chat import ChatBillData, ChatRequest, ChatResponse, ChatTextData
from schemas.ocr import Transaction
from services.silicon import (
    chat_reply,
    classify_intent,
    extract_bill,
    generate_sql,
    summarize_result,
)

from supabase import create_client

router = APIRouter(prefix="/chat", tags=["chat"])


def get_user_id(request: Request) -> str | None:
    """从 Authorization header 解码 user_id"""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth.split(" ")[1]
    try:
        payload = jwt.get_unverified_claims(token)
        return payload.get("sub")
    except Exception:
        return None


def is_safe_sql(sql: str) -> bool:
    stripped = sql.strip().upper()
    return stripped.startswith("SELECT") and not any(
        kw in stripped
        for kw in ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE"]
    )


@router.post("", response_model=ChatResponse)
async def chat(body: ChatRequest, request: Request):
    try:
        # intent
        intent = await classify_intent(body.text)

        # record 的intent
        if intent == "record":
            # 调 extract_bill，成功返回 ChatBillData，失败返回 ChatTextData
            bill = await extract_bill(body.text)
            if bill:
                transaction = Transaction(
                    amount=float(bill["amount"]),
                    category=str(bill.get("category", "其他支出")),
                    note=bill.get("note", ""),
                    type="income" if bill.get("type") == "income" else "expense",
                    occurred_at=bill.get("occurred_at", ""),
                )
                return ChatResponse(data=ChatBillData(transaction=transaction))
            else:
                return ChatResponse(
                    data=ChatTextData(
                        content="没解析到账单信息，可以试试「手动记账」。"
                    )
                )
        elif intent == "query":
            user_id = get_user_id(request)
            if not user_id:
                return ChatResponse(
                    data=ChatTextData(content="登录状态异常，请重新登录。")
                )
            sql = await generate_sql(body.text)
            if not is_safe_sql(sql):
                return ChatResponse(data=ChatTextData(content="查询失败，请换个说法。"))

            # 注入 user_id
            sql = re.sub(
                r"WHERE\s+",
                f"WHERE transactions.user_id = '{user_id}' AND ",
                sql,
                flags=re.IGNORECASE,
            )

            supabase = create_client(
                settings.supabase_url,
                settings.supabase_service_role_key,
            )

            try:
                result = supabase.rpc("exec_readonly_sql", {"sql_text": sql}).execute()
                query_result = result.data
            except Exception:
                return ChatResponse(
                    data=ChatTextData(content="查询出错，请换个方式描述。")
                )

            result = await summarize_result(question=body.text, rows=query_result)
            return ChatResponse(data=ChatTextData(content=result))
        else:
            reply = await chat_reply(body.text)
            return ChatResponse(data=ChatTextData(content=reply))
    except Exception as e:
        return ChatResponse(data=ChatTextData(content="处理失败，请稍后再试。"))
