from unittest.mock import MagicMock, patch

from infra.sms import send_sms_code


@patch("infra.sms.SmsClient")
def test_send_sms_code_success(mock_sms_client_class):
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.SendStatusSet = [MagicMock(Code="Ok")]
    mock_client.SendSms.return_value = mock_response
    mock_sms_client_class.return_value = mock_client

    result = send_sms_code("13812345678", "123456")
    assert result is True
    mock_client.SendSms.assert_called_once()


@patch("infra.sms.SmsClient")
def test_send_sms_code_failure(mock_sms_client_class):
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.SendStatusSet = [MagicMock(Code="FailedOperation")]
    mock_client.SendSms.return_value = mock_response
    mock_sms_client_class.return_value = mock_client

    result = send_sms_code("13812345678", "123456")
    assert result is False


@patch("infra.sms.SmsClient")
def test_send_sms_code_exception(mock_sms_client_class):
    mock_client = MagicMock()
    mock_client.SendSms.side_effect = Exception("network error")
    mock_sms_client_class.return_value = mock_client

    result = send_sms_code("13812345678", "123456")
    assert result is False
