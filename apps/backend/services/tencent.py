from config import settings
from tencentcloud.asr.v20190614 import asr_client
from tencentcloud.asr.v20190614 import models as asr_models
from tencentcloud.common import credential
from tencentcloud.ocr.v20181119 import models as ocr_models
from tencentcloud.ocr.v20181119 import ocr_client


def _get_cred():
    return credential.Credential(
        settings.tencent_secret_id,
        settings.tencent_secret_key,
    )


def recognize_speech(audio_base64: str) -> str:
    "ASR服务"
    client = asr_client.AsrClient(_get_cred(), "ap-guangzhou")
    request = asr_models.SentenceRecognitionRequest()
    request.EngSerViceType = "16k_zh"
    request.SourceType = 1
    request.VoiceFormat = "m4a"
    request.Data = audio_base64
    request.DataLen = len(audio_base64.encode())
    response = client.SentenceRecognition(request)
    return response.Result or ""


def recognize_receipt(image_base64: str) -> str:
    "OCR服务"
    client = ocr_client.OcrClient(_get_cred(), "ap-guangzhou")
    request = ocr_models.GeneralAccurateOCRRequest()
    request.ImageBase64 = image_base64
    response = client.GeneralAccurateOCR(request)
    return "\n".join(det.DetectedText for det in (response.TextDetections or []))
