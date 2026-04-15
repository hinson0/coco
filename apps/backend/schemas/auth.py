from pydantic import BaseModel


class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class ProStatus(BaseModel):
    is_pro: bool  # 当前是否有 Pro 权限（试用中或已购买）
    is_trial: bool  # 是否在试用期
    trial_days_left: int  # 试用剩余天数（非试用为 0）
    pro_expires_at: str | None  # VIP 到期时间 ISO 格式（None = 非 VIP）


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    pro_status: ProStatus


class RefreshRequest(BaseModel):
    refresh_token: str
