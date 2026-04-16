from datetime import UTC
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from infra.database import get_db
from main import app

client = TestClient(app)


def _make_db(scalar_result=None, insert_user_id="new-user-uuid"):
    """构造一个 mock AsyncSession。

    scalar_result: SELECT id 的返回值（None 表示用户不存在，uuid 表示用户已存在）
    insert_user_id: INSERT ... RETURNING id 的返回值
    """
    db = AsyncMock()

    # 第一次 execute（SELECT 检查邮箱是否存在）
    select_result = MagicMock()
    select_result.scalar_one_or_none.return_value = scalar_result
    select_result.mappings.return_value.one_or_none.return_value = None

    # 第二次 execute（INSERT ... RETURNING id）
    insert_result = MagicMock()
    insert_result.scalar_one.return_value = insert_user_id

    db.execute = AsyncMock(side_effect=[select_result, insert_result])
    db.commit = AsyncMock()
    return db


@pytest.fixture(autouse=True)
def reset_db_override():
    yield
    app.dependency_overrides.pop(get_db, None)


# ── /auth/register ────────────────────────────────────


def test_register_success_returns_tokens():
    async def mock_db():
        yield _make_db(scalar_result=None)  # 邮箱不存在

    app.dependency_overrides[get_db] = mock_db

    resp = client.post(
        "/auth/register", json={"email": "a@b.com", "password": "secret"}
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


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


# ── /auth/me ──────────────────────────────────────────


def test_sms_send_success():
    db = AsyncMock()
    # 模拟没有最近发送记录
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    # 模拟当日发送次数为 0
    count_result = MagicMock()
    count_result.scalar_one.return_value = 0
    # INSERT result
    insert_result = MagicMock()
    db.execute = AsyncMock(side_effect=[result, count_result, insert_result])
    db.commit = AsyncMock()

    async def mock_db():
        yield db

    app.dependency_overrides[get_db] = mock_db

    with patch("routers.auth.send_sms_code", return_value=True):
        resp = client.post("/auth/sms/send", json={"phone": "13812345678"})
    assert resp.status_code == 200
    assert resp.json()["message"] == "验证码已发送"


def test_sms_send_rate_limit():
    db = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = "some-id"
    db.execute = AsyncMock(return_value=result)

    async def mock_db():
        yield db

    app.dependency_overrides[get_db] = mock_db

    resp = client.post("/auth/sms/send", json={"phone": "13812345678"})
    assert resp.status_code == 429
    assert "60" in resp.json()["detail"]


def test_sms_send_invalid_phone():
    resp = client.post("/auth/sms/send", json={"phone": "123"})
    assert resp.status_code == 400
    assert "手机号" in resp.json()["detail"]


def test_sms_verify_new_user():
    db = AsyncMock()
    code_result = MagicMock()
    code_result.scalar_one_or_none.return_value = "code-id"
    update_result = MagicMock()
    user_result = MagicMock()
    user_result.mappings.return_value.one_or_none.return_value = None
    insert_result = MagicMock()
    insert_result.scalar_one.return_value = "new-user-uuid"

    db.execute = AsyncMock(
        side_effect=[code_result, update_result, user_result, insert_result]
    )
    db.commit = AsyncMock()

    async def mock_db():
        yield db

    app.dependency_overrides[get_db] = mock_db

    resp = client.post("/auth/sms/verify", json={"phone": "13812345678", "code": "123456"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_sms_verify_existing_user():
    db = AsyncMock()
    code_result = MagicMock()
    code_result.scalar_one_or_none.return_value = "code-id"
    update_result = MagicMock()
    user_result = MagicMock()
    user_result.mappings.return_value.one_or_none.return_value = {"id": "existing-user-uuid"}

    db.execute = AsyncMock(side_effect=[code_result, update_result, user_result])
    db.commit = AsyncMock()

    async def mock_db():
        yield db

    app.dependency_overrides[get_db] = mock_db

    resp = client.post("/auth/sms/verify", json={"phone": "13812345678", "code": "123456"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data


def test_sms_verify_invalid_code():
    db = AsyncMock()
    code_result = MagicMock()
    code_result.scalar_one_or_none.return_value = None
    db.execute = AsyncMock(return_value=code_result)

    async def mock_db():
        yield db

    app.dependency_overrides[get_db] = mock_db

    resp = client.post("/auth/sms/verify", json={"phone": "13812345678", "code": "000000"})
    assert resp.status_code == 401
    assert "验证码" in resp.json()["detail"]


# ── /auth/me ──────────────────────────────────────────


def test_me_returns_user_info():
    from datetime import datetime, timedelta

    import jwt

    from infra.config import settings

    access_token = jwt.encode(
        {"sub": "user-uuid", "type": "access", "exp": datetime.now(UTC) + timedelta(hours=1)},
        settings.jwt_secret,
        algorithm="HS256",
    )

    db = AsyncMock()
    result = MagicMock()
    result.mappings.return_value.one_or_none.return_value = {
        "id": "user-uuid",
        "email": "a@b.com",
        "phone": "13812345678",
    }
    db.execute = AsyncMock(return_value=result)

    async def mock_db():
        yield db

    app.dependency_overrides[get_db] = mock_db

    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {access_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "user-uuid"
    assert data["email"] == "a@b.com"
    assert data["phone"] == "13812345678"


# ── /auth/bind/phone & /auth/bind/email ───────────────


def _make_auth_header():
    """生成有效的 access token header。"""
    from datetime import datetime, timedelta

    import jwt

    from infra.config import settings

    token = jwt.encode(
        {"sub": "user-uuid", "type": "access", "exp": datetime.now(UTC) + timedelta(hours=1)},
        settings.jwt_secret,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


def test_bind_phone_success():
    db = AsyncMock()
    code_result = MagicMock()
    code_result.scalar_one_or_none.return_value = "code-id"
    update_code = MagicMock()
    phone_check = MagicMock()
    phone_check.scalar_one_or_none.return_value = None  # 未被占用
    update_user = MagicMock()

    db.execute = AsyncMock(side_effect=[code_result, update_code, phone_check, update_user])
    db.commit = AsyncMock()

    async def mock_db():
        yield db

    app.dependency_overrides[get_db] = mock_db

    resp = client.post(
        "/auth/bind/phone",
        json={"phone": "13812345678", "code": "123456"},
        headers=_make_auth_header(),
    )
    assert resp.status_code == 200
    assert resp.json()["message"] == "绑定成功"


def test_bind_phone_already_taken():
    db = AsyncMock()
    code_result = MagicMock()
    code_result.scalar_one_or_none.return_value = "code-id"
    update_code = MagicMock()
    phone_check = MagicMock()
    phone_check.scalar_one_or_none.return_value = "other-user-id"  # 已被占用

    db.execute = AsyncMock(side_effect=[code_result, update_code, phone_check])

    async def mock_db():
        yield db

    app.dependency_overrides[get_db] = mock_db

    resp = client.post(
        "/auth/bind/phone",
        json={"phone": "13812345678", "code": "123456"},
        headers=_make_auth_header(),
    )
    assert resp.status_code == 400
    assert "已被" in resp.json()["detail"]


def test_bind_email_success():
    db = AsyncMock()
    email_check = MagicMock()
    email_check.scalar_one_or_none.return_value = None
    update_user = MagicMock()

    db.execute = AsyncMock(side_effect=[email_check, update_user])
    db.commit = AsyncMock()

    async def mock_db():
        yield db

    app.dependency_overrides[get_db] = mock_db

    resp = client.post(
        "/auth/bind/email",
        json={"email": "new@test.com", "password": "secret"},
        headers=_make_auth_header(),
    )
    assert resp.status_code == 200
    assert resp.json()["message"] == "绑定成功"
