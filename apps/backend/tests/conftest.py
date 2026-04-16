import os

# pytest 在收集 test 模块前先执行 conftest.py，
# 因此这里的 setdefault 在 settings = Settings() 之前生效，
# 覆盖 .env 中的短密钥，消除 InsecureKeyLengthWarning（RFC 7518 要求 ≥32 字节）
# 强制覆盖（setdefault 在 shell 已 export JWT_SECRET 时不生效）
os.environ["JWT_SECRET"] = "test-secret-key-for-pytest-only-32bytes!"

# 为 Settings 必填字段提供测试用占位值（避免无 .env 时初始化失败）
os.environ.setdefault("SILICON_API_KEY", "test-silicon-key")
os.environ.setdefault("TENCENT_SECRET_ID", "test-secret-id")
os.environ.setdefault("TENCENT_SECRET_KEY", "test-secret-key")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test"
)
