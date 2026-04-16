# 登录重构：注册即登录 + 短信验证码登录 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构认证系统，实现注册即登录、手机号短信验证码登录（腾讯云 SMS），邮箱/手机号并行共存，个人页绑定入口。

**Architecture:** 扩展 users 表增加 phone 字段（email/password 变 nullable），新增 sms_codes 表存验证码。后端新增 SMS 发送/验证端点和绑定端点，前端登录页改为 Tab 切换布局（手机号/邮箱），注册后自动登录，个人页增加绑定入口。

**Tech Stack:** FastAPI, tencentcloud-sdk-python (SMS), PostgreSQL + Alembic, React Native (Expo), AsyncStorage

---

## 文件结构

### 后端新增/修改

| 操作 | 路径 | 职责 |
|------|------|------|
| 新增 | `apps/backend/infra/sms.py` | 腾讯云 SMS 发送封装 |
| 新增 | `apps/backend/alembic/versions/xxxx_auth_add_phone_sms.py` | 数据库迁移：users 加 phone，新增 sms_codes 表 |
| 修改 | `apps/backend/infra/config.py` | 新增 SMS 配置项 |
| 修改 | `apps/backend/schemas/auth.py` | 新增 SMS 相关 schema |
| 修改 | `apps/backend/routers/auth.py` | 修改 register，新增 sms/me/bind 端点 |
| 修改 | `apps/backend/tests/test_auth_router.py` | 更新和新增测试 |
| 修改 | `apps/backend/.env.example` | 新增 SMS 环境变量说明 |

### 前端新增/修改

| 操作 | 路径 | 职责 |
|------|------|------|
| 修改 | `apps/mobile/lib/auth.ts` | 新增 sms 相关函数，修改 register 和 user 类型 |
| 修改 | `apps/mobile/hooks/useAuth.tsx` | 新增 sms 方法，扩展 user 类型 |
| 修改 | `apps/mobile/app/(auth)/login.tsx` | Tab 切换布局（手机号/邮箱） |
| 修改 | `apps/mobile/app/(auth)/register.tsx` | 注册后自动登录 |
| 修改 | `apps/mobile/app/(tabs)/profile.tsx` | 绑定入口 |
| 新增 | `apps/mobile/app/bind-phone.tsx` | 绑定手机号页面 |
| 新增 | `apps/mobile/app/bind-email.tsx` | 绑定邮箱页面 |

---

### Task 1: 数据库迁移 — users 表扩展 + sms_codes 表

**Files:**
- Create: `apps/backend/alembic/versions/xxxx_auth_add_phone_sms.py`
- Test: 通过 `alembic upgrade head` 验证

- [ ] **Step 1: 编写迁移脚本**

在 `apps/backend/` 目录下执行：

```bash
cd apps/backend && uv run alembic revision -m "auth_add_phone_sms"
```

然后编辑生成的迁移文件，填入以下内容：

```python
"""auth_add_phone_sms

Revision ID: <auto>
Revises: fd484f85b8db
Create Date: <auto>
"""

from alembic import op

revision = "<auto>"
down_revision = "fd484f85b8db"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE users
          ADD COLUMN phone text UNIQUE;
    """)
    op.execute("""
        ALTER TABLE users
          ALTER COLUMN email DROP NOT NULL;
    """)
    op.execute("""
        ALTER TABLE users
          ALTER COLUMN password DROP NOT NULL;
    """)
    op.execute("""
        ALTER TABLE users
          ADD CONSTRAINT users_email_or_phone_check
            CHECK (email IS NOT NULL OR phone IS NOT NULL);
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS sms_codes (
          id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          phone      text NOT NULL,
          code       text NOT NULL,
          expires_at timestamptz NOT NULL,
          used       boolean NOT NULL DEFAULT false,
          created_at timestamptz NOT NULL DEFAULT now()
        );
    """)
    op.execute("""
        CREATE INDEX idx_sms_codes_phone ON sms_codes(phone);
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_sms_codes_phone;")
    op.execute("DROP TABLE IF EXISTS sms_codes;")
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_or_phone_check;")
    op.execute("ALTER TABLE users ALTER COLUMN password SET NOT NULL;")
    op.execute("ALTER TABLE users ALTER COLUMN email SET NOT NULL;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS phone;")
```

- [ ] **Step 2: 执行迁移验证**

```bash
cd apps/backend && uv run alembic upgrade head
```

Expected: 迁移成功，无报错

- [ ] **Step 3: 提交**

```bash
git add apps/backend/alembic/versions/
git commit -m "feat(backend): 数据库迁移 - users 表增加 phone 字段，新增 sms_codes 表"
```

---

### Task 2: 后端 — SMS 基础设施（config + sms 模块）

**Files:**
- Modify: `apps/backend/infra/config.py`
- Create: `apps/backend/infra/sms.py`
- Modify: `apps/backend/.env.example`
- Test: `apps/backend/tests/test_sms.py`

- [ ] **Step 1: 编写 SMS 模块测试**

创建 `apps/backend/tests/test_sms.py`：

```python
from unittest.mock import MagicMock, patch

from infra.sms import send_sms_code


@patch("infra.sms.SmsClient")
def test_send_sms_code_success(mock_sms_client_class):
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.SendStatusSet = [MagicMock(Code="Ok")]
    mock_client.SendSms.return_value = mock_response
    mock_sms_client_class.return_value = mock_client

    result = send_sms_code("13812345678", "123456")
    assert result is True

    mock_client.SendSms.assert_called_once()


@patch("infra.sms.SmsClient")
def test_send_sms_code_failure(mock_sms_client_class):
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.SendStatusSet = [MagicMock(Code="FailedOperation")]
    mock_client.SendSms.return_value = mock_response
    mock_sms_client_class.return_value = mock_client

    result = send_sms_code("13812345678", "123456")
    assert result is False


@patch("infra.sms.SmsClient")
def test_send_sms_code_exception(mock_sms_client_class):
    mock_client = MagicMock()
    mock_client.SendSms.side_effect = Exception("network error")
    mock_sms_client_class.return_value = mock_client

    result = send_sms_code("13812345678", "123456")
    assert result is False
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd apps/backend && uv run pytest tests/test_sms.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'infra.sms'`

- [ ] **Step 3: 修改 config.py 增加 SMS 配置**

在 `apps/backend/infra/config.py` 的 `Settings` 类中添加：

```python
    # SMS (腾讯云)
    sms_app_id: str = ""
    sms_sign_name: str = ""
    sms_template_id: str = ""
```

注意：`tencent_secret_id` 和 `tencent_secret_key` 已存在于 config 中。

- [ ] **Step 4: 创建 SMS 模块**

创建 `apps/backend/infra/sms.py`：

```python
import structlog
from tencentcloud.common import credential
from tencentcloud.sms.v20210111 import client as sms_client_module
from tencentcloud.sms.v20210111 import models as sms_models

from infra.config import settings

log = structlog.get_logger()

SmsClient = sms_client_module.SmsClient


def send_sms_code(phone: str, code: str) -> bool:
    """发送短信验证码，成功返回 True，失败返回 False。"""
    try:
        cred = credential.Credential(
            settings.tencent_secret_id, settings.tencent_secret_key
        )
        client = SmsClient(cred, "ap-guangzhou")

        req = sms_models.SendSmsRequest()
        req.SmsSdkAppId = settings.sms_app_id
        req.SignName = settings.sms_sign_name
        req.TemplateId = settings.sms_template_id
        req.TemplateParamSet = [code, "5"]
        req.PhoneNumberSet = [f"+86{phone}"]

        resp = client.SendSms(req)

        if resp.SendStatusSet and resp.SendStatusSet[0].Code == "Ok":
            log.info("sms_sent", phone=phone[-4:])
            return True

        log.warning(
            "sms_send_failed",
            phone=phone[-4:],
            code=resp.SendStatusSet[0].Code if resp.SendStatusSet else "unknown",
        )
        return False
    except Exception:
        log.exception("sms_send_error", phone=phone[-4:])
        return False
```

- [ ] **Step 5: 更新 .env.example**

在 `apps/backend/.env.example` 中添加：

```env
# 腾讯云 SMS
SMS_APP_ID=
SMS_SIGN_NAME=
SMS_TEMPLATE_ID=
```

- [ ] **Step 6: 运行测试确认通过**

```bash
cd apps/backend && uv run pytest tests/test_sms.py -v
```

Expected: 3 tests PASS

- [ ] **Step 7: 提交**

```bash
git add apps/backend/infra/sms.py apps/backend/infra/config.py apps/backend/.env.example apps/backend/tests/test_sms.py
git commit -m "feat(backend): 腾讯云 SMS 发送模块及配置"
```

---

### Task 3: 后端 — Schema 扩展

**Files:**
- Modify: `apps/backend/schemas/auth.py`

- [ ] **Step 1: 扩展 auth schema**

将 `apps/backend/schemas/auth.py` 替换为：

```python
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
```

- [ ] **Step 2: 提交**

```bash
git add apps/backend/schemas/auth.py
git commit -m "feat(backend): 新增 SMS 和绑定相关 schema"
```

---

### Task 4: 后端 — 注册即登录 + /auth/me 端点

**Files:**
- Modify: `apps/backend/routers/auth.py`
- Modify: `apps/backend/tests/test_auth_router.py`

- [ ] **Step 1: 编写测试 — 注册返回 token**

在 `apps/backend/tests/test_auth_router.py` 中修改 `test_register_success`：

```python
def test_register_success_returns_tokens():
    async def mock_db():
        yield _make_db(scalar_result=None)

    app.dependency_overrides[get_db] = mock_db

    resp = client.post(
        "/auth/register", json={"email": "a@b.com", "password": "secret"}
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
```

新增 `/auth/me` 测试：

```python
def test_me_returns_user_info():
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

    resp = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "user-uuid"
    assert data["email"] == "a@b.com"
    assert data["phone"] == "13812345678"
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd apps/backend && uv run pytest tests/test_auth_router.py::test_register_success_returns_tokens tests/test_auth_router.py::test_me_returns_user_info -v
```

Expected: FAIL

- [ ] **Step 3: 修改 register 端点返回 token**

在 `apps/backend/routers/auth.py` 中，修改 `register` 函数：

```python
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
```

- [ ] **Step 4: 新增 /auth/me 端点**

在 `apps/backend/routers/auth.py` 中添加导入和端点：

在文件顶部 import 区域添加：
```python
from infra.security import create_access_token, create_refresh_token, get_current_user
from schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserInfoResponse,
)
```

添加端点：
```python
UserId = Annotated[str, Depends(get_current_user)]


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
        id=str(row["id"]),
        email=row["email"],
        phone=row["phone"],
    )
```

- [ ] **Step 5: 运行测试确认通过**

```bash
cd apps/backend && uv run pytest tests/test_auth_router.py -v
```

Expected: ALL PASS（注意也需要删除旧的 `test_register_success` 测试）

- [ ] **Step 6: 提交**

```bash
git add apps/backend/routers/auth.py apps/backend/tests/test_auth_router.py
git commit -m "feat(backend): 注册即登录（返回 token）+ /auth/me 端点"
```

---

### Task 5: 后端 — SMS 发送和验证端点

**Files:**
- Modify: `apps/backend/routers/auth.py`
- Modify: `apps/backend/tests/test_auth_router.py`

- [ ] **Step 1: 编写 SMS 端点测试**

在 `apps/backend/tests/test_auth_router.py` 中新增：

```python
from unittest.mock import patch


def test_sms_send_success():
    db = AsyncMock()
    # 模拟没有最近发送记录
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    # 模拟当日发送次数为 0
    count_result = MagicMock()
    count_result.scalar_one.return_value = 0
    db.execute = AsyncMock(side_effect=[result, count_result, MagicMock()])
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
    # 模拟 60 秒内已发送
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
    # 第1次调用: 查验证码 — 返回有效记录
    code_result = MagicMock()
    code_result.scalar_one_or_none.return_value = "code-id"
    # 第2次调用: 标记已使用
    update_result = MagicMock()
    # 第3次调用: 查用户 — 不存在
    user_result = MagicMock()
    user_result.mappings.return_value.one_or_none.return_value = None
    # 第4次调用: 创建用户 — 返回 user_id
    insert_result = MagicMock()
    insert_result.scalar_one.return_value = "new-user-uuid"

    db.execute = AsyncMock(
        side_effect=[code_result, update_result, user_result, insert_result]
    )
    db.commit = AsyncMock()

    async def mock_db():
        yield db

    app.dependency_overrides[get_db] = mock_db

    resp = client.post(
        "/auth/sms/verify", json={"phone": "13812345678", "code": "123456"}
    )
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
    user_result.mappings.return_value.one_or_none.return_value = {
        "id": "existing-user-uuid"
    }

    db.execute = AsyncMock(
        side_effect=[code_result, update_result, user_result]
    )
    db.commit = AsyncMock()

    async def mock_db():
        yield db

    app.dependency_overrides[get_db] = mock_db

    resp = client.post(
        "/auth/sms/verify", json={"phone": "13812345678", "code": "123456"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data


def test_sms_verify_invalid_code():
    db = AsyncMock()
    code_result = MagicMock()
    code_result.scalar_one_or_none.return_value = None  # 验证码不存在/已过期
    db.execute = AsyncMock(return_value=code_result)

    async def mock_db():
        yield db

    app.dependency_overrides[get_db] = mock_db

    resp = client.post(
        "/auth/sms/verify", json={"phone": "13812345678", "code": "000000"}
    )
    assert resp.status_code == 401
    assert "验证码" in resp.json()["detail"]
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd apps/backend && uv run pytest tests/test_auth_router.py::test_sms_send_success tests/test_auth_router.py::test_sms_verify_new_user -v
```

Expected: FAIL

- [ ] **Step 3: 实现 SMS 端点**

在 `apps/backend/routers/auth.py` 顶部添加导入：

```python
import random

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
```

添加手机号校验辅助函数：

```python
import re

def _validate_phone(phone: str) -> None:
    if not re.match(r"^1[3-9]\d{9}$", phone):
        raise HTTPException(status_code=400, detail="手机号格式不正确")
```

添加端点：

```python
@router.post("/sms/send")
async def sms_send(
    body: SmsSendRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    _validate_phone(body.phone)

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
        raise HTTPException(status_code=429, detail="发送过于频繁，请60秒后重试")

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

    code = f"{random.randint(0, 999999):06d}"

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
```

- [ ] **Step 4: 运行全部测试确认通过**

```bash
cd apps/backend && uv run pytest tests/test_auth_router.py -v
```

Expected: ALL PASS

- [ ] **Step 5: 提交**

```bash
git add apps/backend/routers/auth.py apps/backend/tests/test_auth_router.py
git commit -m "feat(backend): SMS 发送和验证端点（含频率限制）"
```

---

### Task 6: 后端 — 绑定端点

**Files:**
- Modify: `apps/backend/routers/auth.py`
- Modify: `apps/backend/tests/test_auth_router.py`

- [ ] **Step 1: 编写绑定端点测试**

在 `apps/backend/tests/test_auth_router.py` 中新增：

```python
def _make_auth_header():
    """生成有效的 access token header。"""
    from datetime import datetime, timedelta

    import jwt

    from infra.config import settings

    token = jwt.encode(
        {
            "sub": "user-uuid",
            "type": "access",
            "exp": datetime.now(UTC) + timedelta(hours=1),
        },
        settings.jwt_secret,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


def test_bind_phone_success():
    db = AsyncMock()
    # 验证码查询
    code_result = MagicMock()
    code_result.scalar_one_or_none.return_value = "code-id"
    # 标记已使用
    update_code = MagicMock()
    # 检查手机号是否被占用
    phone_check = MagicMock()
    phone_check.scalar_one_or_none.return_value = None  # 未被占用
    # 更新用户
    update_user = MagicMock()

    db.execute = AsyncMock(
        side_effect=[code_result, update_code, phone_check, update_user]
    )
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

    db.execute = AsyncMock(
        side_effect=[code_result, update_code, phone_check]
    )

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
    # 检查邮箱是否被占用
    email_check = MagicMock()
    email_check.scalar_one_or_none.return_value = None
    # 更新用户
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
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd apps/backend && uv run pytest tests/test_auth_router.py::test_bind_phone_success tests/test_auth_router.py::test_bind_email_success -v
```

Expected: FAIL

- [ ] **Step 3: 实现绑定端点**

在 `apps/backend/routers/auth.py` 中添加：

```python
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
        text("UPDATE users SET email = :email, password = :password WHERE id = :id"),
        {"email": body.email, "password": hashed, "id": current_user_id},
    )
    await db.commit()
    return {"message": "绑定成功"}
```

- [ ] **Step 4: 运行全部测试确认通过**

```bash
cd apps/backend && uv run pytest tests/test_auth_router.py -v
```

Expected: ALL PASS

- [ ] **Step 5: 提交**

```bash
git add apps/backend/routers/auth.py apps/backend/tests/test_auth_router.py
git commit -m "feat(backend): 绑定手机号和绑定邮箱端点"
```

---

### Task 7: 前端 — auth.ts 扩展（SMS 函数 + user 类型）

**Files:**
- Modify: `apps/mobile/lib/auth.ts`

- [ ] **Step 1: 扩展 auth.ts**

在 `apps/mobile/lib/auth.ts` 中进行以下修改：

新增存储键常量：
```typescript
const USER_PHONE_KEY = "user_phone";
```

修改 `register` 函数——注册后存储 token（与 login 相同逻辑）：

```typescript
export async function register(email: string, password: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!resp.ok) {
    const data = await resp.json();
    throw new Error(data.detail ?? "Registration failed");
  }
  const { access_token, refresh_token } = await resp.json();
  await AsyncStorage.setItem(ACCESS_TOKEN_KEY, access_token);
  await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
  const payload = JSON.parse(atob(access_token.split(".")[1]));
  await AsyncStorage.setItem(USER_ID_KEY, payload.sub);
  await AsyncStorage.setItem(USER_EMAIL_KEY, email);
}
```

新增 SMS 函数：

```typescript
export async function sendSmsCode(phone: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/auth/sms/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  if (!resp.ok) {
    const data = await resp.json();
    throw new Error(data.detail ?? "发送失败");
  }
}

export async function smsLogin(phone: string, code: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/auth/sms/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code }),
  });
  if (!resp.ok) {
    const data = await resp.json();
    throw new Error(data.detail ?? "验证失败");
  }
  const { access_token, refresh_token } = await resp.json();
  await AsyncStorage.setItem(ACCESS_TOKEN_KEY, access_token);
  await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
  const payload = JSON.parse(atob(access_token.split(".")[1]));
  await AsyncStorage.setItem(USER_ID_KEY, payload.sub);
  await AsyncStorage.setItem(USER_PHONE_KEY, phone);
}
```

修改 `logout` 函数，增加清除 phone：

```typescript
export async function logout(): Promise<void> {
  await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
  await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
  await AsyncStorage.removeItem(USER_ID_KEY);
  await AsyncStorage.removeItem(USER_EMAIL_KEY);
  await AsyncStorage.removeItem(USER_PHONE_KEY);
}
```

修改 `getUserInfo` 返回类型和实现：

```typescript
export async function getUserInfo(): Promise<{
  id: string;
  email: string | null;
  phone: string | null;
} | null> {
  const id = await AsyncStorage.getItem(USER_ID_KEY);
  if (!id) return null;
  const email = await AsyncStorage.getItem(USER_EMAIL_KEY);
  const phone = await AsyncStorage.getItem(USER_PHONE_KEY);
  return { id, email: email || null, phone: phone || null };
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/mobile/lib/auth.ts
git commit -m "feat(mobile): auth.ts 扩展 SMS 函数和注册即登录"
```

---

### Task 8: 前端 — useAuth Hook 扩展

**Files:**
- Modify: `apps/mobile/hooks/useAuth.tsx`

- [ ] **Step 1: 扩展 useAuth**

修改 `apps/mobile/hooks/useAuth.tsx`：

更新导入：
```typescript
import {
  getAccessToken,
  getUserInfo,
  login,
  logout,
  register,
  sendSmsCode as sendSmsCodeApi,
  smsLogin,
} from "../lib/auth";
```

更新类型和实现：

```typescript
type AuthState = {
  isAuthenticated: boolean;
  user: { id: string; email: string | null; phone: string | null } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendSmsCode: (phone: string) => Promise<void>;
  smsSignIn: (phone: string, code: string) => Promise<void>;
};
```

在 `AuthProvider` 中添加新方法：

```typescript
  const signUp = async (email: string, password: string) => {
    await register(email, password);
    // 注册后自动登录（register 已存储 token）
    const info = await getUserInfo();
    setIsAuthenticated(true);
    setUser(info);
  };

  const sendSmsCode = async (phone: string) => {
    await sendSmsCodeApi(phone);
  };

  const smsSignIn = async (phone: string, code: string) => {
    await smsLogin(phone, code);
    const info = await getUserInfo();
    setIsAuthenticated(true);
    setUser(info);
  };
```

更新 Provider value：
```typescript
  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        loading,
        signIn,
        signUp,
        signOut,
        sendSmsCode,
        smsSignIn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
```

- [ ] **Step 2: 提交**

```bash
git add apps/mobile/hooks/useAuth.tsx
git commit -m "feat(mobile): useAuth 扩展 SMS 登录方法"
```

---

### Task 9: 前端 — 登录页 Tab 切换布局

**Files:**
- Modify: `apps/mobile/app/(auth)/login.tsx`

- [ ] **Step 1: 重写登录页**

将 `apps/mobile/app/(auth)/login.tsx` 替换为：

```typescript
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { AuthButton } from "../../components/auth/AuthButton";
import { AuthInput } from "../../components/auth/AuthInput";
import { AppText } from "../../components/ui/AppText";
import { Card } from "../../components/ui/Card";
import { colors } from "../../constants/theme";
import { useAuth } from "../../hooks/useAuth";

type Tab = "phone" | "email";

export default function LoginScreen() {
  const [tab, setTab] = useState<Tab>("phone");

  // 邮箱登录
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 手机号登录
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [loading, setLoading] = useState(false);
  const { signIn, sendSmsCode, smsSignIn } = useAuth();

  // 倒计时
  useEffect(() => {
    if (countdown <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [countdown]);

  const handleSendCode = useCallback(async () => {
    const trimmed = phone.trim();
    if (!/^1[3-9]\d{9}$/.test(trimmed)) {
      Alert.alert("提示", "请输入正确的手机号");
      return;
    }
    try {
      await sendSmsCode(trimmed);
      setCountdown(60);
    } catch (e: unknown) {
      Alert.alert("发送失败", e instanceof Error ? e.message : "未知错误");
    }
  }, [phone, sendSmsCode]);

  const handlePhoneLogin = async () => {
    if (!phone.trim() || !code.trim()) {
      Alert.alert("登录失败", "请填写手机号和验证码");
      return;
    }
    setLoading(true);
    try {
      await smsSignIn(phone.trim(), code.trim());
      router.replace("/");
    } catch (e: unknown) {
      Alert.alert("登录失败", e instanceof Error ? e.message : "未知错误");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("登录失败", "请填写邮箱和密码");
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/");
    } catch (e: unknown) {
      Alert.alert("登录失败", e instanceof Error ? e.message : "未知错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <AppText size="3xl" style={styles.logo}>
            🌿
          </AppText>
          <AppText size="6xl" weight="bold" style={styles.appName}>
            CoCo
          </AppText>
          <AppText size="lg" color={colors.textLighter} style={styles.tagline}>
            AI 智能记账助手
          </AppText>
        </View>

        <Card radius="xl" padding={24} style={styles.card}>
          {/* Tab 切换 */}
          <View style={styles.tabRow}>
            <Pressable
              style={[styles.tab, tab === "phone" && styles.tabActive]}
              onPress={() => setTab("phone")}
            >
              <AppText
                size="xl"
                weight={tab === "phone" ? "semibold" : "regular"}
                color={tab === "phone" ? colors.sage : colors.textLighter}
              >
                手机号登录
              </AppText>
            </Pressable>
            <Pressable
              style={[styles.tab, tab === "email" && styles.tabActive]}
              onPress={() => setTab("email")}
            >
              <AppText
                size="xl"
                weight={tab === "email" ? "semibold" : "regular"}
                color={tab === "email" ? colors.sage : colors.textLighter}
              >
                邮箱登录
              </AppText>
            </Pressable>
          </View>

          {tab === "phone" ? (
            <View style={styles.inputGroup}>
              <AuthInput
                placeholder="手机号"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <View style={styles.codeRow}>
                <View style={styles.codeInput}>
                  <AuthInput
                    placeholder="验证码"
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                  />
                </View>
                <Pressable
                  style={[
                    styles.sendBtn,
                    countdown > 0 && styles.sendBtnDisabled,
                  ]}
                  onPress={handleSendCode}
                  disabled={countdown > 0}
                >
                  <AppText
                    size="base"
                    weight="semibold"
                    color={countdown > 0 ? colors.textLighter : colors.sage}
                  >
                    {countdown > 0 ? `${countdown}s` : "发送验证码"}
                  </AppText>
                </Pressable>
              </View>
              <AuthButton
                title="登录"
                onPress={handlePhoneLogin}
                loading={loading}
              />
            </View>
          ) : (
            <View style={styles.inputGroup}>
              <AuthInput
                placeholder="邮箱"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <AuthInput
                placeholder="密码"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <AuthButton
                title="登录"
                onPress={handleEmailLogin}
                loading={loading}
              />
            </View>
          )}
        </Card>

        {tab === "email" && (
          <View style={styles.linkRow}>
            <AppText size="xl" color={colors.textLight}>
              还没有账号？
            </AppText>
            <Pressable
              onPress={() => router.push("/(auth)/register")}
            >
              <AppText size="xl" color={colors.sage} weight="semibold">
                去注册
              </AppText>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    flexGrow: 1,
    justifyContent: "flex-start",
    paddingHorizontal: 0,
    paddingTop: 100,
    paddingBottom: 40,
  },
  hero: {
    alignItems: "center",
    marginBottom: 32,
    gap: 4,
  },
  logo: {
    fontSize: 72,
    lineHeight: 80,
    textAlign: "center",
  },
  appName: {
    textAlign: "center",
  },
  tagline: {
    textAlign: "center",
    marginTop: 4,
  },
  card: {
    marginHorizontal: 24,
  },
  tabRow: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 0,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: colors.sage,
  },
  inputGroup: {
    gap: 12,
  },
  codeRow: {
    flexDirection: "row",
    gap: 8,
  },
  codeInput: {
    flex: 1,
  },
  sendBtn: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.sage,
    borderRadius: 12,
    height: 48,
  },
  sendBtnDisabled: {
    borderColor: colors.creamDark,
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    gap: 4,
  },
});
```

- [ ] **Step 2: 提交**

```bash
git add apps/mobile/app/\(auth\)/login.tsx
git commit -m "feat(mobile): 登录页 Tab 切换布局（手机号/邮箱）"
```

---

### Task 10: 前端 — 注册页修改（注册即登录）

**Files:**
- Modify: `apps/mobile/app/(auth)/register.tsx`

- [ ] **Step 1: 修改注册成功后的行为**

在 `apps/mobile/app/(auth)/register.tsx` 中，修改 `handleRegister` 函数的 try 块：

将：
```typescript
      await signUp(email.trim(), password);
      Alert.alert("注册成功", "请检查邮箱完成验证", [
        { text: "好的", onPress: () => router.replace("/(auth)/login") },
      ]);
```

替换为：
```typescript
      await signUp(email.trim(), password);
      router.replace("/");
```

- [ ] **Step 2: 提交**

```bash
git add apps/mobile/app/\(auth\)/register.tsx
git commit -m "feat(mobile): 注册成功后直接跳转首页"
```

---

### Task 11: 前端 — 个人页绑定入口 + 绑定页面

**Files:**
- Modify: `apps/mobile/app/(tabs)/profile.tsx`
- Create: `apps/mobile/app/bind-phone.tsx`
- Create: `apps/mobile/app/bind-email.tsx`

- [ ] **Step 1: 在个人页添加绑定入口**

在 `apps/mobile/app/(tabs)/profile.tsx` 中，在"资产管理"section 之前添加"账户安全"section：

```typescript
      {/* 账户安全 */}
      <AppText
        size="base"
        color={colors.textLighter}
        weight="semibold"
        style={styles.sectionTitle}
      >
        账户安全
      </AppText>
      <Card padding={0} style={styles.menuCard}>
        {user?.phone ? (
          <MenuItem
            icon="📱"
            iconBg={colors.sagePale}
            title="手机号"
            subtitle={user.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")}
          />
        ) : (
          <MenuItem
            icon="📱"
            iconBg={colors.sagePale}
            title="绑定手机号"
            onPress={() => router.push("/bind-phone")}
          />
        )}
        <View style={styles.separator} />
        {user?.email ? (
          <MenuItem
            icon="📧"
            iconBg={colors.honeyPale}
            title="邮箱"
            subtitle={user.email}
          />
        ) : (
          <MenuItem
            icon="📧"
            iconBg={colors.honeyPale}
            title="绑定邮箱"
            onPress={() => router.push("/bind-email")}
          />
        )}
      </Card>
```

同时更新 `userName` 的 fallback 逻辑：

```typescript
  const userName =
    profile?.nickname ??
    user?.email?.split("@")[0] ??
    (user?.phone ? `用户${user.phone.slice(-4)}` : "CoCo 用户");
```

- [ ] **Step 2: 创建绑定手机号页面**

创建 `apps/mobile/app/bind-phone.tsx`：

```typescript
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { AuthButton } from "../components/auth/AuthButton";
import { AuthInput } from "../components/auth/AuthInput";
import { AppText } from "../components/ui/AppText";
import { Card } from "../components/ui/Card";
import { colors } from "../constants/theme";
import { useAuth } from "../hooks/useAuth";
import { apiFetch } from "../lib/api";

export default function BindPhoneScreen() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { sendSmsCode } = useAuth();

  useEffect(() => {
    if (countdown <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [countdown]);

  const handleSendCode = useCallback(async () => {
    const trimmed = phone.trim();
    if (!/^1[3-9]\d{9}$/.test(trimmed)) {
      Alert.alert("提示", "请输入正确的手机号");
      return;
    }
    try {
      await sendSmsCode(trimmed);
      setCountdown(60);
    } catch (e: unknown) {
      Alert.alert("发送失败", e instanceof Error ? e.message : "未知错误");
    }
  }, [phone, sendSmsCode]);

  const handleBind = async () => {
    if (!phone.trim() || !code.trim()) {
      Alert.alert("提示", "请填写手机号和验证码");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/auth/bind/phone", {
        method: "POST",
        body: JSON.stringify({ phone: phone.trim(), code: code.trim() }),
      });
      Alert.alert("绑定成功", "手机号绑定成功", [
        { text: "好的", onPress: () => router.back() },
      ]);
    } catch (e: unknown) {
      Alert.alert("绑定失败", e instanceof Error ? e.message : "未知错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <AppText size="3xl" weight="bold" style={styles.title}>
          绑定手机号
        </AppText>

        <Card radius="xl" padding={24} style={styles.card}>
          <View style={styles.inputGroup}>
            <AuthInput
              placeholder="手机号"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <View style={styles.codeRow}>
              <View style={styles.codeInput}>
                <AuthInput
                  placeholder="验证码"
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                />
              </View>
              <Pressable
                style={[
                  styles.sendBtn,
                  countdown > 0 && styles.sendBtnDisabled,
                ]}
                onPress={handleSendCode}
                disabled={countdown > 0}
              >
                <AppText
                  size="base"
                  weight="semibold"
                  color={countdown > 0 ? colors.textLighter : colors.sage}
                >
                  {countdown > 0 ? `${countdown}s` : "发送验证码"}
                </AppText>
              </Pressable>
            </View>
          </View>
          <AuthButton title="绑定" onPress={handleBind} loading={loading} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { paddingTop: 80, paddingBottom: 40 },
  title: { textAlign: "center", marginBottom: 24 },
  card: { marginHorizontal: 24 },
  inputGroup: { gap: 12, marginBottom: 16 },
  codeRow: { flexDirection: "row", gap: 8 },
  codeInput: { flex: 1 },
  sendBtn: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.sage,
    borderRadius: 12,
    height: 48,
  },
  sendBtnDisabled: { borderColor: colors.creamDark },
});
```

- [ ] **Step 3: 创建绑定邮箱页面**

创建 `apps/mobile/app/bind-email.tsx`：

```typescript
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { AuthButton } from "../components/auth/AuthButton";
import { AuthInput } from "../components/auth/AuthInput";
import { AppText } from "../components/ui/AppText";
import { Card } from "../components/ui/Card";
import { colors } from "../constants/theme";
import { apiFetch } from "../lib/api";

export default function BindEmailScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleBind = async () => {
    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert("提示", "请填写所有字段");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("提示", "两次密码不一致");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/auth/bind/email", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      Alert.alert("绑定成功", "邮箱绑定成功", [
        { text: "好的", onPress: () => router.back() },
      ]);
    } catch (e: unknown) {
      Alert.alert("绑定失败", e instanceof Error ? e.message : "未知错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <AppText size="3xl" weight="bold" style={styles.title}>
          绑定邮箱
        </AppText>

        <Card radius="xl" padding={24} style={styles.card}>
          <View style={styles.inputGroup}>
            <AuthInput
              placeholder="邮箱"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <AuthInput
              placeholder="密码"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <AuthInput
              placeholder="确认密码"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>
          <AuthButton title="绑定" onPress={handleBind} loading={loading} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { paddingTop: 80, paddingBottom: 40 },
  title: { textAlign: "center", marginBottom: 24 },
  card: { marginHorizontal: 24 },
  inputGroup: { gap: 12, marginBottom: 16 },
});
```

- [ ] **Step 4: 提交**

```bash
git add apps/mobile/app/\(tabs\)/profile.tsx apps/mobile/app/bind-phone.tsx apps/mobile/app/bind-email.tsx
git commit -m "feat(mobile): 个人页绑定入口 + 绑定手机号/邮箱页面"
```

---

### Task 12: CI 验证

**Files:** 无新增

- [ ] **Step 1: 运行后端完整测试**

```bash
cd apps/backend && uv run pytest -v
```

Expected: ALL PASS

- [ ] **Step 2: 运行后端 lint**

```bash
cd apps/backend && uv run ruff check . && uv run ruff format --check .
```

Expected: 无错误

- [ ] **Step 3: 运行前端 CI**

```bash
cd /Users/a114514/coco/.claude/worktrees/relaxed-yalow && pnpm --filter mobile lint && pnpm --filter mobile typecheck
```

Expected: 无错误

- [ ] **Step 4: 提交（如有 lint 修复）**

如果有 lint 修复：
```bash
git add -A
git commit -m "fix: lint 修复"
```
