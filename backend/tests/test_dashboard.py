"""Testes do Dashboard e da Equipe — Etapa 6."""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import models
from database import get_db
from auth.deps import create_access_token
from routers.dashboard import router as dashboard_router
from routers.equipe import router as equipe_router
from routers.bonus import router as bonus_router

CORP = "@reisrevisional.com.br"


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _mes_passado():
    inicio_mes = _utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return inicio_mes - timedelta(days=1)  # último dia do mês anterior


@pytest.fixture
def client(db):
    app = FastAPI()
    app.include_router(dashboard_router)
    app.include_router(equipe_router)
    app.include_router(bonus_router)

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


def criar_cliente(db, id_dj, cs_id, contatos=0, tentativas=0, criticidade="Regular",
                  status="Ativo", ultimo_contato=None):
    c = models.Customer(id_datajuri=id_dj, first_name="Ana", cs_id=cs_id, status=status,
                        criticidade=criticidade, tem_processo="Não", contatos=contatos,
                        tentativas=tentativas, ultimo_contato=ultimo_contato)
    db.add(c)
    db.commit()
    return c


def add_attendance(db, user_id, customer_id, valor, timestamp):
    db.add(models.Attendance(user_id=user_id, customer_id=customer_id,
                             commission_value=valor, timestamp=timestamp))
    db.commit()


def add_bonus(db, user_id, customer_id, valor, timestamp, tipo="VideoDepoimento"):
    db.add(models.BonusEntry(user_id=user_id, customer_id=customer_id, tipo=tipo,
                             valor=valor, timestamp=timestamp))
    db.commit()


# ------------------------------------------------------------------ dashboard

def test_dashboard_conta_e_percentuais_e_ganhos(client, db):
    cs = criar_usuario(db, "CS", 2, "cs1")
    # 5 ativos: 2 com contatos>0, 1 só tentativas, 2 zerados
    criar_cliente(db, "C1", cs.id, contatos=3)
    criar_cliente(db, "C2", cs.id, contatos=1)
    criar_cliente(db, "C3", cs.id, contatos=0, tentativas=2)
    criar_cliente(db, "C4", cs.id, contatos=0, tentativas=0)
    criar_cliente(db, "C5", cs.id, contatos=0, tentativas=0)

    # 1 atendimento + 1 bônus no mês corrente
    add_attendance(db, cs.id, "C1", 1.5, _utcnow())
    add_bonus(db, cs.id, "C1", 20.0, _utcnow())
    # 1 atendimento do mês passado (deve ficar de fora)
    add_attendance(db, cs.id, "C2", 99.0, _mes_passado())

    r = client.get("/api/dashboard/stats", headers=headers(cs))
    assert r.status_code == 200
    d = r.json()
    assert d["totalAtivos"] == 5
    assert d["atendidos"] == 2
    assert d["tentativas"] == 1
    assert d["naoAtendidos"] == 2
    assert d["percentuais"] == {"atendidos": 40.0, "tentativas": 20.0, "naoAtendidos": 40.0}
    assert d["ganhosTotais"] == 21.5  # 1.5 + 20.0; exclui os 99.0 do mês passado


def test_dashboard_cs_so_ve_a_propria_carteira(client, db):
    cs1 = criar_usuario(db, "CS", 2, "cs1")
    cs2 = criar_usuario(db, "CS", 2, "cs2")
    criar_cliente(db, "C1", cs1.id, contatos=1)
    criar_cliente(db, "X1", cs2.id, contatos=1)
    criar_cliente(db, "X2", cs2.id)

    d = client.get("/api/dashboard/stats", headers=headers(cs1)).json()
    assert d["totalAtivos"] == 1  # só o cliente do cs1


def test_radar_critico_atrasado_e_regular_ausente(client, db):
    cs = criar_usuario(db, "CS", 2, "cs1")
    criar_cliente(db, "CRIT", cs.id, contatos=1, criticidade="Crítico",
                  ultimo_contato=_utcnow() - timedelta(days=10))
    criar_cliente(db, "REG", cs.id, contatos=1, criticidade="Regular",
                  ultimo_contato=_utcnow() - timedelta(days=10))

    prioridades = client.get("/api/dashboard/stats", headers=headers(cs)).json()["prioridades"]
    ids = {p["customer_id"] for p in prioridades}
    assert "CRIT" in ids
    assert "REG" not in ids  # Regular nunca entra no radar
    crit = next(p for p in prioridades if p["customer_id"] == "CRIT")
    assert crit["status"] == "Atrasado"


# --------------------------------------------------------------------- equipe

def test_cs_no_get_equipe_recebe_403(client, db):
    cs = criar_usuario(db, "CS", 1, "cs1")
    assert client.get("/api/equipe", headers=headers(cs)).status_code == 403


def test_put_nivel_por_cs_403_por_gerente_ok_e_congela_passado(client, db):
    gerente = criar_usuario(db, "Gerente", None, "ger")
    cs = criar_usuario(db, "CS", 2, "cs1")
    criar_cliente(db, "C1", cs.id, contatos=1)
    # atendimento ANTES da mudança, congelado no valor do nível 2 (1.50)
    add_attendance(db, cs.id, "C1", 1.5, _utcnow())

    # CS tentando mudar nível → 403
    assert client.put(f"/api/equipe/{cs.id}/nivel", json={"level_cs": 4},
                      headers=headers(cs)).status_code == 403

    # Gerente muda → ok
    r = client.put(f"/api/equipe/{cs.id}/nivel", json={"level_cs": 4}, headers=headers(gerente))
    assert r.status_code == 200
    assert r.json()["level_cs"] == 4
    db.refresh(cs)
    assert cs.level_cs == 4

    # atendimento antigo permanece congelado em 1.50
    att = db.query(models.Attendance).filter_by(customer_id="C1").first()
    assert att.commission_value == 1.5


def test_delete_equipe_desativa_e_preserva_ganhos(client, db):
    gerente = criar_usuario(db, "Gerente", None, "ger")
    cs = criar_usuario(db, "CS", 2, "cs1")
    criar_cliente(db, "C1", cs.id, contatos=1)
    add_bonus(db, cs.id, "C1", 20.0, _utcnow())

    r = client.delete(f"/api/equipe/{cs.id}", headers=headers(gerente))
    assert r.status_code == 200
    db.refresh(cs)
    assert cs.ativo is False  # desativado, não apagado

    # ganhos do CS desativado continuam no relatório (extrato, visão gestão)
    extrato = client.get("/api/bonus/extrato", headers=headers(gerente)).json()
    assert any(e["cs"] == "cs1" and e["valor"] == 20.0 for e in extrato)


def test_gerente_nao_desativa_a_si_mesmo(client, db):
    gerente = criar_usuario(db, "Gerente", None, "ger")
    r = client.delete(f"/api/equipe/{gerente.id}", headers=headers(gerente))
    assert r.status_code == 400
    db.refresh(gerente)
    assert gerente.ativo is True
