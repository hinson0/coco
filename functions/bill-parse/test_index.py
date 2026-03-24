import json
from unittest.mock import patch, MagicMock


def test_missing_text():
    with patch.dict("os.environ", {"GLM_API_KEY": "fake"}):
        import index
        result = index.main({"body": "{}"}, {})
        assert result["statusCode"] == 400
        assert "text is required" in result["body"]


def test_invalid_amount():
    mock_result = {"amount": "not-a-number", "type": "expense", "categoryName": "餐饮", "note": ""}
    with patch.dict("os.environ", {"GLM_API_KEY": "fake"}):
        with patch("index.parse_bill", return_value=mock_result):
            import index
            result = index.main({"body": json.dumps({"text": "买咖啡", "categories": ["餐饮"]})}, {})
            assert result["statusCode"] == 500
