from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    silicon_api_key: str
    tencent_secret_id: str
    tencent_secret_key: str

    # SMS (腾讯云)
    sms_app_id: str = ""
    sms_sign_name: str = ""
    sms_template_id: str = ""

    database_url: str
    jwt_secret: str
    jwt_access_expire_minutes: int = 60
    jwt_refresh_expire_days: int = 30

    # Logging
    app_env: str = "dev"
    log_level: str = "DEBUG"


settings = Settings()  # pyright: ignore[reportCallIssue]
