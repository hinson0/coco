import json

import pytest
import structlog

from logging_config import setup_logging


@pytest.fixture(autouse=True)
def reset_structlog():
    """每个测试后重置 structlog 全局状态，避免测试间干扰"""
    yield
    structlog.reset_defaults()


def test_prod_outputs_json(capsys):
    """prod 模式应输出合法 JSON，含 event、level、timestamp 字段"""
    setup_logging("prod", "DEBUG")
    log = structlog.get_logger()
    log.info("test.event", value=42)
    captured = capsys.readouterr()
    data = json.loads(captured.out.strip())
    assert data["event"] == "test.event"
    assert data["value"] == 42
    assert data["level"] == "info"
    assert "timestamp" in data


def test_level_filtering_suppresses_info(capsys):
    """LOG_LEVEL=WARNING 时，info 级别日志不应出现在输出中"""
    setup_logging("prod", "WARNING")
    log = structlog.get_logger()
    log.info("should.not.appear")
    log.warning("should.appear")
    captured = capsys.readouterr()
    assert "should.not.appear" not in captured.out
    assert "should.appear" in captured.out


def test_dev_mode_does_not_crash(capsys):
    """dev 模式调用不应抛出异常"""
    setup_logging("dev", "DEBUG")
    log = structlog.get_logger()
    log.info("dev.test", key="value")
    captured = capsys.readouterr()
    assert "dev.test" in captured.out
