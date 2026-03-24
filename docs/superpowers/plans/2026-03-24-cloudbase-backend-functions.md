# CloudBase Python 云函数实施计划（Plan A）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在腾讯云 CloudBase 上部署 4 个 Python 云函数，接通语音识别(ASR)、图片识别(OCR)、账单解析(GLM)、对话查询(GLM)，供 Mobile App 调用。

**Architecture:** 每个功能独立为一个云函数目录，ASR 和 OCR 的共享代码拆分为独立模块避免跨包导入。CloudBase SCF Python 函数不支持 HTTP 分块流式响应，`chat` 函数收集完整 GLM 回复后统一返回 JSON。

**Tech Stack:** Python 3.9、腾讯云 ASR SDK (`tencentcloud-sdk-python-asr`)、腾讯云 OCR SDK (`tencentcloud-sdk-python-ocr`)、智谱 GLM SDK (`zhipuai`)、CloudBase CLI (`@cloudbase/cli`)

---

## 文件结构

```
functions/                        ← 新建
  _shared/
    asr.py                        ← 腾讯云 ASR 工具（仅 ASR 导入）
    ocr.py                        ← 腾讯云 OCR 工具（仅 OCR 导入）
    glm.py                        ← GLM 客户端工具
    response.py                   ← 统一响应格式
  record-asr/
    index.py
    asr.py                        ← 从 _shared 复制
    response.py                   ← 从 _shared 复制
    requirements.txt
  record-ocr/
    index.py
    ocr.py                        ← 从 _shared 复制
    response.py                   ← 从 _shared 复制
    requirements.txt
  bill-parse/
    index.py
    glm.py                        ← 从 _shared 复制
    response.py                   ← 从 _shared 复制
    requirements.txt
  chat/
    index.py
    glm.py                        ← 从 _shared 复制
    response.py                   ← 从 _shared 复制
    requirements.txt
cloudbaserc.json                  ← 新建，CloudBase 部署配置
```

> **为什么不共用一个 `tencent.py`？** CloudBase 每个函数是独立沙箱，`requirements.txt` 只装该函数需要的包。若把 ASR 和 OCR 导入放在同一文件，`record-asr` 函数里找不到 OCR 包会在 import 时崩溃。拆分后各自独立。

---

## Task 0：环境准备

**Files:** 无代码改动，仅环境配置

- [ ] **安装 CloudBase CLI**

```bash
npm install -g @cloudbase/cli
```

- [ ] **登录 CloudBase**

```bash
tcb login
```
浏览器弹出腾讯云登录页，完成授权后回到终端。

- [ ] **创建 CloudBase 环境**

前往 [CloudBase 控制台](https://console.cloud.tencent.com/tcb) → 新建环境 → 选择"按量计费" → 记下 **EnvId**（格式如 `coco-xxxx`）。

- [ ] **核实 `httpPath` 字段名称**

CloudBase Framework Plugin Function 的 HTTP 触发器配置字段在不同版本有差异。部署前先确认：

```bash
npm show @cloudbase/framework-plugin-function version
```

然后打开 [官方文档](https://docs.cloudbase.net/framework/plugins/function) 搜索 `httpPath` 或 `triggers`，确认当前版本的 HTTP 触发器配置字段名。本计划使用 `httpPath`，如文档显示不同字段名，在 `cloudbaserc.json` 里替换。

- [ ] **在控制台配置云函数环境变量**

CloudBase 控制台 → 云函数 → 选择函数 → 函数配置 → 环境变量，对每个函数添加：
```
TENCENT_SECRET_ID   = 你的腾讯云 SecretId
TENCENT_SECRET_KEY  = 你的腾讯云 SecretKey
GLM_API_KEY         = 你的智谱 API Key
```

---

## Task 1：项目脚手架

**Files:**
- Create: `cloudbaserc.json`
- Create: `functions/_shared/response.py`

- [ ] **创建 `cloudbaserc.json`**

```json
{
  "envId": "你的-env-id",
  "framework": {
    "name": "coco-functions",
    "plugins": {
      "function": {
        "use": "@cloudbase/framework-plugin-function",
        "inputs": {
          "functionRootPath": "./functions",
          "functions": [
            {
              "name": "record-asr",
              "memory": 256,
              "timeout": 60,
              "runtime": "Py39",
              "installDependency": true,
              "httpPath": "/api/record/asr"
            },
            {
              "name": "record-ocr",
              "memory": 256,
              "timeout": 60,
              "runtime": "Py39",
              "installDependency": true,
              "httpPath": "/api/record/ocr"
            },
            {
              "name": "bill-parse",
              "memory": 256,
              "timeout": 30,
              "runtime": "Py39",
              "installDependency": true,
              "httpPath": "/api/bill/parse"
            },
            {
              "name": "chat",
              "memory": 256,
              "timeout": 60,
              "runtime": "Py39",
              "installDependency": true,
              "httpPath": "/api/chat"
            }
          ]
        }
      }
    }
  }
}
```

> ⚠️ 把 `"你的-env-id"` 替换成 Task 0 记下的 EnvId。

- [ ] **创建 `functions/_shared/response.py`**

```python
import json


def ok(data: dict) -> dict:
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(data, ensure_ascii=False),
    }


def error(message: str, status: int = 400) -> dict:
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"error": message}, ensure_ascii=False),
    }
```

- [ ] **Commit**

```bash
git add cloudbaserc.json functions/_shared/response.py
git commit -m "feat: add CloudBase project scaffold"
```

---

## Task 2：腾讯云工具模块（ASR / OCR 分离）

**Files:**
- Create: `functions/_shared/asr.py`
- Create: `functions/_shared/ocr.py`

- [ ] **创建 `functions/_shared/asr.py`**

```python
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
```

- [ ] **创建 `functions/_shared/ocr.py`**

```python
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
```

- [ ] **Commit**

```bash
git add functions/_shared/asr.py functions/_shared/ocr.py
git commit -m "feat: add Tencent ASR/OCR shared modules"
```

---

## Task 3：GLM 工具模块

**Files:**
- Create: `functions/_shared/glm.py`

- [ ] **创建 `functions/_shared/glm.py`**

```python
import json
import os

from zhipuai import ZhipuAI


def _client() -> ZhipuAI:
    return ZhipuAI(api_key=os.environ["GLM_API_KEY"])


def parse_bill(text: str, categories: list[str]) -> dict:
    """自然语言 → 结构化账单（用于 rule-engine 未命中时）"""
    client = _client()
    system_prompt = (
        "你是记账助手，将用户描述转为结构化账单。\n"
        f"可用分类：{', '.join(categories)}\n"
        "返回 JSON，字段：amount(数字), type(expense或income), "
        "categoryName(分类名，必须从可用分类中选), note(备注，可为空字符串)"
    )
    resp = client.chat.completions.create(
        model="glm-4-flash",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text},
        ],
        response_format={"type": "json_object"},
    )
    return json.loads(resp.choices[0].message.content)


def chat_query(message: str, transactions_summary: str) -> str:
    """用户查询 + 账单上下文 → 回复文字。

    注：CloudBase SCF Python 运行时不支持 HTTP 分块流式响应，
    此处收集完整回复后返回。Mobile App 侧显示加载态即可。
    """
    client = _client()
    system_prompt = (
        "你是用户的个人财务助手，根据账单数据回答问题，语言简洁友好。\n"
        f"账单数据：\n{transactions_summary}"
    )
    resp = client.chat.completions.create(
        model="glm-4-flash",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message},
        ],
    )
    return resp.choices[0].message.content


def format_transactions(transactions: list[dict]) -> str:
    """将账单列表格式化为 GLM 可读的文字摘要"""
    if not transactions:
        return "暂无账单数据"
    lines = []
    for tx in transactions[:100]:  # 最多 100 条，避免超 token 限制
        lines.append(
            f"{tx.get('occurred_at', '')[:10]} "
            f"{'支出' if tx.get('type') == 'expense' else '收入'} "
            f"¥{tx.get('amount', 0)} "
            f"{tx.get('note', '')}"
        )
    return "\n".join(lines)
```

- [ ] **Commit**

```bash
git add functions/_shared/glm.py
git commit -m "feat: add GLM shared module"
```

---

## Task 4：record-asr 云函数

**Files:**
- Create: `functions/record-asr/index.py`
- Create: `functions/record-asr/asr.py`
- Create: `functions/record-asr/response.py`
- Create: `functions/record-asr/requirements.txt`

- [ ] **创建 `functions/record-asr/requirements.txt`**

```
tencentcloud-sdk-python-asr
tencentcloud-sdk-python-common
```

- [ ] **复制共享模块**

```bash
cp functions/_shared/asr.py functions/record-asr/asr.py
cp functions/_shared/response.py functions/record-asr/response.py
```

- [ ] **创建 `functions/record-asr/index.py`**

```python
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
```

- [ ] **本地验证模块可正常导入**

```bash
cd functions/record-asr
pip install -r requirements.txt
python -c "from asr import recognize_speech; print('OK')"
```

预期输出：`OK`（无 ImportError）

- [ ] **Commit**

```bash
git add functions/record-asr/
git commit -m "feat: add record-asr cloud function"
```

---

## Task 5：record-ocr 云函数

**Files:**
- Create: `functions/record-ocr/index.py`
- Create: `functions/record-ocr/ocr.py`
- Create: `functions/record-ocr/response.py`
- Create: `functions/record-ocr/requirements.txt`

- [ ] **创建 `functions/record-ocr/requirements.txt`**

```
tencentcloud-sdk-python-ocr
tencentcloud-sdk-python-common
```

- [ ] **复制共享模块**

```bash
cp functions/_shared/ocr.py functions/record-ocr/ocr.py
cp functions/_shared/response.py functions/record-ocr/response.py
```

- [ ] **创建 `functions/record-ocr/index.py`**

```python
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
```

- [ ] **本地验证模块可正常导入**

```bash
cd functions/record-ocr
pip install -r requirements.txt
python -c "from ocr import recognize_image; print('OK')"
```

- [ ] **Commit**

```bash
git add functions/record-ocr/
git commit -m "feat: add record-ocr cloud function"
```

---

## Task 6：bill-parse 云函数

**Files:**
- Create: `functions/bill-parse/index.py`
- Create: `functions/bill-parse/glm.py`
- Create: `functions/bill-parse/response.py`
- Create: `functions/bill-parse/requirements.txt`

- [ ] **创建 `functions/bill-parse/requirements.txt`**

```
zhipuai
```

- [ ] **复制共享模块**

```bash
cp functions/_shared/glm.py functions/bill-parse/glm.py
cp functions/_shared/response.py functions/bill-parse/response.py
```

- [ ] **创建 `functions/bill-parse/index.py`**

```python
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
```

- [ ] **本地单元测试（不需要真实 API Key）**

新建 `functions/bill-parse/test_index.py`：

```python
import json
from unittest.mock import patch, MagicMock


def test_missing_text():
    with patch.dict("os.environ", {"GLM_API_KEY": "fake"}):
        import index
        result = index.main({"body": "{}"}, {})
        assert result["statusCode"] == 400
        assert "text is required" in result["body"]


def test_invalid_amount():
    mock_result = {"amount": "not-a-number", "type": "expense", "categoryName": "餐饮", "note": ""}
    with patch.dict("os.environ", {"GLM_API_KEY": "fake"}):
        with patch("index.parse_bill", return_value=mock_result):
            import index
            result = index.main({"body": json.dumps({"text": "买咖啡", "categories": ["餐饮"]})}, {})
            assert result["statusCode"] == 500
```

```bash
cd functions/bill-parse
pip install zhipuai pytest
pytest test_index.py -v
```

预期：2 个测试通过。

- [ ] **Commit**

```bash
git add functions/bill-parse/
git commit -m "feat: add bill-parse cloud function with validation"
```

---

## Task 7：chat 云函数

**Files:**
- Create: `functions/chat/index.py`
- Create: `functions/chat/glm.py`
- Create: `functions/chat/response.py`
- Create: `functions/chat/requirements.txt`

> **关于流式响应：** CloudBase SCF Python 运行时要求函数返回完整 dict，不支持 HTTP chunked transfer。因此 `chat` 函数收集完整 GLM 回复后一次性返回。Mobile App 在等待期间显示加载状态，收到响应后整体渲染。如未来需要真正的流式体验，需改用支持 ASGI 的部署方式（如 FastAPI on CVM）。

- [ ] **创建 `functions/chat/requirements.txt`**

```
zhipuai
```

- [ ] **复制共享模块**

```bash
cp functions/_shared/glm.py functions/chat/glm.py
cp functions/_shared/response.py functions/chat/response.py
```

- [ ] **创建 `functions/chat/index.py`**

```python
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
```

- [ ] **Commit**

```bash
git add functions/chat/
git commit -m "feat: add chat cloud function"
```

---

## Task 8：部署所有函数

- [ ] **安装 CloudBase Framework 插件**

```bash
npm install -g @cloudbase/framework-plugin-function
```

- [ ] **部署**

```bash
tcb framework deploy
```

预期输出：
```
✔ record-asr 部署成功
✔ record-ocr 部署成功
✔ bill-parse 部署成功
✔ chat       部署成功
```

- [ ] **获取函数 URL**

CloudBase 控制台 → 云函数 → 点击函数名 → "触发管理" → 复制 HTTP 触发器 URL。

格式：`https://<envId>.ap-shanghai.app.tencent.com`

- [ ] **冒烟测试 bill-parse**

```bash
curl -X POST https://<你的URL>/api/bill/parse \
  -H "Content-Type: application/json" \
  -d '{"text": "买了杯咖啡38块", "categories": ["餐饮", "购物", "交通"]}'
```

预期返回：
```json
{"amount": 38, "type": "expense", "categoryName": "餐饮", "note": "咖啡"}
```

- [ ] **冒烟测试 chat**

```bash
curl -X POST https://<你的URL>/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "我这周花了多少钱？", "transactions": []}'
```

预期返回：`{"text": "..."}` 含中文回复。

- [ ] **记录 API Base URL**

把 base URL 记录在 `.env.local` 注释里，Plan B（Mobile 迁移）时使用：
```
# EXPO_PUBLIC_API_URL=https://<envId>.ap-shanghai.app.tencent.com
```

---

## 部署成功标准

- [ ] 4 个函数全部部署成功，无报错
- [ ] `bill-parse` curl 测试返回正确 JSON（amount/type/categoryName 均存在）
- [ ] `record-asr` 用真实 m4a 文件测试返回识别文字
- [ ] `record-ocr` 用小票图片测试返回文字
- [ ] `chat` 测试返回合理的中文回复
