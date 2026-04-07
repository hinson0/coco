from fastapi import APIRouter

from .chat import router as chat_router
from .ocr import router as ocr_router

all_routers = APIRouter()

all_routers.include_router(ocr_router)
all_routers.include_router(chat_router)
