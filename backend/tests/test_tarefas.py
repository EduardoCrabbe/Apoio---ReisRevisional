"""Testes do módulo de Tarefas — Etapa 5."""

from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import models
from database import get_db
from auth.deps import create_access_token
from routers.tarefas import router as tarefas_router
from services.tarefas import gerar_tarefas_sistema

CORP = "@reisrevisional.com.br"
SETOR_OK = "Atendimento"
CLASS_OK = "REGULAR"


def hoje():
    return datetime.now(timezone.utc).date()


@pytest.fixture
def client(db):
    app = FastAPI()
    app.include_router(tarefas_router)

    def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    return TestClient(app)


def criar_usuario(db, role, level_cs=None, sufixo="u"):
    u = models.User(
        email=f"{sufixo}{CORP}", password_hash="x", role=role,
        level_cs=level_cs, nome_exibicao=sufixo, ativo=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def headers(user):
    return {"Authorization": f"Bearer {create_access_token(user.id, user.role, user.level_cs)}"}


def criar_cliente(db, id_datajuri, cs_id, criticidade="Regular", status="Ativo",
                  ultimo_contato=None, first_name="Ana"):
    c = models.Customer(
        id_datajuri=id_datajuri, first_name=first_name, cs_id=cs_id,
        status=status, criticidade=criticidade, tem_processo="Não",
        contatos=0, tentativas=0, ultimo_contato=ultimo_contato,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def body(**kw):
    base = {"setor": SETOR_OK, "classificacao": CLASS_OK, "prazo": hoje().isoformat()}
    base.update(kw)
    return base


# ------------------------------------------------------------- criação / papéis

def test_cs_sem_responsavel_vira_ele_mesmo(client, db):
    cs = criar_usuario(db, "CS", 1, "cs1")
    r = client.post("/api/tarefas", json=body(), headers=headers(cs))
    assert r.status_code == 201, r.text
    assert r.json()["responsavel_id"] == cs.id


def test_cs_nao_pode_atribuir_a_outro(client, db):
    cs1 = criar_usuario(db, "CS", 1, "cs1")
    cs2 = criar_usuario(db, "CS", 2, "cs2")
    r = client.post("/api/tarefas", json=body(responsavel_id=cs2.id), headers=headers(cs1))
    assert r.status_code == 201
    assert r.json()["responsavel_id"] == cs1.id  # ignorou e usou o próprio


def test_gestao_atribui_a_cs_especifico(client, db):
    gerente = criar_usuario(db, "Gerente", None, "ger")
    cs = criar_usuario(db, "CS", 1, "cs1")
    r = client.post("/api/tarefas", json=body(responsavel_id=cs.id), headers=headers(gerente))
    assert r.status_code == 201
    assert r.json()["responsavel_id"] == cs.id


def test_setor_invalido_422(client, db):
    cs = criar_usuario(db, "CS", 1, "cs1")
    r = client.post("/api/tarefas", json=body(setor="Inexistente"), headers=headers(cs))
    assert r.status_code == 422


def test_classificacao_invalida_422(client, db):
    cs = criar_usuario(db, "CS", 1, "cs1")
    r = client.post("/api/tarefas", json=body(classificacao="URGENTÍSSIMO"), headers=headers(cs))
    assert r.status_code == 422


# ----------------------------------------------------------------- listagem

def test_cs_nao_ve_tarefas_de_outro(client, db):
    cs1 = criar_usuario(db, "CS", 1, "cs1")
    cs2 = criar_usuario(db, "CS", 2, "cs2")
    client.post("/api/tarefas", json=body(detalhes="da cs1"), headers=headers(cs1))
    client.post("/api/tarefas", json=body(detalhes="da cs2"), headers=headers(cs2))
    r = client.get("/api/tarefas", headers=headers(cs1))
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["responsavel_id"] == cs1.id


# ----------------------------------------------------------------- mes_anterior

def _primeiro_dia_mes_atual():
    h = hoje()
    return date(h.year, h.month, 1)


def test_mes_anterior_true_para_prazo_do_mes_passado(client, db):
    cs = criar_usuario(db, "CS", 1, "cs1")
    prazo_passado = _primeiro_dia_mes_atual() - timedelta(days=1)  # último dia do mês anterior
    client.post("/api/tarefas", json=body(prazo=prazo_passado.isoformat()), headers=headers(cs))
    r = client.get("/api/tarefas", headers=headers(cs))
    assert r.json()[0]["mes_anterior"] is True


def test_mes_anterior_false_para_prazo_hoje(client, db):
    cs = criar_usuario(db, "CS", 1, "cs1")
    client.post("/api/tarefas", json=body(prazo=hoje().isoformat()), headers=headers(cs))
    r = client.get("/api/tarefas", headers=headers(cs))
    assert r.json()[0]["mes_anterior"] is False


def test_adiar_move_prazo_para_hoje_e_zera_flag(client, db):
    cs = criar_usuario(db, "CS", 1, "cs1")
    prazo_passado = _primeiro_dia_mes_atual() - timedelta(days=1)
    criada = client.post("/api/tarefas", json=body(prazo=prazo_passado.isoformat()), headers=headers(cs)).json()
    assert criada["mes_anterior"] is True

    r = client.post(f"/api/tarefas/{criada['id']}/adiar", headers=headers(cs))
    assert r.status_code == 200
    assert r.json()["prazo"] == hoje().isoformat()
    assert r.json()["mes_anterior"] is False


def test_concluir_some_do_get_default(client, db):
    cs = criar_usuario(db, "CS", 1, "cs1")
    criada = client.post("/api/tarefas", json=body(), headers=headers(cs)).json()
    client.post(f"/api/tarefas/{criada['id']}/concluir", headers=headers(cs))

    assert client.get("/api/tarefas", headers=headers(cs)).json() == []
    concluidas = client.get("/api/tarefas?concluida=true", headers=headers(cs)).json()
    assert len(concluidas) == 1 and concluidas[0]["concluida"] is True


def test_delete_por_nao_dono_403(client, db):
    cs1 = criar_usuario(db, "CS", 1, "cs1")
    cs2 = criar_usuario(db, "CS", 2, "cs2")
    criada = client.post("/api/tarefas", json=body(), headers=headers(cs1)).json()
    r = client.delete(f"/api/tarefas/{criada['id']}", headers=headers(cs2))
    assert r.status_code == 403


# --------------------------------------------------------- gerador automático

def test_gerador_cria_para_critico_sem_contato(db):
    cs = criar_usuario(db, "CS", 1, "cs1")
    criar_cliente(db, "C1", cs.id, criticidade="Crítico", ultimo_contato=None)
    assert gerar_tarefas_sistema(db) == 1
    t = db.query(models.Tarefa).filter_by(cliente_id="C1", origem="sistema").first()
    assert t is not None
    assert t.classificacao == "CRÍTICA/URGENTE"
    assert t.responsavel_id == cs.id
    assert t.setor == "Atendimento"


def test_gerador_cria_para_critico_vencido_7_dias(db):
    cs = criar_usuario(db, "CS", 1, "cs1")
    criar_cliente(db, "C1", cs.id, criticidade="Crítico",
                  ultimo_contato=datetime.now(timezone.utc) - timedelta(days=8))
    assert gerar_tarefas_sistema(db) == 1


def test_gerador_nao_duplica_tarefa_aberta(db):
    cs = criar_usuario(db, "CS", 1, "cs1")
    criar_cliente(db, "C1", cs.id, criticidade="Crítico", ultimo_contato=None)
    assert gerar_tarefas_sistema(db) == 1
    assert gerar_tarefas_sistema(db) == 0  # já existe tarefa sistema aberta
    assert db.query(models.Tarefa).filter_by(cliente_id="C1").count() == 1


def test_gerador_ignora_cliente_regular(db):
    cs = criar_usuario(db, "CS", 1, "cs1")
    criar_cliente(db, "C1", cs.id, criticidade="Regular", ultimo_contato=None)
    assert gerar_tarefas_sistema(db) == 0


def test_gerador_ignora_cliente_quitado(db):
    cs = criar_usuario(db, "CS", 1, "cs1")
    criar_cliente(db, "C1", cs.id, criticidade="Crítico", status="Quitado", ultimo_contato=None)
    assert gerar_tarefas_sistema(db) == 0


def test_gerador_atencao_so_vence_em_15_dias(db):
    cs = criar_usuario(db, "CS", 1, "cs1")
    # 10 dias < 15 → ainda não vence para "Atenção"
    criar_cliente(db, "C1", cs.id, criticidade="Atenção",
                  ultimo_contato=datetime.now(timezone.utc) - timedelta(days=10))
    assert gerar_tarefas_sistema(db) == 0
    # 16 dias → vence, classificação LEMBRETE
    criar_cliente(db, "C2", cs.id, criticidade="Atenção",
                  ultimo_contato=datetime.now(timezone.utc) - timedelta(days=16))
    assert gerar_tarefas_sistema(db) == 1
    assert db.query(models.Tarefa).filter_by(cliente_id="C2").first().classificacao == "LEMBRETE"
