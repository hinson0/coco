from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


@patch(
    "routers.ocr.extract_bill_from_receipt",
    new_callable=AsyncMock,
    return_value={
        "amount": 99.5,
        "category": "餐饮",
        "note": "拿铁 28.00\n美式 22.00\n蛋糕 49.50",
        "type": "expense",
        "occurred_at": "2026-04-04T10:00:00",
    },
)
@patch(
    "routers.ocr.recognize_receipt",
    return_value="拿铁 28.00\n美式 22.00\n蛋糕 49.50\n合计 99.50",
)
def test_ocr_bill_success(mock_ocr, mock_silicon):
    resp = client.post("/record-ocr", json={"imageBase64": "fakebase64"})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["type"] == "bill"
    assert data["transaction"]["amount"] == 99.5
    assert "拿铁" in data["transaction"]["note"]


@patch("routers.ocr.recognize_receipt", return_value="")
def test_ocr_empty_text(mock_ocr):
    resp = client.post("/record-ocr", json={"imageBase64": "fakebase64"})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["type"] == "error"


@patch(
    "routers.ocr.extract_bill_from_receipt",
    new_callable=AsyncMock,
    return_value=None,
)
@patch("routers.ocr.recognize_receipt", return_value="一些无法识别的文字")
def test_ocr_silicon_fail(mock_ocr, mock_silicon):
    resp = client.post("/record-ocr", json={"imageBase64": "fakebase64"})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["type"] == "error"


@patch(
    "routers.ocr.extract_bill_from_receipt",
    new_callable=AsyncMock,
    return_value={
        "amount": 8600,
        "category": "其他支出",
        "note": "MacBook Pro M4",
        "type": "expense",
        "occurred_at": "",
    },
)
@patch("routers.ocr.recognize_receipt", return_value="MacBook Pro M4 8600")
def test_ocr_empty_occurred_at_falls_back_to_now(mock_ocr, mock_silicon):
    resp = client.post("/record-ocr", json={"imageBase64": "fakebase64"})
    assert resp.status_code == 200
    occurred_at = resp.json()["data"]["transaction"]["occurred_at"]
    assert occurred_at, "空字符串必须被当前时间兜底"
    assert occurred_at.endswith("Z"), f"期望 Z 后缀，实际: {occurred_at}"


@patch(
    "routers.ocr.extract_bill_from_receipt",
    new_callable=AsyncMock,
    return_value={
        "amount": 30,
        "category": "饮品",
        "note": "咖啡",
        "type": "expense",
        "occurred_at": None,
    },
)
@patch("routers.ocr.recognize_receipt", return_value="咖啡 30")
def test_ocr_null_occurred_at_falls_back_to_now(mock_ocr, mock_silicon):
    resp = client.post("/record-ocr", json={"imageBase64": "fakebase64"})
    assert resp.status_code == 200
    occurred_at = resp.json()["data"]["transaction"]["occurred_at"]
    assert occurred_at, "None 必须被当前时间兜底"
