"""Testes do Agente Eproc (lado servidor) — Etapa 8."""

from datetime import datetime, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import models
from database import get_db
from auth.deps import create_access_token
from routers.robo import router as robo_router

CORP = "@reisrevisional.com.br"
ROBO_TOKEN = "robo-secret-de-teste"
ALERTA = "🚨 ALERTA VERMELHO"


@pytest.fixture(autouse=True)
def _robo_token_env(monkeypatch):
    monkeypatch.setenv("ROBO_TOKEN", ROBO_TOKEN)


@pytest.fixture
def client(db):
    app = FastAPI()
    app.include_router(robo_router)

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


def robo_headers():
    return {"X-Robo-Token": ROBO_TOKEN}


def criar_cliente(db, id_dj, cs_id):
    c = models.Customer(id_datajuri=id_dj, first_name="Ana", cs_id=cs_id, status="Ativo",
                        criticidade="Regular", tem_processo="Sim", contatos=0, tentativas=0)
    db.add(c)
    db.commit()
    return c


def payload_normal(id_dj):
    return {"id_datajuri": id_dj, "classe": "Procedimento Comum",
            "data_movimentacao": "2026-06-14", "descricao": "Juntada de petição",
            "triagem": "NORMAL"}


def payload_alerta(id_dj):
    return {"id_datajuri": id_dj, "classe": "BUSCA E APREENSÃO",
            "data_movimentacao": "2026-06-14", "descricao": "Petição de mandado",
            "triagem": ALERTA}


REGISTRO_NORMAL = "REGISTRO NORMAL"


def payload_registro_normal(id_dj):
    return {"id_datajuri": id_dj, "classe": "Execução de Título Extrajudicial",
            "data_movimentacao": "2026-06-14", "descricao": "Despacho: manifeste-se a parte autora",
            "triagem": REGISTRO_NORMAL}


# ---------------------------------------------------------------- autenticação

def test_resultado_sem_token_retorna_401(client, db):
    criar_cliente(db, "C1", cs_id=1)
    r = client.post("/api/robo/resultado", json=payload_normal("C1"))
    assert r.status_code == 401


def test_resultado_com_cpf_retorna_422(client, db):
    cs = criar_usuario(db, "CS", 1, "cs1")
    criar_cliente(db, "C1", cs.id)
    corpo = payload_normal("C1")
    corpo["cpf"] = "12345678900"  # proibido
    r = client.post("/api/robo/resultado", json=corpo, headers=robo_headers())
    assert r.status_code == 422


def test_resultado_id_inexistente_retorna_404(client, db):
    r = client.post("/api/robo/resultado", json=payload_normal("NAO_EXISTE"), headers=robo_headers())
    assert r.status_code == 404


# ------------------------------------------------------------ alerta → tarefa

def test_alerta_cria_tarefa_e_nao_duplica(client, db):
    cs = criar_usuario(db, "CS", 1, "cs1")
    criar_cliente(db, "C1", cs.id)

    r1 = client.post("/api/robo/resultado", json=payload_alerta("C1"), headers=robo_headers())
    assert r1.status_code == 201

    tarefas = db.query(models.Tarefa).filter_by(cliente_id="C1", origem="sistema").all()
    assert len(tarefas) == 1
    assert tarefas[0].classificacao == "CRÍTICA/URGENTE"
    assert tarefas[0].responsavel_id == cs.id

    # Segundo POST igual NÃO duplica a tarefa (mas grava o 2º resultado).
    r2 = client.post("/api/robo/resultado", json=payload_alerta("C1"), headers=robo_headers())
    assert r2.status_code == 201
    assert db.query(models.Tarefa).filter_by(cliente_id="C1", origem="sistema").count() == 1
    assert db.query(models.RoboResultado).filter_by(customer_id="C1").count() == 2


def test_registro_normal_cria_tarefa_regular_e_nao_duplica(client, db):
    cs = criar_usuario(db, "CS", 1, "cs1")
    criar_cliente(db, "C1", cs.id)

    r1 = client.post("/api/robo/resultado", json=payload_registro_normal("C1"), headers=robo_headers())
    assert r1.status_code == 201

    tarefas = db.query(models.Tarefa).filter_by(cliente_id="C1", origem="sistema").all()
    assert len(tarefas) == 1
    assert tarefas[0].classificacao == "REGULAR"
    assert tarefas[0].setor == "Atendimento"
    assert tarefas[0].responsavel_id == cs.id

    # Segundo POST igual NÃO duplica a tarefa REGULAR (mas grava o 2º resultado).
    r2 = client.post("/api/robo/resultado", json=payload_registro_normal("C1"), headers=robo_headers())
    assert r2.status_code == 201
    assert db.query(models.Tarefa).filter_by(cliente_id="C1", origem="sistema").count() == 1
    assert db.query(models.RoboResultado).filter_by(customer_id="C1").count() == 2


def test_registro_normal_sem_dono_nao_cria_tarefa(client, db):
    criar_cliente(db, "C1", cs_id=None)  # cliente sem CS dono
    r = client.post("/api/robo/resultado", json=payload_registro_normal("C1"), headers=robo_headers())
    assert r.status_code == 201
    assert db.query(models.Tarefa).filter_by(cliente_id="C1").count() == 0


def test_alerta_e_registro_normal_coexistem_sem_dedup_cruzado(client, db):
    # Um alerta (CRÍTICA) e um registro normal (REGULAR) no mesmo cliente geram
    # DUAS tarefas distintas — o dedup é por classificação, não bloqueia cruzado.
    cs = criar_usuario(db, "CS", 1, "cs1")
    criar_cliente(db, "C1", cs.id)

    client.post("/api/robo/resultado", json=payload_registro_normal("C1"), headers=robo_headers())
    client.post("/api/robo/resultado", json=payload_alerta("C1"), headers=robo_headers())

    tarefas = db.query(models.Tarefa).filter_by(cliente_id="C1", origem="sistema").all()
    classes = sorted(t.classificacao for t in tarefas)
    assert classes == ["CRÍTICA/URGENTE", "REGULAR"]


# ---------------------------------------------------------------- escopo GET

def test_cs_nao_ve_resultados_de_outro_cs(client, db):
    cs1 = criar_usuario(db, "CS", 1, "cs1")
    cs2 = criar_usuario(db, "CS", 1, "cs2")
    criar_cliente(db, "C1", cs1.id)
    criar_cliente(db, "C2", cs2.id)
    client.post("/api/robo/resultado", json=payload_normal("C1"), headers=robo_headers())
    client.post("/api/robo/resultado", json=payload_normal("C2"), headers=robo_headers())

    r = client.get("/api/robo/resultados", headers=headers(cs1))
    assert r.status_code == 200
    ids = {item["customer_id"] for item in r.json()}
    assert ids == {"C1"}
    # garante que não vaza CPF
    assert all("cpf" not in item for item in r.json())


# ------------------------------------------------------------- encerrar-dia

def test_encerrar_dia_apaga_resultados_preserva_lancamentos(client, db):
    cs = criar_usuario(db, "CS", 1, "cs1")
    criar_cliente(db, "C1", cs.id)
    client.post("/api/robo/resultado", json=payload_normal("C1"), headers=robo_headers())
    # lançamentos financeiros que NÃO podem ser tocados
    db.add(models.Attendance(user_id=cs.id, customer_id="C1", commission_value=1.5,
                             timestamp=datetime.now(timezone.utc).replace(tzinfo=None)))
    db.add(models.BonusEntry(user_id=cs.id, customer_id="C1", tipo="Quitacao", valor=5.0,
                             timestamp=datetime.now(timezone.utc).replace(tzinfo=None)))
    db.commit()

    assert db.query(models.RoboResultado).count() == 1
    r = client.post("/api/robo/encerrar-dia", headers=headers(cs))
    assert r.status_code == 200

    assert db.query(models.RoboResultado).count() == 0          # apagados
    assert db.query(models.Attendance).count() == 1             # preservado
    assert db.query(models.BonusEntry).count() == 1             # preservado
