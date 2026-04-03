from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    glm_api_key: str
    tencent_secret_id: str
    tencent_secret_key: str
    supabase_url: str
    supabase_service_role_key: str

    # Logging
    app_env: str = "dev"
    log_level: str = "DEBUG"


# 保证全局唯一实例.也就是单例模式:singleton pattern
settings = Settings()  # pyright: ignore[reportCallIssue]
