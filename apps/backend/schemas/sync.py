from datetime import datetime

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
    raw_input: str | None  # 用户的原始输入文本
    ai_confidence: float | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
    account_id: str | None


class CategoryRow(BaseModel):
    "分类行记录"

    id: str
    user_id: str | None
    name: str
    icon: str
    type: str  # 支出/收入
    is_default: int
    deleted_at: datetime | None
    updated_at: datetime


class BudgetRow(BaseModel):
    """预算行记录"""

    id: str
    user_id: str
    category_id: str | None
    amount: float
    period: str  #  月 年 周期的意思
    start_date: str
    updated_at: datetime
    deleted_at: datetime | None


class ChatMessageRow(BaseModel):
    """聊天记录的行记录"""

    id: str
    user_id: str
    role: str
    content_type: str
    content: str
    transaction_id: str | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
    audio_uri: str | None
    duration_seconds: int | None


class AccountRow(BaseModel):
    """账号行记录"""

    id: str
    user_id: str | None  # 为 None 时是系统预制的账户.
    name: str
    icon: str
    type: str
    initial_balance: float
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


class UserProfileRow(BaseModel):
    """我的行记录"""

    id: str
    nickname: str | None
    avatar_type: str
    avatar_value: str
    created_at: datetime
    updated_at: datetime


class SyncPushRequest(BaseModel):
    """同步推送请求"""

    transactions: list[TransactionRow] = []
    categories: list[CategoryRow] = []
    budgets: list[BudgetRow] = []
    chat_messages: list[ChatMessageRow] = []
    accounts: list[AccountRow] = []
    user_profiles: list[UserProfileRow] = []


class SyncPullResponse(BaseModel):
    """同步拉取"""

    transactions: list[TransactionRow] = []
    categories: list[CategoryRow] = []
    budgets: list[BudgetRow] = []
    chat_messages: list[ChatMessageRow] = []
    accounts: list[AccountRow] = []
    user_profiles: list[UserProfileRow] = []
