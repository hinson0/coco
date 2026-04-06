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


# ── 语音输入（audioBase64） ──────────────────────────
@patch("routers.chat.classify_intent", new_callable=AsyncMock, return_value="record")
@patch(
    "routers.chat.extract_bill",
    new_callable=AsyncMock,
    return_value={
        "amount": 30,
        "category": "餐饮",
        "note": "咖啡",
        "type": "expense",
        "occurred_at": "2026-04-04T10:00:00+08:00",
    },
)
@patch(
    "routers.chat.recognize_speech",
    return_value="买了杯咖啡30块",
)
def test_chat_audio_record(mock_asr, mock_bill, mock_intent):
    resp = client.post("/chat", json={"audioBase64": "fakebase64"}, headers=HEADERS)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["type"] == "bill"
    assert data["asrText"] == "买了杯咖啡30块"
    assert data["transaction"]["amount"] == 30


@patch(
    "routers.chat.recognize_speech",
    return_value="",
)
def test_chat_audio_empty_asr(mock_asr):
    resp = client.post("/chat", json={"audioBase64": "fakebase64"}, headers=HEADERS)
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["type"] == "text"
    assert "没听清" in data["content"]


def test_chat_no_text_no_audio():
    resp = client.post("/chat", json={}, headers=HEADERS)
    assert resp.status_code == 422  # Pydantic validation error


# ── query 意图返回 nl_result ─────────────────────────
@patch("routers.chat.classify_intent", new_callable=AsyncMock, return_value="query")
@patch(
    "routers.chat.generate_sql",
    new_callable=AsyncMock,
    return_value="SELECT SUM(amount) FROM transactions WHERE deleted_at IS NULL",
)
@patch(
    "routers.chat.summarize_result",
    new_callable=AsyncMock,
    return_value="本月共消费 2350.00 元",
)
def test_chat_query_returns_nl_result(mock_summary, mock_sql, mock_intent):
    with (
        patch("routers.chat.get_user_id", return_value="user-123"),
        patch("routers.chat.create_client") as mock_supabase,
    ):
        mock_rpc = MagicMock()
        mock_rpc.execute.return_value = MagicMock(data=[{"sum": 2350}])
        mock_supabase.return_value.rpc.return_value = mock_rpc

        resp = client.post("/chat", json={"text": "这个月花了多少"}, headers=HEADERS)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["type"] == "nl_result"
        assert "2350" in data["content"]
