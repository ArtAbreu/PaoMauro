import backend.app as app_module


def test_resolve_port_uses_default_when_env_missing(monkeypatch):
    monkeypatch.delenv("PORT", raising=False)
    assert app_module._resolve_port(8000) == 8000


def test_resolve_port_reads_environment(monkeypatch):
    monkeypatch.setenv("PORT", "4567")
    assert app_module._resolve_port(8000) == 4567


def test_resolve_port_handles_invalid_values(monkeypatch):
    monkeypatch.setenv("PORT", "invalid")
    assert app_module._resolve_port(9000) == 9000
