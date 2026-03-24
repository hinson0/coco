import json
from response import ok, error
from asr import recognize_speech


def main(event, context):
    try:
        body = json.loads(event.get("body") or "{}")
        audio_base64 = body.get("audioBase64", "")
        if not audio_base64:
            return error("audioBase64 is required")

        text = recognize_speech(audio_base64)
        return ok({"text": text})

    except Exception as e:
        return error(f"语音识别失败：{str(e)}", status=500)
