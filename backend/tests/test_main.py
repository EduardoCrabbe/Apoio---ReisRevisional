"""Testes da montagem da aplicação — Etapa 5.5."""

import pytest
from fastapi.testclient import TestClient

import main

ROTAS_ESPERADAS = [
    "/api/auth/login",
    "/api/clientes",
    "/api/bonus",
    "/api/comissoes",
    "/api/tarefas",
]


def test_create_app_sem_secret_key_levanta(monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    with pytest.raises(RuntimeError):
        main.create_app()


def test_health_responde_ok():
    app = main.create_app()
    client = TestClient(app)  # sem context manager: não dispara o lifespan
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_openapi_contem_todas_as_rotas():
    app = main.create_app()
    paths = list(app.openapi()["paths"].keys())
    for esperada in ROTAS_ESPERADAS:
        assert any(p == esperada or p.startswith(esperada) for p in paths), f"faltou {esperada}"


def test_disable_task_loop_nao_pendura(monkeypatch):
    monkeypatch.setenv("DISABLE_TASK_LOOP", "1")
    app = main.create_app()
    # Com o context manager o lifespan roda: faz UMA passada do gerador e,
    # com DISABLE_TASK_LOOP=1, não agenda o loop de 24h — então não trava.
    with TestClient(app) as client:
        assert client.get("/api/health").status_code == 200
