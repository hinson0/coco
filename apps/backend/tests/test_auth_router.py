from datetime import UTC
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from infra.database import get_db
from main import app

client = TestClient(app)


def _make_db(scalar_result=None):
    """构造一个 mock AsyncSession。

    scalar_result: SELECT id 的返回值（None 表示用户不存在，uuid 表示用户已存在）
    """
    db = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = scalar_result
    result.mappings.return_value.one_or_none.return_value = None
    db.execute = AsyncMock(return_value=result)
    db.commit = AsyncMock()
    return db


@pytest.fixture(autouse=True)
def reset_db_override():
    yield
    app.dependency_overrides.pop(get_db, None)


# ── /auth/register ────────────────────────────────────


def test_register_success():
    async def mock_db():
        yield _make_db(scalar_result=None)  # 邮箱不存在

    app.dependency_overrides[get_db] = mock_db

    resp = client.post(
        "/auth/register", json={"email": "a@b.com", "password": "secret"}
    )
    assert resp.status_code == 201
    assert resp.json()["message"] == "registered"


def test_register_duplicate_email():
    async def mock_db():
        yield _make_db(scalar_result="existing-uuid")  # 邮箱已存在

    app.dependency_overrides[get_db] = mock_db

    resp = client.post(
        "/auth/register", json={"email": "a@b.com", "password": "secret"}
    )
    assert resp.status_code == 400
    assert "邮箱已经注册过了" in resp.json()["detail"]


# ── /auth/refresh ─────────────────────────────────────


def test_refresh_with_valid_refresh_token():
    from datetime import datetime, timedelta

    import jwt

    from infra.config import settings

    refresh_token = jwt.encode(
        {
            "sub": "user-uuid",
            "type": "refresh",
            "exp": datetime.now(UTC) + timedelta(days=30),
        },
        settings.jwt_secret,
        algorithm="HS256",
    )

    resp = client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_refresh_with_access_token_fails():
    from datetime import datetime, timedelta

    import jwt

    from infra.config import settings

    access_token = jwt.encode(
        {
            "sub": "user-uuid",
            "type": "access",
            "exp": datetime.now(UTC) + timedelta(hours=1),
        },
        settings.jwt_secret,
        algorithm="HS256",
    )

    resp = client.post("/auth/refresh", json={"refresh_token": access_token})
    assert resp.status_code == 401


def test_login_wrong_password():
    import bcrypt

    hashed = bcrypt.hashpw(b"correct_password", bcrypt.gensalt()).decode()

    db = AsyncMock()
    result = MagicMock()
    result.mappings.return_value.one_or_none.return_value = {
        "id": "user-uuid",
        "password": hashed,
    }
    db.execute = AsyncMock(return_value=result)

    async def mock_db():
        yield db

    app.dependency_overrides[get_db] = mock_db

    resp = client.post(
        "/auth/login", json={"email": "a@b.com", "password": "wrong"}
    )
    assert resp.status_code == 401


def test_login_success_returns_tokens():
    import bcrypt

    hashed = bcrypt.hashpw(b"secret", bcrypt.gensalt()).decode()

    db = AsyncMock()
    result = MagicMock()
    result.mappings.return_value.one_or_none.return_value = {
        "id": "user-uuid",
        "password": hashed,
    }
    db.execute = AsyncMock(return_value=result)

    async def mock_db():
        yield db

    app.dependency_overrides[get_db] = mock_db

    resp = client.post(
        "/auth/login", json={"email": "a@b.com", "password": "secret"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
