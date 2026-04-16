import re
import secrets
from typing import Annotated

import bcrypt
import jwt
import structlog
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from infra.config import settings
from infra.database import get_db
from infra.security import (
    create_access_token,
    create_refresh_token,
    get_current_user,
)
from infra.sms import send_sms_code
from schemas.auth import (
    BindEmailRequest,
    BindPhoneRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    SmsSendRequest,
    SmsVerifyRequest,
    TokenResponse,
    UserInfoResponse,
)

log = structlog.get_logger()
router = APIRouter(prefix="/auth", tags=["auth"])


UserId = Annotated[str, Depends(get_current_user)]


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(
    body: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        text("SELECT id FROM users WHERE email = :email"),
        {"email": body.email},
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="邮箱已经注册过了!")

    hashed = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    result = await db.execute(
        text(
            "INSERT INTO users (email, password) VALUES (:email, :password) RETURNING id"
        ),
        {"email": body.email, "password": hashed},
    )
    user_id = str(result.scalar_one())
    await db.commit()
    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        text("SELECT id, password FROM users WHERE email = :email"),
        {"email": body.email},
    )
    row = result.mappings().one_or_none()
    if (
        row is None
        or row["password"] is None
        or not bcrypt.checkpw(body.password.encode(), row["password"].encode())
    ):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    user_id = str(row["id"])
    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest):
    try:
        payload = jwt.decode(
            body.refresh_token, settings.jwt_secret, algorithms=["HS256"]
        )
        if payload.get("type") != "refresh":
            raise ValueError("Not a refresh token")
        user_id: str = payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")

    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )


def _validate_phone(phone: str) -> None:
    if not re.match(r"^1[3-9]\d{9}$", phone):
        raise HTTPException(status_code=400, detail="手机号格式不正确")


@router.post("/sms/send")
async def sms_send(
    body: SmsSendRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    _validate_phone(body.phone)

    # 清理该手机号的过期记录
    await db.execute(
        text("""
            DELETE FROM sms_codes
            WHERE phone = :phone AND (expires_at < now() OR used = true)
        """),
        {"phone": body.phone},
    )

    # 频率限制: 60秒内不能重复发送
    result = await db.execute(
        text("""
            SELECT id FROM sms_codes
            WHERE phone = :phone AND created_at > now() - interval '60 seconds'
            ORDER BY created_at DESC LIMIT 1
        """),
        {"phone": body.phone},
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=429, detail="发送过于频繁，请60秒后重试"
        )

    # 每日上限: 10条
    count_result = await db.execute(
        text("""
            SELECT COUNT(*) FROM sms_codes
            WHERE phone = :phone AND created_at > now() - interval '1 day'
        """),
        {"phone": body.phone},
    )
    if count_result.scalar_one() >= 10:
        raise HTTPException(status_code=429, detail="今日发送次数已达上限")

    code = f"{secrets.randbelow(1000000):06d}"

    if not send_sms_code(body.phone, code):
        raise HTTPException(status_code=500, detail="短信发送失败，请稍后重试")

    await db.execute(
        text("""
            INSERT INTO sms_codes (phone, code, expires_at)
            VALUES (:phone, :code, now() + interval '5 minutes')
        """),
        {"phone": body.phone, "code": code},
    )
    await db.commit()
    return {"message": "验证码已发送"}


@router.post("/sms/verify", response_model=TokenResponse)
async def sms_verify(
    body: SmsVerifyRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    _validate_phone(body.phone)

    # 查找有效验证码
    result = await db.execute(
        text("""
            SELECT id FROM sms_codes
            WHERE phone = :phone AND code = :code
              AND expires_at > now() AND used = false
            ORDER BY created_at DESC LIMIT 1
        """),
        {"phone": body.phone, "code": body.code},
    )
    code_id = result.scalar_one_or_none()
    if code_id is None:
        raise HTTPException(status_code=401, detail="验证码错误或已过期")

    # 标记已使用
    await db.execute(
        text("UPDATE sms_codes SET used = true WHERE id = :id"),
        {"id": code_id},
    )

    # 查用户
    result = await db.execute(
        text("SELECT id FROM users WHERE phone = :phone"),
        {"phone": body.phone},
    )
    row = result.mappings().one_or_none()

    if row:
        user_id = str(row["id"])
    else:
        # 自动注册
        result = await db.execute(
            text("INSERT INTO users (phone) VALUES (:phone) RETURNING id"),
            {"phone": body.phone},
        )
        user_id = str(result.scalar_one())

    await db.commit()
    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )


@router.get("/me", response_model=UserInfoResponse)
async def me(
    current_user_id: UserId,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        text("SELECT id, email, phone FROM users WHERE id = :id"),
        {"id": current_user_id},
    )
    row = result.mappings().one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="用户不存在")
    return UserInfoResponse(
        id=str(row["id"]), email=row["email"], phone=row["phone"]
    )


@router.post("/bind/phone")
async def bind_phone(
    body: BindPhoneRequest,
    current_user_id: UserId,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    _validate_phone(body.phone)

    # 验证验证码
    result = await db.execute(
        text("""
            SELECT id FROM sms_codes
            WHERE phone = :phone AND code = :code
              AND expires_at > now() AND used = false
            ORDER BY created_at DESC LIMIT 1
        """),
        {"phone": body.phone, "code": body.code},
    )
    code_id = result.scalar_one_or_none()
    if code_id is None:
        raise HTTPException(status_code=401, detail="验证码错误或已过期")

    await db.execute(
        text("UPDATE sms_codes SET used = true WHERE id = :id"),
        {"id": code_id},
    )

    # 检查手机号是否已被其他用户占用
    result = await db.execute(
        text("SELECT id FROM users WHERE phone = :phone AND id != :user_id"),
        {"phone": body.phone, "user_id": current_user_id},
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="该手机号已被其他账户绑定")

    await db.execute(
        text("UPDATE users SET phone = :phone WHERE id = :id"),
        {"phone": body.phone, "id": current_user_id},
    )
    await db.commit()
    return {"message": "绑定成功"}


@router.post("/bind/email")
async def bind_email(
    body: BindEmailRequest,
    current_user_id: UserId,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # 检查邮箱是否已被占用
    result = await db.execute(
        text("SELECT id FROM users WHERE email = :email AND id != :user_id"),
        {"email": body.email, "user_id": current_user_id},
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="该邮箱已被其他账户注册")

    hashed = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    await db.execute(
        text(
            "UPDATE users SET email = :email, password = :password WHERE id = :id"
        ),
        {"email": body.email, "password": hashed, "id": current_user_id},
    )
    await db.commit()
    return {"message": "绑定成功"}
