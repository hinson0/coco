from typing import Annotated

import bcrypt
import jwt
import structlog
from fastapi import APIRouter, Depends, HTTPException
from infra.config import settings
from infra.database import get_db
from infra.security import create_access_token, create_refresh_token
from schemas.auth import LoginRequest, RefreshRequest, RegisterRequest, TokenResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

log = structlog.get_logger()
router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=201)
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
    await db.execute(
        text("INSERT INTO users (email, password) VALUES (:email, :password)"),
        {"email": body.email, "password": hashed},
    )
    await db.commit()
    return {"message": "registered"}


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
    if row is None or not bcrypt.checkpw(
        body.password.encode(), row["password"].encode()
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
