"""Testes da integração de IA (Gemini) — Etapa 7."""

import os

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import models
from database import get_db
from auth.deps import create_access_token
from routers.ia import router as ia_router
from services import gemini

CORP = "@reisrevisional.com.br"


@pytest.fixture(autouse=True)
def _modo_mock(monkeypatch):
    # Por padrão, modo mock (sem API real). Testes de falha sobrescrevem gerar_resumo.
    monkeypatch.setenv("GEMINI_MOCK", "1")


@pytest.fixture
def client(db):
    app = FastAPI()
    app.include_router(ia_router)

    def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    return TestClient(app)


def criar_usuario(db, role, level_cs=None, sufixo="u"):
    u = models.User(email=f"{sufixo}{CORP}", password_hash="x", role=role,
                    level_cs=level_cs, nome_exibicao=sufixo, ativo=True)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def headers(user):
    return {"Authorization": f"Bearer {create_access_token(user.id, user.role, user.level_cs)}"}


def upload(nome, conteudo=b"conteudo-fake-de-audio"):
    return {"file": (nome, conteudo, "application/octet-stream")}


# --------------------------------------------------------------- validações

def test_extensao_invalida_422(client, db):
    cs = criar_usuario(db, "CS", 1, "cs1")
    r = client.post("/api/ai/summarize", files=upload("nota.txt"), headers=headers(cs))
    assert r.status_code == 422


def test_arquivo_acima_do_limite_422(client, db, monkeypatch):
    monkeypatch.setattr("routers.ia.MAX_UPLOAD_BYTES", 5)
    cs = criar_usuario(db, "CS", 1, "cs1")
    r = client.post("/api/ai/summarize", files=upload("audio.mp3", b"0123456789"), headers=headers(cs))
    assert r.status_code == 422


# ------------------------------------------------------------------- sucesso

def test_resumo_mock_em_primeira_pessoa(client, db):
    cs = criar_usuario(db, "CS", 1, "cs1")
    r = client.post("/api/ai/summarize", files=upload("audio.mp3"), headers=headers(cs))
    assert r.status_code == 200
    assert r.json()["summary"].lower().startswith("liguei")


def test_summarize_grava_ai_summary_no_bonus(client, db):
    cs = criar_usuario(db, "CS", 1, "cs1")
    db.add(models.Customer(id_datajuri="C1", first_name="Ana", cs_id=cs.id, status="Ativo",
                           criticidade="Regular", tem_processo="Não", contatos=0, tentativas=0))
    db.commit()
    bonus = models.BonusEntry(user_id=cs.id, customer_id="C1", tipo="VideoDepoimento", valor=15.0)
    db.add(bonus)
    db.commit()
    db.refresh(bonus)

    r = client.post("/api/ai/summarize", files=upload("audio.mp3"),
                    data={"bonus_id": str(bonus.id)}, headers=headers(cs))
    assert r.status_code == 200
    db.refresh(bonus)
    assert bonus.ai_summary is not None
    assert bonus.ai_summary.lower().startswith("liguei")


# ------------------------------------------------- limpeza e falha da API

def test_limpeza_do_temporario_em_finally(client, db, monkeypatch):
    cs = criar_usuario(db, "CS", 1, "cs1")
    capturado = {}

    def fake(caminho, prompt):
        capturado["path"] = caminho
        assert os.path.exists(caminho)  # o temporário existe nesse ponto
        raise RuntimeError("exceção depois de criar o temporário")

    monkeypatch.setattr("services.gemini.gerar_resumo", fake)
    r = client.post("/api/ai/summarize", files=upload("audio.mp3"), headers=headers(cs))
    assert r.status_code == 502
    assert not os.path.exists(capturado["path"])  # removido no finally


def test_falha_da_api_retorna_502_sem_corpo_de_resumo(client, db, monkeypatch):
    cs = criar_usuario(db, "CS", 1, "cs1")

    def fake(caminho, prompt):
        raise gemini.GeminiError("API indisponível")

    monkeypatch.setattr("services.gemini.gerar_resumo", fake)
    r = client.post("/api/ai/summarize", files=upload("audio.mp3"), headers=headers(cs))
    assert r.status_code == 502
    assert "summary" not in r.json()


# ----------------------------------------------------------- prompt settings

def test_put_prompt_por_cs_403(client, db):
    cs = criar_usuario(db, "CS", 1, "cs1")
    r = client.put("/api/settings/ai-prompt", json={"ai_prompt": "novo"}, headers=headers(cs))
    assert r.status_code == 403


def test_put_prompt_por_gerente_persiste_e_get_retorna(client, db):
    gerente = criar_usuario(db, "Gerente", None, "ger")
    novo = "Resuma em primeira pessoa e omita qualquer CPF. (versão de teste)"
    r = client.put("/api/settings/ai-prompt", json={"ai_prompt": novo}, headers=headers(gerente))
    assert r.status_code == 200

    g = client.get("/api/settings/ai-prompt", headers=headers(gerente))
    assert g.status_code == 200
    assert g.json()["ai_prompt"] == novo
