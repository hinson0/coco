# TODO(human): 用 pydantic-settings 实现环境变量配置
# 参考计划 Task 3，在这里定义 Settings 类并创建 settings 实例

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    pass


# 保证全局唯一实例.也就是单例模式:singleton pattern
settings = Settings()
