import base64
import os

from tencentcloud.common import credential
from tencentcloud.asr.v20190614 import asr_client, models


def recognize_speech(audio_base64: str) -> str:
    """音频 base64 → 识别文字（腾讯云 ASR）"""
    cred = credential.Credential(
        os.environ["TENCENT_SECRET_ID"],
        os.environ["TENCENT_SECRET_KEY"],
    )
    client = asr_client.AsrClient(cred, "ap-guangzhou")

    req = models.SentenceRecognitionRequest()
    req.EngSerViceType = "16k_zh"
    req.SourceType = 1
    req.VoiceFormat = "m4a"
    req.Data = audio_base64
    req.DataLen = len(base64.b64decode(audio_base64))

    resp = client.SentenceRecognition(req)
    return resp.Result or ""
