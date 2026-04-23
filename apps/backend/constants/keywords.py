"""收入 / 支出语义关键词表。

单一事实源位于 packages/shared/src/constants/keywords.json，
前端（apps/mobile）通过 @coco/shared 导入对应常量，
后端在模块加载时读取同一份 JSON，以保持前后端语义一致。
"""

import json
from pathlib import Path

_REL = Path("packages/shared/src/constants/keywords.json")


def _find_keywords_json() -> Path:
    for parent in Path(__file__).resolve().parents:
        candidate = parent / _REL
        if candidate.is_file():
            return candidate
    raise FileNotFoundError(f"未找到 {_REL}（已向上检索至文件系统根）")


_data = json.loads(_find_keywords_json().read_text(encoding="utf-8"))

NOTIFICATION_INCOME_KEYWORDS: list[str] = _data["notification"]["income"]
NOTIFICATION_EXPENSE_KEYWORDS: list[str] = _data["notification"]["expense"]
SEMANTIC_INCOME_KEYWORDS: list[str] = _data["semantic"]["income"]
SEMANTIC_EXPENSE_KEYWORDS: list[str] = _data["semantic"]["expense"]
