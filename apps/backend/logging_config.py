import logging

import structlog
from structlog.processors import CallsiteParameter, CallsiteParameterAdder


def setup_logging(env: str = "dev", level: str = "DEBUG") -> None:
    """配置全局 structlog。在 lifespan 启动时调用一次。"""
    log_level = getattr(logging, level.upper(), logging.DEBUG)

    shared_processors = [
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
