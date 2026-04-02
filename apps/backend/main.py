from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apps.backend.routers import all_routers

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
