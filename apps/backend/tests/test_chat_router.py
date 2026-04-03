from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

FAKE_TOKEN = "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.fake"
HEADERS = {"Authorization": FAKE_TOKEN}


# ── record 意图 ───────────────────────────────────────
@patch("routers.chat.classify_intent", new_callable=AsyncMock, return_value="record")
@patch(
    "routers.chat.extract_bill",
    new_callable=AsyncMock,
    return_value={
        "amount": 58.5,
        "category": "餐饮",
        "note": "午饭",
        "type": "expense",
        "occurred_at": "2026-04-03T12:00:00+08:00",
    },
)
def test_chat_record_success(mock_bill, mock_intent):
    resp = client.post("/chat", json={"text": "午饭花了58.5"}, headers=HEADERS)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["type"] == "bill"
    assert data["transaction"]["amount"] == 58.5
    assert data["transaction"]["category"] == "餐饮"


@patch("routers.chat.classify_intent", new_callable=AsyncMock, return_value="record")
@patch("routers.chat.extract_bill", new_callable=AsyncMock, return_value=None)
def test_chat_record_fail(mock_bill, mock_intent):
    resp = client.post("/chat", json={"text": "随便说说"}, headers=HEADERS)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["type"] == "text"
    assert "手动记账" in data["content"]


# ── chat 意图 ─────────────────────────────────────────
@patch("routers.chat.classify_intent", new_callable=AsyncMock, return_value="chat")
@patch(
    "routers.chat.chat_reply",
    new_callable=AsyncMock,
    return_value="你好！有什么我可以帮你的？",
)
def test_chat_casual(mock_reply, mock_intent):
    resp = client.post("/chat", json={"text": "你好"}, headers=HEADERS)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["type"] == "text"
    assert "你好" in data["content"]


# ── is_safe_sql 在路由层的作用 ────────────────────────
@patch("routers.chat.classify_intent", new_callable=AsyncMock, return_value="query")
@patch(
    "routers.chat.generate_sql",
    new_callable=AsyncMock,
    return_value="DELETE FROM transactions",
)
def test_chat_query_unsafe_sql(mock_sql, mock_intent):
    resp = client.post("/chat", json={"text": "删掉所有记录"}, headers=HEADERS)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["type"] == "text"
    assert "查询失败" in data["content"]
