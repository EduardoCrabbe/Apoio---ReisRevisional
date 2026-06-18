"""Testes do CRM de clientes — Etapa 3."""

import io
import json
import re
from datetime import datetime, timedelta, timezone


def agora():
    """UTC naive, sem a deprecação de agora()."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from openpyxl import Workbook

import models
from database import get_db
from auth.deps import create_access_token
from routers.clientes import router as clientes_router

CORP = "@reisrevisional.com.br"


@pytest.fixture
def client(db):
    app = FastAPI()
    app.include_router(clientes_router)

    def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    return TestClient(app)


# --------------------------------------------------------------------- helpers

def criar_usuario(db, role, level_cs=None, sufixo="u"):
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


def headers(user):
    return {"Authorization": f"Bearer {create_access_token(user.id, user.role, user.level_cs)}"}


def criar_cliente(db, id_datajuri, cs_id, **kw):
    c = models.Customer(
        id_datajuri=id_datajuri,
        first_name=kw.get("first_name", "Ana"),
        uf=kw.get("uf", "SP"),
        contrato=kw.get("contrato", "Veículo"),
        tem_processo=kw.get("tem_processo", "Não"),
        criticidade=kw.get("criticidade", "Regular"),
        status=kw.get("status", "Ativo"),
        cs_id=cs_id,
        contatos=kw.get("contatos", 0),
        tentativas=kw.get("tentativas", 0),
        ultimo_contato=kw.get("ultimo_contato"),
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def planilha_bytes(headers_row, linhas):
    wb = Workbook()
    ws = wb.active
    ws.append(headers_row)
    for ln in linhas:
        ws.append(ln)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


# ---------------------------------------------------------------- ownership 403

def test_cs_em_cliente_de_outro_cs_retorna_403(client, db):
    cs1 = criar_usuario(db, "CS", level_cs=2, sufixo="cs1")
    cs2 = criar_usuario(db, "CS", level_cs=2, sufixo="cs2")
    criar_cliente(db, "C1", cs_id=cs1.id)
    h2 = headers(cs2)

    assert client.get(f"/api/clientes?cs_id={cs1.id}", headers=h2).status_code == 403
    assert client.put("/api/clientes/C1", json={"criticidade": "Crítico"}, headers=h2).status_code == 403
    assert client.delete("/api/clientes/C1", headers=h2).status_code == 403
    assert client.post("/api/clientes/C1/atendimento", headers=h2).status_code == 403
    assert client.post("/api/clientes/C1/tentativa", headers=h2).status_code == 403
    assert client.post(
        "/api/clientes/C1/quitar",
        json={"valor_original": 100, "valor_pago": 50},
        headers=h2,
    ).status_code == 403


# ------------------------------------------------------------------ atendimento

def test_setimo_atendimento_retorna_400(client, db):
    cs = criar_usuario(db, "CS", level_cs=2, sufixo="cs")
    criar_cliente(db, "C1", cs_id=cs.id, contatos=6,
                  ultimo_contato=agora() - timedelta(days=10))
    r = client.post("/api/clientes/C1/atendimento", headers=headers(cs))
    assert r.status_code == 400
    assert "Limite de 6 atendimentos atingido" in r.json()["detail"]


def test_atendimento_antes_de_72h_retorna_400_com_tempo(client, db):
    cs = criar_usuario(db, "CS", level_cs=2, sufixo="cs")
    criar_cliente(db, "C1", cs_id=cs.id, contatos=1,
                  ultimo_contato=agora() - timedelta(hours=70))
    r = client.post("/api/clientes/C1/atendimento", headers=headers(cs))
    assert r.status_code == 400
    detail = r.json()["detail"]
    assert detail.startswith("Próximo atendimento disponível em")
    m = re.search(r"(\d+)h (\d+)m", detail)
    assert m, detail
    total_min = int(m.group(1)) * 60 + int(m.group(2))
    assert 118 <= total_min <= 122  # ~2h restantes, tolerância p/ drift de ms


def test_atendimento_feliz_grava_comissao_e_timer(client, db):
    cs = criar_usuario(db, "CS", level_cs=2, sufixo="cs")
    criar_cliente(db, "C1", cs_id=cs.id)
    r = client.post("/api/clientes/C1/atendimento", headers=headers(cs))
    assert r.status_code == 201, r.text
    assert r.json()["commission_value"] == 1.00  # get_price(2,"Atendimento")
    assert r.json()["contatos"] == 1
    assert r.json()["ultimo_contato"] is not None


# --------------------------------------------------------------------- desfazer

def test_desfazer_restaura_ultimo_contato_anterior(client, db):
    cs = criar_usuario(db, "CS", level_cs=2, sufixo="cs")
    t1 = (agora() - timedelta(days=6)).replace(microsecond=0)
    t2 = (agora() - timedelta(days=3)).replace(microsecond=0)
    c = criar_cliente(db, "C1", cs_id=cs.id, contatos=2, ultimo_contato=t2)
    db.add(models.Attendance(user_id=cs.id, customer_id="C1", timestamp=t1, commission_value=1.0))
    db.add(models.Attendance(user_id=cs.id, customer_id="C1", timestamp=t2, commission_value=1.0))
    db.commit()

    r = client.delete("/api/clientes/C1/atendimento", headers=headers(cs))
    assert r.status_code == 200
    db.refresh(c)
    assert c.contatos == 1
    assert c.ultimo_contato == t1  # restaurou para o anterior, NÃO null
    assert db.query(models.Attendance).filter_by(customer_id="C1").count() == 1


def test_desfazer_unico_atendimento_zera_timer(client, db):
    cs = criar_usuario(db, "CS", level_cs=2, sufixo="cs")
    t1 = (agora() - timedelta(days=1)).replace(microsecond=0)
    c = criar_cliente(db, "C1", cs_id=cs.id, contatos=1, ultimo_contato=t1)
    db.add(models.Attendance(user_id=cs.id, customer_id="C1", timestamp=t1, commission_value=1.0))
    db.commit()

    r = client.delete("/api/clientes/C1/atendimento", headers=headers(cs))
    assert r.status_code == 200
    db.refresh(c)
    assert c.contatos == 0
    assert c.ultimo_contato is None
    assert db.query(models.Attendance).filter_by(customer_id="C1").count() == 0


# --------------------------------------------------------------------- quitação

def test_quitar_valor_pago_maior_que_original_retorna_400(client, db):
    cs = criar_usuario(db, "CS", level_cs=2, sufixo="cs")
    criar_cliente(db, "C1", cs_id=cs.id)
    r = client.post(
        "/api/clientes/C1/quitar",
        json={"valor_original": 1000, "valor_pago": 1500},
        headers=headers(cs),
    )
    assert r.status_code == 400


def test_quitar_lanca_bonus_automatico_e_calcula_economia(client, db):
    cs = criar_usuario(db, "CS", level_cs=2, sufixo="cs")
    c = criar_cliente(db, "C1", cs_id=cs.id)
    r = client.post(
        "/api/clientes/C1/quitar",
        json={"valor_original": 10000, "valor_pago": 6000, "mes_referencia": "2026-06"},
        headers=headers(cs),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["economia"] == 4000
    assert body["percentual"] == 0.4
    assert body["status_cliente"] == "Quitado"

    bonus = db.query(models.BonusEntry).filter_by(customer_id="C1", tipo="Quitacao").all()
    assert len(bonus) == 1
    assert bonus[0].valor == 5.0  # get_price(2,"Quitacao")
    db.refresh(c)
    assert c.status == "Quitado"


# ------------------------------------------------------------------ reset mensal

def test_reset_zera_mas_preserva_lancamentos(client, db):
    gerente = criar_usuario(db, "Gerente", sufixo="ger")
    cs = criar_usuario(db, "CS", level_cs=2, sufixo="cs")
    ativo = criar_cliente(db, "C1", cs_id=cs.id, contatos=3, tentativas=2,
                          ultimo_contato=agora())
    quitado = criar_cliente(db, "C2", cs_id=cs.id, contatos=5, status="Quitado")
    db.add(models.Attendance(user_id=cs.id, customer_id="C1", timestamp=agora(), commission_value=1.0))
    db.add(models.BonusEntry(user_id=cs.id, customer_id="C1", tipo="Quitacao", valor=5.0, timestamp=agora()))
    db.commit()

    # CS não pode rodar reset (require_role).
    assert client.post("/api/clientes/reset-mensal", headers=headers(cs)).status_code == 403

    r = client.post("/api/clientes/reset-mensal", headers=headers(gerente))
    assert r.status_code == 200

    db.refresh(ativo)
    db.refresh(quitado)
    assert (ativo.contatos, ativo.tentativas, ativo.ultimo_contato) == (0, 0, None)
    assert quitado.contatos == 5  # quitado NÃO é tocado
    # Lançamentos preservados.
    assert db.query(models.Attendance).count() == 1
    assert db.query(models.BonusEntry).count() == 1
    # Registro de auditoria.
    ss = db.query(models.SystemSettings).filter_by(key="ultimo_reset").first()
    assert ss is not None
    assert json.loads(ss.value)["executado_por"] == gerente.id


# ------------------------------------------------------------------- importação

def test_importar_sem_coluna_cliente_retorna_422(client, db):
    cs = criar_usuario(db, "CS", level_cs=2, sufixo="cs")
    conteudo = planilha_bytes(
        ["Código DJ", "UF", "Tipo de contrato", "Processo?"],  # falta "Cliente"
        [["D1", "SP", "Veículo", "Não"]],
    )
    r = client.post(
        "/api/clientes/importar",
        files={"file": ("base.xlsx", conteudo, XLSX_MIME)},
        headers=headers(cs),
    )
    assert r.status_code == 422
    assert "Cliente" in r.json()["detail"]


def test_importar_grava_apenas_primeiro_nome(client, db):
    cs = criar_usuario(db, "CS", level_cs=2, sufixo="cs")
    conteudo = planilha_bytes(
        ["Código DJ", "Cliente", "UF", "Tipo de contrato", "Processo?"],
        [["D100", "João da Silva", "MG", "Empréstimo", "Sim"]],
    )
    r = client.post(
        "/api/clientes/importar",
        files={"file": ("base.xlsx", conteudo, XLSX_MIME)},
        headers=headers(cs),
    )
    assert r.status_code == 200, r.text
    cliente = db.get(models.Customer, "D100")
    assert cliente is not None
    assert cliente.first_name == "João"
    assert cliente.cs_id == cs.id


def test_importar_tolerante_a_acento_e_caixa(client, db):
    cs = criar_usuario(db, "CS", level_cs=2, sufixo="cs")
    conteudo = planilha_bytes(
        ["codigo dj", "CLIENTE", "uf", "tipo de contrato", "processo?"],  # caixa/acento variados
        [["D200", "Maria Souza", "RJ", "Veículo", "Não"]],
    )
    r = client.post(
        "/api/clientes/importar",
        files={"file": ("base.xlsx", conteudo, XLSX_MIME)},
        headers=headers(cs),
    )
    assert r.status_code == 200, r.text
    assert db.get(models.Customer, "D200").first_name == "Maria"
