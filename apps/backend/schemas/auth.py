from pydantic import BaseModel


class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class SmsSendRequest(BaseModel):
    phone: str


class SmsVerifyRequest(BaseModel):
    phone: str
    code: str


class BindPhoneRequest(BaseModel):
    phone: str
    code: str


class BindEmailRequest(BaseModel):
    email: str
    password: str


class UserInfoResponse(BaseModel):
    id: str
    email: str | None = None
    phone: str | None = None
