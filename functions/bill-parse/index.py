import json
from response import ok, error
from glm import parse_bill


def main(event, context):
    try:
        body = json.loads(event.get("body") or "{}")
        text = body.get("text", "")
        categories = body.get("categories", [])

        if not text:
            return error("text is required")

        result = parse_bill(text, categories)

        # 校验必要字段，防止 GLM 返回不完整格式
        if not isinstance(result.get("amount"), (int, float)):
            return error("GLM 返回格式异常：缺少 amount", status=500)
        if result.get("type") not in ("expense", "income"):
            return error("GLM 返回格式异常：type 无效", status=500)
        if not result.get("categoryName"):
            return error("GLM 返回格式异常：缺少 categoryName", status=500)

        return ok(result)

    except Exception as e:
        return error(f"账单解析失败：{str(e)}", status=500)
