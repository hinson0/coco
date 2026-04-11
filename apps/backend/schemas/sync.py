from pydantic import BaseModel


class TransactionRow(BaseModel):
    "交易的行记录"

    id: str
    user_id: str | None
    category_id: str
    amount: float
    type: str
    note: str
    occurred_at: str
    source: str
    raw_input: str | None  # [ ]
    ai_confidence: float | None
    created_at: str
    updated_at: str
    deleted_at: str | None
    account_id: str | None


class CategoryRow(BaseModel):
    "分类行记录"

    pass


class BudgetRow(BaseModel):
    """预算行记录"""


class ChatMessageRow(BaseModel):
    """聊天记录的行记录"""


class AccountRow(BaseModel):
    """账号行记录"""


class UserProfileRow(BaseModel):
    """我的行记录"""


class SyncPushRequest(BaseModel):
    """同步推送请求"""


class SyncPullResponse(BaseModel):
    """同步拉取"""
