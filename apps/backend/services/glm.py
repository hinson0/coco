import json
import re
import time

import httpx
import structlog
from config import settings

log = structlog.get_logger()


async def call_glm(prompt: str) -> str:
    prompt_len = len(prompt)
    log.info("glm.start", prompt_len=prompt_len, model="glm-4.7-flash")
    start = time.monotonic()
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://open.bigmodel.cn/api/paas/v4/chat/completions",
                headers={"Authorization": f"Bearer {settings.glm_api_key}"},
                json={
                    "model": "glm-4.7-flash",
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=30,
            )
            response.raise_for_status()
            result = response.json()["choices"][0]["message"]["content"]
        duration_ms = round((time.monotonic() - start) * 1000)
        log.info("glm.done", prompt_len=prompt_len, duration_ms=duration_ms, response=result)
        return result
    except Exception as e:
        duration_ms = round((time.monotonic() - start) * 1000)
        log.error("glm.error", prompt_len=prompt_len, duration_ms=duration_ms, error=str(e))
        raise


def extract_json(raw: str) -> dict | None:
    """从 GLM 返回文本中提取 JSON（兼容 markdown 代码块）"""
    code_block = re.search(r"```(?:json)?\s*\n?([\s\S]*?)\n?```", raw)
    json_str = code_block.group(1).strip() if code_block else raw.strip()
    # fallback：找第一个 {...}
    if not json_str.startswith("{"):
        match = re.search(r"\{[\s\S]*\}", json_str)
        json_str = match.group(0) if match else json_str
    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        return None


def extract_sql(raw: str) -> str:
    """从 GLM 返回文本中提取 SQL"""
    code_block = re.search(r"```(?:sql)?\s*\n?([\s\S]*?)\n?```", raw)
    return code_block.group(1).strip() if code_block else raw.strip()
