import os

from tencentcloud.common import credential
from tencentcloud.ocr.v20181119 import ocr_client, models


def recognize_image(image_base64: str) -> str:
    """图片 base64 → 识别文字（腾讯云 OCR）"""
    cred = credential.Credential(
        os.environ["TENCENT_SECRET_ID"],
        os.environ["TENCENT_SECRET_KEY"],
    )
    client = ocr_client.OcrClient(cred, "ap-guangzhou")

    req = models.GeneralBasicOCRRequest()
    req.ImageBase64 = image_base64

    resp = client.GeneralBasicOCR(req)
    return "".join(item.DetectedText for item in resp.TextDetections)
