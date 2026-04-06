import pytest
from routers.chat import is_safe_sql
from services.silicon import extract_json, extract_sql


# ── extract_json ──────────────────────────────────────
def test_extract_json_plain():
    assert extract_json('{"intent": "record"}') == {"intent": "record"}


def test_extract_json_markdown_block():
    raw = '```json\n{"intent": "query"}\n```'
    assert extract_json(raw) == {"intent": "query"}


def test_extract_json_invalid():
    assert extract_json("not json at all") is None


def test_extract_json_nested_braces():
    raw = 'some text {"amount": 58.5, "category": "餐饮"} more text'
    result = extract_json(raw)
    assert result == {"amount": 58.5, "category": "餐饮"}


# ── extract_sql ───────────────────────────────────────
def test_extract_sql_plain():
    sql = "SELECT * FROM transactions WHERE deleted_at IS NULL"
    assert extract_sql(sql) == sql


def test_extract_sql_markdown_block():
    raw = "```sql\nSELECT * FROM transactions\n```"
    assert extract_sql(raw) == "SELECT * FROM transactions"


# ── is_safe_sql ───────────────────────────────────────
def test_is_safe_sql_valid_select():
    sql = "SELECT SUM(amount) FROM transactions WHERE deleted_at IS NULL"
    assert is_safe_sql(sql) is True


def test_is_safe_sql_rejects_insert():
    assert is_safe_sql("INSERT INTO transactions VALUES (1)") is False


def test_is_safe_sql_rejects_delete():
    assert is_safe_sql("DELETE FROM transactions") is False


def test_is_safe_sql_allows_deleted_at():
    # DELETED_AT 不应误判为 DELETE
    sql = "SELECT * FROM transactions WHERE deleted_at IS NULL"
    assert is_safe_sql(sql) is True


def test_is_safe_sql_rejects_drop():
    assert is_safe_sql("DROP TABLE transactions") is False


def test_is_safe_sql_rejects_update():
    assert is_safe_sql("UPDATE transactions SET amount = 0") is False


from unittest.mock import AsyncMock, patch


# ── extract_bill_from_receipt ────────────────────────
@pytest.mark.asyncio
@patch("services.silicon._call_silicon", new_callable=AsyncMock)
async def test_extract_bill_from_receipt_success(mock_call):
    mock_call.return_value = '{"amount": 99.5, "category": "餐饮", "note": "拿铁 28.00\\n美式 22.00\\n蛋糕 49.50", "type":"expense", "occurred_at": "2026-04-04T10:00:00"}'
    from services.silicon import extract_bill_from_receipt

    result = await extract_bill_from_receipt(
        "拿铁 28.00\n美式 22.00\n蛋糕 49.50\n合计 99.50"
    )
    assert result is not None
    assert result["amount"] == 99.5
    assert result["category"] == "餐饮"
    assert "拿铁" in result["note"]
    assert "\n" in result["note"]


@pytest.mark.asyncio
@patch("services.silicon._call_silicon", new_callable=AsyncMock)
async def test_extract_bill_from_receipt_no_amount(mock_call):
    mock_call.return_value = '{"amount": 0, "category": "其他支出", "note": "", "type": "expense", "occurred_at": ""}'
    from services.silicon import extract_bill_from_receipt

    result = await extract_bill_from_receipt("一堆乱码文字")
    assert result is None
