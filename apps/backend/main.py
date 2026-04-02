# TODO(human): FastAPI 入口 —— 创建 app，配置 CORS，挂载 3 个 router，添加 /health 端点
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import all_routers

app = FastAPI(title="CoCo backend")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 加载所有的router
app.include_router(all_routers)


@app.get("/health")
def health():
    return {"status": "ok"}
