import structlog
from tencentcloud.common import credential
from tencentcloud.sms.v20210111 import models as sms_models
from tencentcloud.sms.v20210111 import sms_client as sms_client_module

from infra.config import settings

log = structlog.get_logger()

SmsClient = sms_client_module.SmsClient


def send_sms_code(phone: str, code: str) -> bool:
    """发送短信验证码，成功返回 True，失败返回 False。"""
    try:
        cred = credential.Credential(
            settings.tencent_secret_id, settings.tencent_secret_key
        )
        client = SmsClient(cred, "ap-guangzhou")

        req = sms_models.SendSmsRequest()
        req.SmsSdkAppId = settings.sms_app_id
        req.SignName = settings.sms_sign_name
        req.TemplateId = settings.sms_template_id
        req.TemplateParamSet = [code, "5"]
        req.PhoneNumberSet = [f"+86{phone}"]

        resp = client.SendSms(req)

        if resp.SendStatusSet and resp.SendStatusSet[0].Code == "Ok":
            log.info("sms_sent", phone=phone[-4:])
            return True

        log.warning(
            "sms_send_failed",
            phone=phone[-4:],
            code=resp.SendStatusSet[0].Code
            if resp.SendStatusSet
            else "unknown",
        )
        return False
    except Exception:
        log.exception("sms_send_error", phone=phone[-4:])
        return False
