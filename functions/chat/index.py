import json
from response import ok, error
from glm import chat_query, format_transactions


def main(event, context):
    try:
        body = json.loads(event.get("body") or "{}")
        message = body.get("message", "")
        transactions = body.get("transactions", [])

        if not message:
            return error("message is required")

        summary = format_transactions(transactions)
        reply = chat_query(message, summary)

        return ok({"text": reply})

    except Exception as e:
        return error(f"对话失败：{str(e)}", status=500)
