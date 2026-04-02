# 通用规范

## 文档同步

任何更新（新增功能、修改接口、变更配置等），如有必要，同步更新 `apps/backend/README.md`。

---

# Python 代码规范

## Pydantic v2 语法

本项目使用 pydantic-settings v2，**禁止**使用旧的 `class Config` 内嵌类写法。

旧写法（v1，禁止）：
```python
class Settings(BaseSettings):
    class Config:
        env_file = ".env"
```

正确写法（v2）：
```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")
```

同理，所有 Pydantic 模型的配置也用 `model_config = ConfigDict(...)` 而不是 `class Config`。

## FastAPI 新版语法

本项目使用 FastAPI 0.100+，遵循以下规范：

**启动/关闭事件**——用 `lifespan` 而非已废弃的 `@app.on_event`：
```python
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup 逻辑
    yield
    # shutdown 逻辑

app = FastAPI(lifespan=lifespan)
```

**依赖注入**——用 `Annotated` 语法（推荐）：
```python
from typing import Annotated
from fastapi import Depends

def get_db(): ...

@router.get("/items")
def list_items(db: Annotated[Session, Depends(get_db)]):
    ...
```

**Router 声明**——带 `prefix` 和 `tags`：
```python
router = APIRouter(prefix="/record-asr", tags=["asr"])
```

## SQLAlchemy v2 语法（备注，当前未使用）

当前项目通过 `supabase-py` 访问数据库，不使用 SQLAlchemy。如未来引入，使用 v2 语法：

```python
# v1 旧写法（禁止）
session.query(User).filter(User.id == 1).first()

# v2 正确写法
from sqlalchemy import select
stmt = select(User).where(User.id == 1)
result = session.execute(stmt).scalar_one_or_none()
```

v2 模型声明用 `Mapped[]` + `mapped_column()`：
```python
from sqlalchemy.orm import Mapped, mapped_column

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
```
