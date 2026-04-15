from datetime import UTC, datetime, timedelta
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
from schemas.auth import (
    LoginRequest,
    ProStatus,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)

log = structlog.get_logger()
router = APIRouter(prefix="/auth", tags=["auth"])
TRIAL_DAYS = 21


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
    pro_status = await get_pro_status(db, user_id)
    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
        pro_status=pro_status,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    body: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    try:
        payload = jwt.decode(
            body.refresh_token, settings.jwt_secret, algorithms=["HS256"]
        )
        if payload.get("type") != "refresh":
            raise ValueError("Not a refresh token")
        user_id: str = payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
    pro_status = await get_pro_status(db, user_id)
    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
        pro_status=pro_status,
    )


@router.get("/pro-status", response_model=ProStatus)
async def pro_status(
    user_id: Annotated[str, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ProStatus:
    return await get_pro_status(db, user_id)


async def get_pro_status(session: AsyncSession, user_id: str) -> ProStatus:
    result = await session.execute(
        text(
            "SELECT created_at, trial_started_at, pro_expires_at "
            "FROM users WHERE id = :id"
        ),
        {"id": user_id},
    )
    row = result.mappings().one_or_none()
    if row is None:
        return ProStatus(
            is_pro=False, is_trial=False, trial_days_left=0, pro_expires_at=None
        )

    now = datetime.now(UTC)
    trial_start = row["trial_started_at"] or row["created_at"]
    trial_end = trial_start + timedelta(days=TRIAL_DAYS)
    is_trial = now < trial_end
    trial_days_left = max(0, (trial_end - now).days) if is_trial else 0

    pro_exp = row["pro_expires_at"]
    is_paid_pro = pro_exp is not None and (
        pro_exp.year >= 9999 or now < pro_exp
    )

    return ProStatus(
        is_pro=is_trial or is_paid_pro,
        is_trial=is_trial and not is_paid_pro,
        trial_days_left=trial_days_left,
        pro_expires_at=pro_exp.isoformat() if pro_exp else None,
    )
