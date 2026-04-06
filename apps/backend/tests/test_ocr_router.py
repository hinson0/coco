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
