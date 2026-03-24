import json
from response import ok, error
from ocr import recognize_image


def main(event, context):
    try:
        body = json.loads(event.get("body") or "{}")
        image_base64 = body.get("imageBase64", "")
        if not image_base64:
            return error("imageBase64 is required")

        text = recognize_image(image_base64)
        return ok({"text": text})

    except Exception as e:
        return error(f"图片识别失败：{str(e)}", status=500)
