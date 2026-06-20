"""Testes da listagem de quitações — Etapa 9 (GET /api/quitacoes)."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import models
from database import get_db
from auth.deps import create_access_token
from routers.quitacoes import router as quitacoes_router

CORP = "@reisrevisional.com.br"


@pytest.fixture
def client(db):
    app = FastAPI()
    app.include_router(quitacoes_router)

    def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    return TestClient(app)


def _user(db, role, sufixo, level_cs=None):
    u = models.User(
        email=f"{sufixo}{CORP}",
        password_hash="x",
        role=role,
        level_cs=level_cs,
        nome_exibicao=sufixo,
        ativo=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _headers(user):
    return {"Authorization": f"Bearer {create_access_token(user.id, user.role, user.level_cs)}"}


def _cliente(db, id_dj, cs_id, nome="Ana"):
    c = models.Customer(
        id_datajuri=id_dj, first_name=nome, status="Quitado", cs_id=cs_id,
        tem_processo="Não", criticidade="Regular", contatos=0, tentativas=0,
    )
    db.add(c)
    db.commit()
    return c


def _quitacao(db, customer_id, cs_id, original, pago, mes="2026-06", pagamento="à vista"):
    q = models.Quitacao(
        customer_id=customer_id, cs_id=cs_id,
        valor_original=original, valor_pago=pago, mes_referencia=mes,
        pagamento=pagamento,
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    return q


def test_cs_ve_so_as_proprias_e_economia_calculada(client, db):
    cs1 = _user(db, "CS", "cs1", level_cs=1)
    cs2 = _user(db, "CS", "cs2", level_cs=1)
    _cliente(db, "C1", cs1.id, nome="João")
    _cliente(db, "C2", cs2.id, nome="Maria")
    _quitacao(db, "C1", cs1.id, 1000.0, 400.0)
    _quitacao(db, "C2", cs2.id, 500.0, 250.0)

    r = client.get("/api/quitacoes", headers=_headers(cs1))
    assert r.status_code == 200
    dados = r.json()
    assert len(dados) == 1
    item = dados[0]
    assert item["customer_id"] == "C1"
    assert item["cliente"] == "João"
    assert item["economia"] == 600.0
    assert item["percentual"] == 60.0
    # CPF jamais aparece (nem existe no servidor).
    assert "cpf" not in item


def test_gestao_ve_todas(client, db):
    ger = _user(db, "Gerente", "ger")
    cs1 = _user(db, "CS", "cs1", level_cs=1)
    _cliente(db, "C1", cs1.id)
    _quitacao(db, "C1", cs1.id, 1000.0, 400.0)
    _quitacao(db, "C1", cs1.id, 200.0, 100.0)

    r = client.get("/api/quitacoes", headers=_headers(ger))
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_filtro_mes_invalido_422(client, db):
    cs1 = _user(db, "CS", "cs1", level_cs=1)
    r = client.get("/api/quitacoes?mes=2026-13", headers=_headers(cs1))
    assert r.status_code == 422


def test_get_retorna_campo_pagamento(client, db):
    cs1 = _user(db, "CS", "cs1", level_cs=1)
    _cliente(db, "C1", cs1.id, nome="João")
    _quitacao(db, "C1", cs1.id, 1000.0, 400.0, pagamento="10x de R$500,00")

    r = client.get("/api/quitacoes", headers=_headers(cs1))
    assert r.status_code == 200
    item = r.json()[0]
    assert "pagamento" in item
    assert item["pagamento"] == "10x de R$500,00"


def test_get_inclui_status_juridico_do_cliente(client, db):
    cs1 = _user(db, "CS", "cs1", level_cs=1)
    c = _cliente(db, "C1", cs1.id, nome="João")
    c.protesto = "Cliente ciente"
    c.tarifas_restituiveis = True
    c.consulta_processo = True
    db.commit()
    _quitacao(db, "C1", cs1.id, 1000.0, 400.0)

    item = client.get("/api/quitacoes", headers=_headers(cs1)).json()[0]
    # vêm do Customer (join), não da quitação
    assert item["protesto"] == "Cliente ciente"
    assert item["tarifas_restituiveis"] is True
    assert item["consulta_processo"] is True


def test_sem_token_401(client, db):
    r = client.get("/api/quitacoes")
    assert r.status_code == 401
