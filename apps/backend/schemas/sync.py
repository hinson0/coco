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
    created_at: str
    updated_at: str
    deleted_at: str | None
    account_id: str | None


class CategoryRow(BaseModel):
    "分类行记录"

    id: str
    user_id: str | None
    name: str
    icon: str
    type: str  # 支出/收入
    is_default: int
    deleted_at: str | None
    updated_at: str


class BudgetRow(BaseModel):
    """预算行记录"""

    id: str
    user_id: str
    category_id: str | None
    amount: float
    period: str  #  月 年 周期的意思
    start_date: str
    updated_at: str


class ChatMessageRow(BaseModel):
    """聊天记录的行记录"""

    id: str
    user_id: str
    role: str
    content_type: str
    content: str
    transaction_id: str | None
    created_at: str
    updated_at: str
    audio_uri: str | None
    duration_seconds: int | None


class AccountRow(BaseModel):
    """账号行记录"""

    id: str
    user_id: str | None  # 为none时是指系统预制的分类.
    name: str
    icon: str
    type: str
    initial_balance: float
    created_at: str
    updated_at: str
    deleted_at: str | None


class UserProfileRow(BaseModel):
    """我的行记录"""

    id: str
    nickname: str | None
    avatar_type: str
    avatar_value: str
    created_at: str
    updated_at: str


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
