from fastapi import APIRouter
from schemas.asr import AsrData, AsrRequest, AsrResponse
from services.tencent import recognize_speech

router = APIRouter(prefix="/record-asr", tags=["asr"])


@router.post("", response_model=AsrResponse)
def record_asr(body: AsrRequest):
    asr_text = recognize_speech(body.audioBase64)
    return AsrResponse.model_validate({"data": AsrData(asrText=asr_text)})
