"""Testes de autenticação — Etapa 2.

Cobre todos os critérios pedidos:
  - registro com domínio errado → 403
  - registro do 13º CS → 400
  - login com senha errada → 401 genérico
  - login com usuário inativo → 401 com a MESMA mensagem genérica
  - rota protegida sem token → 401
  - rota de gestão com token de CS → 403
  - token expirado → 401
  - 1º usuário vira Gerente independentemente do papel enviado
Extras: senha curta → 400; /me com token válido; gestão com Gerente → 200.
"""

import os
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from jose import jwt

import models
from database import get_db
from auth.router import router as auth_router
from auth.deps import ALGORITHM, require_role

CORP = "@reisrevisional.com.br"


@pytest.fixture
def client(db):
    app = FastAPI()
    app.include_router(auth_router)

    # Rota só de gestão, para exercitar require_role nos testes.
    @app.get("/api/_gestao_only")
    def _gestao_only(user=Depends(require_role("Gerente", "Supervisor"))):
        return {"ok": True, "role": user.role}

    def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    return TestClient(app)


def _registrar(client, email, password="senha123", role="CS"):
    return client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "role": role},
    )


def _login_token(client, email, password="senha123"):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _token_expirado(user_id, role, level_cs):
    """JWT já vencido, assinado com a MESMA SECRET_KEY/algoritmo do app."""
    payload = {
        "sub": str(user_id),
        "role": role,
        "level_cs": level_cs,
        "exp": datetime.now(timezone.utc) - timedelta(hours=1),
    }
    return jwt.encode(payload, os.environ["SECRET_KEY"], algorithm=ALGORITHM)


# ---------------------------------------------------------------- registro

def test_registro_com_dominio_errado_retorna_403(client):
    assert _registrar(client, "fulano@gmail.com").status_code == 403


def test_registro_senha_curta_retorna_400(client):
    assert _registrar(client, f"alguem{CORP}", password="123", role="Gerente").status_code == 400


def test_primeiro_usuario_vira_gerente(client):
    r = _registrar(client, f"primeiro{CORP}", role="CS")  # pediu CS, mas é o 1º
    assert r.status_code == 201, r.text
    assert r.json()["role"] == "Gerente"
    assert r.json()["level_cs"] is None


def test_decimo_terceiro_cs_retorna_400(client):
    assert _registrar(client, f"chefe{CORP}", role="Gerente").status_code == 201  # 1º = Gerente
    for i in range(1, 13):  # 12 CS aceitos
        assert _registrar(client, f"cs{i}{CORP}", role="CS").status_code == 201, f"CS {i}"
    assert _registrar(client, f"cs13{CORP}", role="CS").status_code == 400  # 13º estoura


# ------------------------------------------------------------------- login

def test_login_senha_errada_401_generico(client):
    _registrar(client, f"user{CORP}", password="correta1", role="Gerente")
    r = client.post("/api/auth/login", json={"email": f"user{CORP}", "password": "errada99"})
    assert r.status_code == 401
    assert r.json()["detail"] == "E-mail ou senha incorretos"


def test_login_email_inexistente_mesma_mensagem(client):
    r = client.post("/api/auth/login", json={"email": f"naoexiste{CORP}", "password": "qualquer1"})
    assert r.status_code == 401
    assert r.json()["detail"] == "E-mail ou senha incorretos"


def test_login_usuario_inativo_mesma_mensagem(client, db):
    _registrar(client, f"inativo{CORP}", password="senha123", role="Gerente")
    user = db.query(models.User).filter_by(email=f"inativo{CORP}").first()
    user.ativo = False
    db.commit()
    r = client.post("/api/auth/login", json={"email": f"inativo{CORP}", "password": "senha123"})
    assert r.status_code == 401
    assert r.json()["detail"] == "E-mail ou senha incorretos"  # não revela que existe/está inativo


# --------------------------------------------------------- rotas protegidas

def test_rota_protegida_sem_token_retorna_401(client):
    assert client.get("/api/_gestao_only").status_code == 401


def test_rota_gestao_com_token_de_cs_retorna_403(client):
    _registrar(client, f"gerente{CORP}", role="Gerente")   # 1º = Gerente
    _registrar(client, f"atendente{CORP}", role="CS")      # 2º = CS
    token_cs = _login_token(client, f"atendente{CORP}")
    r = client.get("/api/_gestao_only", headers={"Authorization": f"Bearer {token_cs}"})
    assert r.status_code == 403


def test_token_expirado_retorna_401(client):
    _registrar(client, f"gerente{CORP}", role="Gerente")
    token = _token_expirado(1, "Gerente", None)
    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_gestao_com_token_de_gerente_ok(client):
    _registrar(client, f"gerente{CORP}", role="Gerente")
    token = _login_token(client, f"gerente{CORP}")
    r = client.get("/api/_gestao_only", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["role"] == "Gerente"


def test_me_devolve_usuario_logado(client):
    _registrar(client, f"gerente{CORP}", role="Gerente")
    token = _login_token(client, f"gerente{CORP}")
    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == f"gerente{CORP}"
    assert r.json()["role"] == "Gerente"
