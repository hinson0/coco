"""
这是判别字段（discriminator）——前端收到 data 时，先读 data.type 来判断是哪种结果，再决定怎么处理。

  OcrResponse.data
  ├── type = "bill"      → 识别出账单，有 transaction（金额、分类等）
  ├── type = "ocr_text"  → 识别出文字但不是账单，有 ocrText 原文
  └── type = "text"      → 报错/无法识别，有 message 提示语

  前端（TypeScript）这样用：

  const res = await apiFetch<OcrResponse>("/record-ocr", ...)

  if (res.data.type === "bill") {
    // res.data.transaction.amount 可用
  } else if (res.data.type === "ocr_text") {
    // res.data.ocrText 可用
  } else {
    // res.data.message 可用
  }

  ★ Insight ─────────────────────────────────────
  这叫标签联合（tagged union）。后端和前端约定一个固定字段（type）作为"标签"，前端就能在运行时安全地做类型收窄（type
  narrowing），而不是猜测当前对象有哪些字段。这也是为什么三个类的 type 是硬编码的字符串默认值——它就是个枚举标签，不需要外部传入。
  ─────────────────────────────────────────────────
"""

from pydantic import BaseModel


class OcrRequest(BaseModel):
    imageBase64: str


class Transaction(BaseModel):
    amount: float  # 多少钱
    category: str  # 分类
    note: str  # 备注
    occurred_at: str  # 日期
    type: str  # expense | income


class OcrBillData(BaseModel):
    type: str = "bill"
    transaction: Transaction


class OcrTextData(BaseModel):
    type: str = "ocr_text"
    ocrText: str
    merchant: str | None = None


class OcrErrorData(BaseModel):
    type: str = "error"
    message: str


class OcrResponse(BaseModel):
    data: OcrBillData | OcrTextData | OcrErrorData
