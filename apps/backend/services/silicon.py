import json
import re
from datetime import datetime, timezone

import httpx
from infra.config import settings


# ── 工具函数 ─────────────────────────────────────────
def extract_json(raw: str) -> dict | None:
    """从 silicon 返回文本中提取 JSON（兼容 markdown 代码块）"""
    code_block = re.search(r"```(?:json)?\s*\n?([\s\S]*?)\n?```", raw)
    json_str = code_block.group(1).strip() if code_block else raw.strip()
    # fallback：找第一个 {...}
    if not json_str.startswith("{"):
        match = re.search(r"\{[\s\S]*\}", json_str)
        json_str = match.group(0) if match else json_str
    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        return None


def extract_sql(raw: str) -> str:
    """从 silicon 返回文本中提取 SQL"""
    code_block = re.search(r"```(?:sql)?\s*\n?([\s\S]*?)\n?```", raw)
    return code_block.group(1).strip() if code_block else raw.strip()


# ── 私有 API 调用 ─────────────────────────────────────
async def _call_silicon(system: str, user: str) -> str:
    # POST https://api.siliconflow.cn/v1/chat/completions
    # model: "Qwen/Qwen3-8B"
    # messages: [{"role": "system", ...}, {"role": "user", ...}]
    # 参考 services/glm.py 的 call_glm 结构
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.siliconflow.cn/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.silicon_api_key}"},
            json={
                "model": "Qwen/Qwen3-8B",
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "enable_thinking": False,
            },
            timeout=300,
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]


# ── 对外函数 ─────────────────────────────────────────
async def classify_intent(text: str) -> str:
    system = """
        你是记账助手。判断用户输入的意图，只返回 JSON。
            格式：{"intent": "record"} 或 {"intent": "query"} 或 {"intent": "chat"}
            - record：用户在描述一笔消费或收入（如"买了杯咖啡30块"）
            - query：用户在查询历史数据（如"这周花了多少"）
            - chat：闲聊或其他（如"谢谢"、"你是谁"）
        只返回 JSON，不要其他文字。
    """
    user = text
    raw = await _call_silicon(system, user)
    parsed = extract_json(raw)
    if parsed and (intent := parsed.get("intent", "")):
        return intent
    return "chat"


async def extract_bill(text: str) -> dict | None:
    now = datetime.now(timezone.utc).isoformat()
    system = """从文字中提取记账信息，只返回 JSON。
        格式：{"amount": number, "category": string, "note": string, "occurred_at": string, "type": "expense"|"income"}
        分类选项：餐饮、交通、购物、娱乐、居住、医疗、教育、通讯、工资、理财、其他收入、其他支出
        occurred_at 使用 ISO 8601 格式（如 2026-04-03T14:30:00+08:00）
        note 必须只包含具体事项，严禁包含任何日期时间词（今天、昨天、上周、早上、中午、晚上等）。
        例如：用户说"今天中午吃饭花了30"，note 应为"吃饭"而非"今天中午吃饭"，因为时间已记录在 occurred_at。
        只返回 JSON，不要其他文字。
    """
    user = f"当前时间：{now}\n文字：{text}"
    raw = await _call_silicon(system, user)
    parsed = extract_json(raw)
    if (
        parsed
        and isinstance(parsed.get("amount"), (int, float))
        and parsed["amount"] > 0
    ):
        return parsed
    return None


async def extract_bill_from_receipt(raw_text: str) -> dict | None:
    """从小票 OCR 文本中提取记账信息（含逐行消费明细）"""
    now = datetime.now(timezone.utc).isoformat()
    system = """从小票 OCR 文本中提取记账信息，只返回 JSON。
  格式：{"amount": number, "category": string, "note": string, "type": "expense"|"income", "occurred_at": string}

  规则：
  - amount：小票上的总金额（实付金额/合计金额）
  - category：分类选项为 餐饮、交通、购物、娱乐、居住、医疗、教育、通讯、工资、理财、其他收入、其他支出
  - note：逐行列出消费明细，每行格式为「商品名 金额」，用换行符分隔。例如："拿铁 28.00\\n美式 22.00\\n蛋糕 49.50"
  - type：通常为 "expense"
  - occurred_at：小票上的日期，使用 ISO 8601 格式。若无日期则留空字符串

  只返回 JSON，不要其他文字。"""
    user = f"当前时间：{now}\n小票 OCR 文本：\n{raw_text}"
    raw = await _call_silicon(system, user)
    parsed = extract_json(raw)
    if (
        parsed
        and isinstance(parsed.get("amount"), (int, float))
        and parsed["amount"] > 0
    ):
        return parsed
    return None


async def generate_sql(text: str) -> str:
    """
       将用户的问题转为 PostgreSQL SELECT 查询。
    表结构：
    - transactions(id, user_id, category_id, amount, type, note, occurred_at, deleted_at)
    - categories(id, user_id, name, type)
    规则：
    1. 只生成 SELECT 语句
    2. 必须包含 WHERE deleted_at IS NULL
    3. 不要包含 user_id 条件（服务端自动注入）
    4. occurred_at 是 UTC 时间，时间范围用 >= / <= 过滤
    只返回 SQL，不要其他文字。
    user prompt：f"当前时间（UTC）：{now}\n问题：{text}"
    """
    now = datetime.now(timezone.utc).isoformat()
    system = """
       将用户的问题转为 PostgreSQL SELECT 查询。
        表结构：
        - transactions(id, user_id, category_id, amount, type, note, occurred_at, deleted_at)
        - categories(id, user_id, name, type)
        规则：
        1. 只生成 SELECT 语句
        2. 必须包含 WHERE deleted_at IS NULL
        3. 不要包含 user_id 条件（服务端自动注入）
        4. occurred_at 是 UTC 时间，时间范围用 >= / <= 过滤
        只返回 SQL，不要其他文字。
    """
    user = f"当前时间：{now}\n文字：{text}"
    raw = await _call_silicon(system, user)
    return extract_sql(raw)


async def summarize_result(question: str, rows: list) -> str:
    system = """
        你是记账助手。根据查询结果，用简洁的中文回答用户的问题。
    结果为空列表时说"没有找到相关记录"。金额保留两位小数，加"¥"符号。
    """
    user = f'用户问："{question}"\n查询结果：{rows}'
    return await _call_silicon(system, user)


async def chat_reply(text: str) -> str:
    system = """
        你是 CoCo 记账助手，性格友好简洁。用简短的中文回应用户。
        不要主动提供记账帮助，只回应用户说的内容。回复在 50 字以内。
    """
    return await _call_silicon(system, text)
