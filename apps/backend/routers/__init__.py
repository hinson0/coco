from fastapi import APIRouter

from .auth import router as auth_router
from .chat import router as chat_router
from .iap import router as iap_router
from .ocr import router as ocr_router
from .sync import router as sync_router

all_routers = APIRouter()

all_routers.include_router(auth_router)
all_routers.include_router(ocr_router)
all_routers.include_router(chat_router)
all_routers.include_router(sync_router)
all_routers.include_router(iap_router)
