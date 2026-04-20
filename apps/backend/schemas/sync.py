from datetime import UTC, date, datetime
from uuid import UUID

from pydantic import BaseModel, field_validator


class TransactionRow(BaseModel):
    "交易的行记录"

    id: UUID
    user_id: UUID | None = None
    category_id: UUID
    amount: float
    type: str
    note: str
    occurred_at: datetime
    source: str
    raw_input: str | None = None  # 用户的原始输入文本
    receipt_url: str | None = None
    ai_confidence: float | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None
    account_id: UUID | None = None

    @field_validator("occurred_at", mode="before")
    @classmethod
    def coerce_empty_occurred_at(cls, v):
        # 历史数据里 OCR 写入的 occurred_at 可能是空串/None（早期 bug），
        # 直接拒绝会让整批 sync push 返回 422。用当前时间兜底。
        # 不能用 info.data["created_at"]，因为字段顺序 occurred_at 在 created_at 之前。
        if not v:
            return datetime.now(UTC)
        return v


class CategoryRow(BaseModel):
    "分类行记录"

    id: UUID
    user_id: UUID | None = None
    name: str
    icon: str
    type: str  # 支出/收入
    is_default: bool
    deleted_at: datetime | None = None
    updated_at: datetime


class BudgetRow(BaseModel):
    """预算行记录"""

    id: UUID
    user_id: UUID
    category_id: UUID | None = None
    amount: float
    period: str  #  月 年 周期的意思
    start_date: date
    updated_at: datetime
    deleted_at: datetime | None = None

    @field_validator("start_date", mode="before")
    @classmethod
    def parse_start_date(cls, v):
        if isinstance(v, str):
            return datetime.fromisoformat(v.replace("Z", "+00:00")).date()
        return v


class ChatMessageRow(BaseModel):
    """聊天记录的行记录"""

    id: UUID
    user_id: UUID
    role: str
    content_type: str
    content: str
    transaction_id: UUID | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None
    audio_uri: str | None = None
    duration_seconds: int | None = None


class AccountRow(BaseModel):
    """账号行记录"""

    id: UUID
    user_id: UUID | None = None  # 为 None 时是系统预制的账户.
    name: str
    icon: str
    type: str
    initial_balance: float
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class UserProfileRow(BaseModel):
    """我的行记录"""

    id: UUID
    nickname: str | None = None
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
