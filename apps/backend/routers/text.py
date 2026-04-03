import re
from datetime import datetime, timezone

from config import settings
from fastapi import APIRouter, HTTPException, Request
from jose import jwt
from schemas.ocr import Transaction
from schemas.text import (
    TextBillData,
    TextErrorData,
    TextNlData,
    TextRequest,
    TextResponse,
)
from services.glm import call_glm, extract_json, extract_sql

from supabase import create_client

router = APIRouter(prefix="/record-text", tags=["text"])


def build_intent_prompt(text: str) -> str:
    return f"""判断以下用户输入的意图，返回 JSON：{{"intent": "record"}} 或 {{"intent": "query"}}。
- record：用户在描述一笔消费或收入
- query：用户在查询历史数据
只返回 JSON。
用户输入：{text}"""


def build_record_prompt(text: str) -> str:
    now = datetime.now(timezone.utc).isoformat()
    return f"""从以下文字提取记账信息，返回 JSON：
{{"amount": number, "category": string, "note": string, "occurred_at": string, "type": "expense"|"income"}}
分类选项：餐饮、交通、购物、娱乐、居住、医疗、教育、通讯、工资、理财、其他收入、其他支出
当前时间：{now}
只返回 JSON。
文字：{text}"""


def build_query_prompt(question: str) -> str:
    now = datetime.now(timezone.utc).isoformat()
    return f"""将以下问题转为 PostgreSQL SELECT 查询。
表结构：
- transactions (id, user_id, category_id, amount, type, note, occurred_at, deleted_at)
- categories (id, user_id, name, type)
规则：只生成 SELECT，必须含 WHERE deleted_at IS NULL，不含 user_id 条件（服务端注入）
当前时间：{now}
只返回 SQL。
问题：{question}"""


def build_summarize_prompt(question: str, result: str) -> str:
    return f"""用户问："{question}"
查询结果：{result}
用简洁中文回答。结果为空则说"没有找到相关记录"。"""


def get_user_id(request: Request) -> str | None:
    """从 Authorization header 解码 user_id（不验证签名，只读取 payload）"""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth.split(" ")[1]
    try:
        payload = jwt.get_unverified_claims(token)
        return payload.get("sub")
    except Exception:
        return None


@router.post("", response_model=TextResponse)
async def record_text(body: TextRequest, request: Request):
    # 1. 意图分类
    intent_raw = await call_glm(build_intent_prompt(body.text))
    intent_parsed = extract_json(intent_raw)
    intent = (
        "query"
        if intent_parsed and intent_parsed.get("intent") == "query"
        else "record"
    )

    if intent == "record":
        # 2a. 记账
        glm_raw = await call_glm(build_record_prompt(body.text))
        parsed = extract_json(glm_raw)
        if (
            parsed
            and isinstance(parsed.get("amount"), (int, float))
            and parsed["amount"] > 0
        ):
            return TextResponse(
                data=TextBillData(
                    transaction=Transaction(
                        amount=float(parsed["amount"]),
                        category=str(parsed.get("category", "其他支出")),
                        note=str(parsed.get("note", "")),
                        type="income" if parsed.get("type") == "income" else "expense",
                        occurred_at=str(parsed.get("occurred_at", "")),
                    )
                )
            )
        return TextResponse(
            data=TextErrorData(message="没有识别到记账信息，请再描述一下。")
        )

    # 2b. 查询
    user_id = get_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    sql_raw = await call_glm(build_query_prompt(body.text))
    sql = extract_sql(sql_raw)
    # 注入 user_id
    sql = re.sub(
        r"WHERE\s+",
        f"WHERE transactions.user_id = '{user_id}' AND ",
        sql,
        flags=re.IGNORECASE,
    )

    supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)
    try:
        result = supabase.rpc("exec_readonly_sql", {"sql_text": sql}).execute()
        query_result = result.data
    except Exception:
        return TextResponse(data=TextErrorData(message="查询出错，请换个方式描述。"))

    summary_raw = await call_glm(build_summarize_prompt(body.text, str(query_result)))
    return TextResponse(data=TextNlData(message=summary_raw))
