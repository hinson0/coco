import json
import re
from collections.abc import AsyncGenerator
from datetime import UTC, datetime

import httpx

from constants.keywords import (
    SEMANTIC_EXPENSE_KEYWORDS,
    SEMANTIC_INCOME_KEYWORDS,
)
from infra.config import settings

_INCOME_KW = "、".join(SEMANTIC_INCOME_KEYWORDS)
_EXPENSE_KW = "、".join(SEMANTIC_EXPENSE_KEYWORDS)


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

        判定规则：
        - record：用户在描述一笔**消费或收入**。只要文本里出现具体金额（数字 + 元/块/¥ 或纯数字），
          并且整体语义是陈述一笔收支（而不是在问问题），就是 record。
          * 支出例子："买了杯咖啡 30 块"、"打车 45"、"交房租 3000"
          * 收入例子："银行利息 12.5"、"发工资 8000"、"朋友退我 50"、"理财收益 200"、"报销 300 到账"
          * 关键：收入表述常常是名词短语 + 金额（"利息 12.5"、"工资 8000"），不需要动词也算 record
        - query：用户在查询历史数据（如"这周花了多少"、"上个月收入"、"本月餐饮支出"）。
          通常含有疑问词或对比/汇总语义。
        - chat：闲聊或其他（如"谢谢"、"你是谁"、"你好"），既无金额也无查询语义。

        只返回 JSON，不要其他文字。
    """
    user = text
    raw = await _call_silicon(system, user)
    parsed = extract_json(raw)
    if parsed and (intent := parsed.get("intent", "")):
        return intent
    return "chat"


async def extract_bill(text: str) -> dict | None:
    now = datetime.now(UTC).isoformat()
    system = f"""从文字中提取记账信息，只返回 JSON。
        格式：{{"amount": number, "category": string, "note": string, "occurred_at": string, "type": "expense"|"income"}}
        分类选项（category 必须精确等于其中一项，不得使用"报销/利息/退款"等关键词本身）：
          餐饮、交通、购物、娱乐、居住、医疗、教育、通讯、工资、理财、其他收入、其他支出
        occurred_at 使用 ISO 8601 格式（如 2026-04-03T14:30:00+08:00）
        note 必须只包含具体事项，严禁包含任何日期时间词（今天、昨天、上周、早上、中午、晚上等）。
        例如：用户说"今天中午吃饭花了30"，note 应为"吃饭"而非"今天中午吃饭"，因为时间已记录在 occurred_at。

        type 判定规则（重要，必须严格执行）：
        1. 若文本包含明确的「收入语义」关键词，type="income"。收入关键词包括：
           {_INCOME_KW}。
        2. 否则若文本包含「支出语义」关键词，type="expense"。支出关键词包括：
           {_EXPENSE_KW}。
        3. 两类关键词都不明显时，默认 type="expense"。

        示例（注意 category 取值必须来自上述固定列表）：
        - 输入"今天发工资 8000" → {{"amount": 8000, "category": "工资", "type": "income", ...}}
        - 输入"朋友退我 50 块钱" → {{"amount": 50, "category": "其他收入", "type": "income", ...}}
        - 输入"刚收到报销 300" → {{"amount": 300, "category": "其他收入", "type": "income", ...}}（category 是"其他收入"，不是"报销"）
        - 输入"银行利息 12.5" → {{"amount": 12.5, "category": "理财", "type": "income", ...}}（category 是"理财"，不是"利息"）
        - 输入"买了杯咖啡 30 块" → {{"amount": 30, "category": "餐饮", "type": "expense", ...}}
        - 输入"我请同事吃饭 200" → {{"amount": 200, "category": "餐饮", "type": "expense", ...}}（"我请"代表自己付款）

        category 必须与 type 一致：type=income 时只能从「工资、理财、其他收入」中选；
        type=expense 时只能从支出类（餐饮、交通、购物、娱乐、居住、医疗、教育、通讯、其他支出）中选。

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
    now = datetime.now(UTC).isoformat()
    system = f"""从小票 OCR 文本中提取记账信息，只返回 JSON。
  格式：{{"amount": number, "category": string, "note": string, "type": "expense"|"income", "occurred_at": string}}

  规则：
  - amount：小票上的总金额（实付金额/合计金额）
  - category：分类选项为 餐饮、交通、购物、娱乐、居住、医疗、教育、通讯、工资、理财、其他收入、其他支出
  - note：逐行列出消费明细，每行格式为「商品名 金额」，用换行符分隔。例如："拿铁 28.00\\n美式 22.00\\n蛋糕 49.50"
  - type：小票绝大多数是消费凭证，默认 "expense"；但若小票标题或正文出现下列任一
    「收入语义」关键词，应判为 "income"：{_INCOME_KW}。
    category 必须与 type 一致（type=income 时仅可选 工资/理财/其他收入）。
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
    now = datetime.now(UTC).isoformat()
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


# ── 流式生成 ─────────────────────────────────────────


async def _call_silicon_stream(system: str, user: str) -> AsyncGenerator[str]:
    async with httpx.AsyncClient(timeout=300) as client:
        async with client.stream(
            "POST",
            "https://api.siliconflow.cn/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.silicon_api_key}"},
            json={
                "model": "Qwen/Qwen3-8B",
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "enable_thinking": False,
                "stream": True,
            },
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line or not line.startswith("data: "):
                    continue
                payload = line[6:].strip()
                if payload == "[DONE]":
                    return
                try:
                    parsed = json.loads(payload)
                except json.JSONDecodeError:
                    continue
                # 上游错误帧（rate-limit、鉴权失败等）不走 HTTP 状态码，而是
                # 以 `{"error": {...}}` 形式穿插在 SSE 里。必须显式抛出,
                # 否则会被调用方当成"流正常结束但零输出"，用户完全无感知。
                if isinstance(parsed, dict) and "error" in parsed:
                    err = parsed["error"]
                    message = (
                        err.get("message")
                        if isinstance(err, dict)
                        else str(err)
                    ) or "SiliconFlow stream error"
                    raise RuntimeError(f"silicon_stream_error: {message}")
                try:
                    delta = parsed["choices"][0]["delta"].get("content", "")
                except (KeyError, IndexError, TypeError):
                    continue
                if delta:
                    yield delta


async def narrate_record_stream(text: str) -> AsyncGenerator[str]:
    """记账意图的流式话术：轻松俏皮的 CoCo 口吻，友好陪伴而非消费评判。"""
    system = """
        你是 CoCo——一个轻松俏皮的记账小助手,像用户的贴心朋友。用户刚记录了
        一笔消费或收入,请用一句简短亲昵的中文做友好确认。

        风格要求:
        - 口吻轻松,带一点可爱,可用语气词(嗯嗯/噢/好呀/好咯/啦/呀/呢)
        - 可自称"CoCo"或用"我"、"帮你",让用户感到被陪伴
        - 若文本里能看出具体场景(早餐/加班/礼物/下雨),可以顺一句轻度共情
        - 若只是普通消费,简单确认即可,不要硬凑共情
        - 偶尔可用一个 emoji(~✨☕🌿 等),不强求,不要堆砌

        绝对禁止:
        - 评价消费金额是否合理、是否"小额高频"、是否"值得"
        - 说教或给理财建议("建议关注/留意/控制/月度累计"这类话一律不写)
        - 重复具体金额数字(数字已在下方账单卡片里显示,再念一遍显得啰嗦)
        - 使用"入账/台账/凭证/归入/录入"等冷冰冰的财务术语
        - 反问用户("今天累吗?""工作顺利吗?")

        字数 45 到 80 字之间。结尾用逗号或省略号留白,为后续账单卡片让路。

        示例:
        - "买了杯咖啡 28" → 「嗯嗯!咖啡这笔 CoCo 帮你记好啦~ 一口温暖下肚...」
        - "打车 45" → 「好咯~ 打车这笔记下来啦,路上辛苦啦...」
        - "发工资 8000" → 「噢噢~ 工资到账这笔必须好好记下 ✨ 辛苦一个月啦...」
        - "给妈妈买礼物 300" → 「好呀~ 这笔用心的钱我帮你收好咯...」
    """
    async for chunk in _call_silicon_stream(system, text):
        yield chunk


async def narrate_ocr_stream(ocr_excerpt: str) -> AsyncGenerator[str]:
    """OCR 识别完成后的流式话术：轻松俏皮的 CoCo 口吻,像朋友翻看小票。"""
    system = """
        你是 CoCo——一个轻松俏皮的记账小助手。刚从一张小票里读到了一些文字,
        请用一句简短亲昵的中文做友好确认,像朋友顺手帮你翻小票的感觉。

        风格要求:
        - 轻松口吻,可自称"CoCo"或用"我"、"帮你"
        - 若能看出商户类型(咖啡店/便利店/餐厅/超市)或时段(早上/傍晚)
          可以顺口带一句,但不要去推断每一项商品
        - 偶尔可用一个 emoji(🧾☕🍱🌿~ 等),不强求

        绝对禁止:
        - 罗列小票上的金额或逐项商品
        - 评价"小额支出/日常开销"、给"属于某某类"的标签
        - 财务术语(复核/凭证/入账/归入/小额高频)
        - 说教或理财建议

        字数 20 到 40 字之间。结尾用逗号或省略号留白,为后续账单卡片让路。

        示例:
        - 便利店小票 → 「噢~ 便利店的小票拿到啦,CoCo 帮你归整好咯...」
        - 餐厅小票 → 「嗯嗯,这顿饭的小票收到啦~ 吃好喝好最重要...」
        - 咖啡店小票 → 「咦~ 是咖啡店的小票呀,一天里的小治愈时刻 ☕...」
        - 超市小票 → 「好呀,这一趟超市的清单我帮你记下啦...」
    """
    async for chunk in _call_silicon_stream(system, ocr_excerpt):
        yield chunk


async def narrate_chat_stream(text: str) -> AsyncGenerator[str]:
    """闲聊意图的流式回复（替代非流式 chat_reply）。"""
    system = """
        你是 CoCo 记账助手，性格友好简洁。用简短的中文回应用户。
        不要主动提供记账帮助，只回应用户说的内容。回复在 50 字以内。
    """
    async for chunk in _call_silicon_stream(system, text):
        yield chunk
