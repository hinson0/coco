from fastapi import APIRouter
from .asr import router as asr_router
from .ocr import router as ocr_router
from .text import router as text_router

all_routers = APIRouter()

all_routers.include_router(asr_router)
all_routers.include_router(ocr_router)
all_routers.include_router(text_router)
