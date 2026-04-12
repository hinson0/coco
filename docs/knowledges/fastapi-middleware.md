# FastAPI 中间件实践

## 两种注册方式

### 装饰器（适合简单、一次性逻辑）

```python
from fastapi import FastAPI, Request, Response
import time

app = FastAPI()

@app.middleware("http")
async def add_process_time_header(request: Request, call_next) -> Response:
    start_time = time.perf_counter()
    response = await call_next(request)
    process_time = time.perf_counter() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response
```

### `app.add_middleware()`（适合可复用/第三方/需要配置参数的中间件）

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

装饰器本质是 `add_middleware` 的语法糖，但无法传配置参数。

## 中间件函数签名

```python
from typing import Awaitable, Callable

async def my_middleware(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    # 请求前：可以读取/修改 request
    response = await call_next(request)
    # 响应后：可以读取/修改 response
    return response
```

- `call_next(request)` 把控制权交给下一层中间件或路由
- **必须返回 `Response`**，否则请求会挂起
- 短路场景（如认证失败）：直接返回 `Response` 而不调用 `call_next`

## 执行顺序（洋葱模型）

```python
app.add_middleware(MiddlewareA)  # 第二个注册
app.add_middleware(MiddlewareB)  # 第一个注册 → 但它是最外层
```

```
请求进入 → MiddlewareB → MiddlewareA → 路由处理 → MiddlewareA → MiddlewareB → 响应返回
```

**后注册的中间件包裹在最外层**：
- 认证中间件应该**后注册**（最先拦截请求）
- CORS 中间件通常放最外层（最后一个 `add_middleware`）

## 常见内置中间件

| 中间件 | 用途 |
|--------|------|
| `CORSMiddleware` | 跨域资源共享 |
| `GZipMiddleware` | 响应压缩 |
| `TrustedHostMiddleware` | 限制允许的 Host 头 |
| `HTTPSRedirectMiddleware` | 强制 HTTPS |

## 推荐注册顺序（从内到外）

```python
app.add_middleware(GZipMiddleware, minimum_size=500)    # 最内层
app.add_middleware(AuthMiddleware)                       # 认证
app.add_middleware(                                      # 最外层
    CORSMiddleware,
    allow_origins=["..."],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## 注意事项

- **不要在中间件里读 `request.body()`**：body 是流式的，读一次就消耗了，后续路由拿不到。如果确实需要，必须重新构造 `Request` 对象
- **中间件与路由传递数据**：用 `request.state`（如 `request.state.user = current_user`），不要用全局变量
- **避免阻塞 I/O**：中间件里做阻塞操作会拖慢整个事件循环，必要时用 `asyncio.to_thread()` 包裹
- FastAPI 中间件底层完全基于 **Starlette**，所有 Starlette 中间件可直接使用
