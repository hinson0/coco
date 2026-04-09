import time

import structlog
from infra.config import settings
from tencentcloud.asr.v20190614 import asr_client
from tencentcloud.asr.v20190614 import models as asr_models
from tencentcloud.common import credential
from tencentcloud.common.exception.tencent_cloud_sdk_exception import (
    TencentCloudSDKException,
)
from tencentcloud.ocr.v20181119 import models as ocr_models
from tencentcloud.ocr.v20181119 import ocr_client

log = structlog.get_logger()


def _get_cred():
    return credential.Credential(
        settings.tencent_secret_id,
        settings.tencent_secret_key,
    )


def recognize_speech(audio_base64: str) -> str:
    """识别语音"""
    audio_len = len(audio_base64.encode())
    log.info("asr.start", audio_len=audio_len)
    start = time.monotonic()
    try:
        client = asr_client.AsrClient(_get_cred(), "ap-guangzhou")
        request = asr_models.SentenceRecognitionRequest()
        request.EngSerViceType = "16k_zh"
        request.SourceType = 1
        request.VoiceFormat = "m4a"
        request.Data = audio_base64
        request.DataLen = audio_len
        response = client.SentenceRecognition(request)
        result = response.Result or ""
        duration_ms = round((time.monotonic() - start) * 1000)
        log.info(
            "asr.done", audio_len=audio_len, duration_ms=duration_ms, result=result
        )
        return result
    except TencentCloudSDKException as e:
        duration_ms = round((time.monotonic() - start) * 1000)
        log.error(
            "asr.error",
            audio_len=audio_len,
            duration_ms=duration_ms,
            error_code=e.get_code(),
            error=e.get_message(),
        )
        raise
    except Exception as e:
        duration_ms = round((time.monotonic() - start) * 1000)
        log.error(
            "asr.error", audio_len=audio_len, duration_ms=duration_ms, error=str(e)
        )
        raise


def recognize_receipt(image_base64: str) -> str:
    "OCR服务"
    image_len = len(image_base64.encode())
    log.info("ocr.start", image_len=image_len)
    start = time.monotonic()
    try:
        client = ocr_client.OcrClient(_get_cred(), "ap-guangzhou")
        request = ocr_models.GeneralAccurateOCRRequest()
        request.ImageBase64 = image_base64
        response = client.GeneralAccurateOCR(request)
        raw_text = "\n".join(
            det.DetectedText for det in (response.TextDetections or [])
        )
        duration_ms = round((time.monotonic() - start) * 1000)
        log.info(
            "ocr.done",
            image_len=image_len,
            duration_ms=duration_ms,
            raw_len=len(raw_text.encode()),
        )
        return raw_text
    except TencentCloudSDKException as e:
        duration_ms = round((time.monotonic() - start) * 1000)
        log.error(
            "ocr.error",
            image_len=image_len,
            duration_ms=duration_ms,
            error_code=e.get_code(),
            error=e.get_message(),
        )
        raise
    except Exception as e:
        duration_ms = round((time.monotonic() - start) * 1000)
        log.error(
            "ocr.error", image_len=image_len, duration_ms=duration_ms, error=str(e)
        )
        raise
