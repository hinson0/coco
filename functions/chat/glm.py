import json
import os

from zhipuai import ZhipuAI


def _client() -> ZhipuAI:
    return ZhipuAI(api_key=os.environ["GLM_API_KEY"])


def parse_bill(text: str, categories: list[str]) -> dict:
    """自然语言 → 结构化账单（用于 rule-engine 未命中时）"""
    client = _client()
    system_prompt = (
        "你是记账助手，将用户描述转为结构化账单。\n"
        f"可用分类：{', '.join(categories)}\n"
        "返回 JSON，字段：amount(数字), type(expense或income), "
        "categoryName(分类名，必须从可用分类中选), note(备注，可为空字符串)"
    )
    resp = client.chat.completions.create(
        model="glm-4-flash",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text},
        ],
        response_format={"type": "json_object"},
    )
    return json.loads(resp.choices[0].message.content)


def chat_query(message: str, transactions_summary: str) -> str:
    """用户查询 + 账单上下文 → 回复文字。

    注：CloudBase SCF Python 运行时不支持 HTTP 分块流式响应，
    此处收集完整回复后返回。Mobile App 侧显示加载态即可。
    """
    client = _client()
    system_prompt = (
        "你是用户的个人财务助手，根据账单数据回答问题，语言简洁友好。\n"
        f"账单数据：\n{transactions_summary}"
    )
    resp = client.chat.completions.create(
        model="glm-4-flash",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message},
        ],
    )
    return resp.choices[0].message.content


def format_transactions(transactions: list[dict]) -> str:
    """将账单列表格式化为 GLM 可读的文字摘要"""
    if not transactions:
        return "暂无账单数据"
    lines = []
    for tx in transactions[:100]:  # 最多 100 条，避免超 token 限制
        lines.append(
            f"{tx.get('occurred_at', '')[:10]} "
            f"{'支出' if tx.get('type') == 'expense' else '收入'} "
            f"¥{tx.get('amount', 0)} "
            f"{tx.get('note', '')}"
        )
    return "\n".join(lines)
