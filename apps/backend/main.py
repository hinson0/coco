from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from logging_config import setup_logging
from routers import all_routers


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(settings.app_env, settings.log_level)
    yield


app = FastAPI(title="CoCo backend", lifespan=lifespan)


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
