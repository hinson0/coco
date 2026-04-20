"""Silicon LLM prompt 离线 eval。

默认 skip，不会在常规 CI 里实际调用外部 API。手动跑：

    cd apps/backend
    RUN_LIVE_EVAL=1 uv run pytest tests/test_silicon_eval.py -v -s

用途：prompt 改动后人工触发一次，确认 classify_intent / extract_bill
的语义表现没有回归。
"""

import os

import pytest

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_LIVE_EVAL") != "1",
    reason="需要 RUN_LIVE_EVAL=1 和有效的 SILICON_API_KEY 才跑",
)

INCOME_CATEGORIES = {"工资", "理财", "其他收入"}
EXPENSE_CATEGORIES = {
    "餐饮",
    "交通",
    "购物",
    "娱乐",
    "居住",
    "医疗",
    "教育",
    "通讯",
    "其他支出",
}

# ── classify_intent: (input, expected_intent) ────────
INTENT_CASES: list[tuple[str, str]] = [
    ("今天发工资 8000", "record"),
    ("买了杯咖啡 30 块", "record"),
    ("银行利息 12.5", "record"),
    ("朋友退我 50 块钱", "record"),
    ("这周花了多少", "query"),
    ("上个月收入", "query"),
    ("你好", "chat"),
    ("谢谢", "chat"),
]

# ── extract_bill: (input, expected_type, expected_category_set) ───
# category_set 采用「只要 LLM 选到集合里任一个就算通过」的宽松策略，
# 因为同义分类（如"其他收入" vs "工资"）并不算错。
BILL_CASES: list[tuple[str, str, set[str]]] = [
    ("今天发工资 8000", "income", {"工资"}),
    ("朋友退我 50 块钱", "income", INCOME_CATEGORIES),
    ("刚收到报销 300", "income", INCOME_CATEGORIES),
    ("银行利息 12.5", "income", {"理财", "其他收入"}),
    ("买了杯咖啡 30 块", "expense", {"餐饮"}),
    ("打车花了 45", "expense", {"交通"}),
    ("我请同事吃饭 200", "expense", {"餐饮"}),
    ("50 块", "expense", EXPENSE_CATEGORIES),  # 歧义 → 默认 expense
]


@pytest.mark.asyncio
@pytest.mark.parametrize(("text", "expected"), INTENT_CASES)
async def test_intent(text: str, expected: str) -> None:
    from services.silicon import classify_intent

    actual = await classify_intent(text)
    print(f"  intent({text!r}) expected={expected} actual={actual}")
    assert actual == expected, (
        f"意图误判：{text!r} 期望 {expected} 实际 {actual}"
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("text", "expected_type", "allowed_categories"), BILL_CASES
)
async def test_bill(
    text: str, expected_type: str, allowed_categories: set[str]
) -> None:
    from services.silicon import extract_bill

    bill = await extract_bill(text)
    assert bill is not None, f"extract_bill 返回 None：{text!r}"
    print(f"  bill({text!r}) → {bill}")
    assert bill["type"] == expected_type, (
        f"type 误判：{text!r} 期望 {expected_type} 实际 {bill['type']}"
    )
    assert bill["category"] in allowed_categories, (
        f"category 不在允许集合内：{text!r} 期望 {allowed_categories} 实际 {bill['category']}"
    )
