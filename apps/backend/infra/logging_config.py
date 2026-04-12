import logging

import structlog
from structlog.processors import CallsiteParameter, CallsiteParameterAdder


def setup_logging(env: str = "dev", level: str = "DEBUG") -> None:
    """配置全局 structlog。

    仅应在应用启动时（lifespan）调用一次。
    logging.basicConfig() 多次调用为 no-op，重复调用不会更新 stdlib 日志级别。
    """
    log_level = getattr(logging, level.upper(), logging.DEBUG)

    shared_processors = [
        structlog.contextvars.merge_contextvars,  # 合并请求级 contextvars
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="%Y-%m-%d %H:%M:%S.%f", utc=False),
        CallsiteParameterAdder([CallsiteParameter.MODULE]),
        structlog.processors.StackInfoRenderer(),
    ]

    if env == "prod":
        renderer = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=True)

    structlog.configure(
        processors=shared_processors + [renderer],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
    )

    logging.basicConfig(level=log_level)
    # 屏蔽第三方库的 DEBUG 噪音日志
    logging.getLogger(
        "tencentcloud_sdk_common"
    ).propagate = False  # SDK 请求/响应体（含 base64）
    logging.getLogger("urllib3").setLevel(
        logging.WARNING
    )  # HTTP 连接 DEBUG 日志
