"""Testes de bônus e comissões — Etapa 4."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import models
from database import get_db
from auth.deps import create_access_token
from routers.bonus import router as bonus_router
from routers.comissoes import router as comissoes_router

CORP = "@reisrevisional.com.br"


@pytest.fixture
def client(db):
    app = FastAPI()
    app.include_router(bonus_router)
    app.include_router(comissoes_router)

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


def criar_cliente(db, id_datajuri, cs_id, first_name="Ana"):
    c = models.Customer(
        id_datajuri=id_datajuri, first_name=first_name, cs_id=cs_id,
        status="Ativo", criticidade="Regular", tem_processo="Não",
        contatos=0, tentativas=0,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def lancar(client, user, customer_id, tipo, extra=None):
    body = {"customer_id": customer_id, "tipo": tipo}
    if extra:
        body.update(extra)
    return client.post("/api/bonus", json=body, headers=headers(user))


# ---------------------------------------------------------------- cálculo

def test_cs_nivel1_videodepoimento_vale_15(client, db):
    cs = criar_usuario(db, "CS", 1, "cs1")
    criar_cliente(db, "C1", cs.id)
    r = lancar(client, cs, "C1", "VideoDepoimento")
    assert r.status_code == 201, r.text
    assert r.json()["valor"] == 15.00


def test_cs_nivel3_videodepoimento_vale_20(client, db):
    cs = criar_usuario(db, "CS", 3, "cs3")
    criar_cliente(db, "C3", cs.id)
    r = lancar(client, cs, "C3", "VideoDepoimento")
    assert r.status_code == 201, r.text
    assert r.json()["valor"] == 20.00


def test_valor_enviado_pelo_cliente_e_ignorado(client, db):
    cs = criar_usuario(db, "CS", 1, "cs1")
    criar_cliente(db, "C1", cs.id)
    r = lancar(client, cs, "C1", "VideoDepoimento", extra={"valor": 999})
    assert r.status_code == 201
    assert r.json()["valor"] == 15.00  # da tabela, não 999
    assert db.query(models.BonusEntry).filter_by(customer_id="C1").first().valor == 15.00


def test_gestor_lanca_usa_nivel_do_dono(client, db):
    cs1 = criar_usuario(db, "CS", 1, "cs1")
    gerente = criar_usuario(db, "Gerente", None, "ger")
    criar_cliente(db, "C1", cs1.id)
    r = lancar(client, gerente, "C1", "VideoDepoimento")
    assert r.status_code == 201, r.text
    assert r.json()["valor"] == 15.00  # nível 1 do dono, não o papel do gestor
    bonus = db.query(models.BonusEntry).filter_by(customer_id="C1").first()
    assert bonus.user_id == cs1.id  # creditado ao CS dono


# ----------------------------------- override de CS pela gestão (Etapa 9)

def test_gestor_com_cs_id_credita_o_escolhido_com_nivel_dele(client, db):
    dono = criar_usuario(db, "CS", 1, "dono")      # dono do cliente, nível 1
    outro = criar_usuario(db, "CS", 3, "outro")    # CS escolhido, nível 3
    gerente = criar_usuario(db, "Gerente", None, "ger")
    criar_cliente(db, "C1", dono.id)

    r = lancar(client, gerente, "C1", "VideoDepoimento", extra={"cs_id": outro.id})
    assert r.status_code == 201, r.text
    assert r.json()["valor"] == 20.00  # nível 3 do CS escolhido, NÃO o nível 1 do dono
    bonus = db.query(models.BonusEntry).filter_by(customer_id="C1").first()
    assert bonus.user_id == outro.id   # creditado ao CS escolhido, não ao dono


def test_gestor_com_cs_id_inexistente_retorna_404(client, db):
    dono = criar_usuario(db, "CS", 1, "dono")
    gerente = criar_usuario(db, "Gerente", None, "ger")
    criar_cliente(db, "C1", dono.id)
    r = lancar(client, gerente, "C1", "VideoDepoimento", extra={"cs_id": 99999})
    assert r.status_code == 404


def test_gestor_com_cs_id_inativo_retorna_404(client, db):
    dono = criar_usuario(db, "CS", 1, "dono")
    inativo = criar_usuario(db, "CS", 2, "inativo")
    inativo.ativo = False
    db.commit()
    gerente = criar_usuario(db, "Gerente", None, "ger")
    criar_cliente(db, "C1", dono.id)
    r = lancar(client, gerente, "C1", "VideoDepoimento", extra={"cs_id": inativo.id})
    assert r.status_code == 404


def test_cs_nao_pode_redirecionar_bonus_via_cs_id(client, db):
    cs1 = criar_usuario(db, "CS", 1, "cs1")        # dono e chamador
    cs2 = criar_usuario(db, "CS", 3, "cs2")        # alvo tentado no body
    criar_cliente(db, "C1", cs1.id)

    # CS1 tenta creditar o CS2 — o cs_id do body é IGNORADO.
    r = lancar(client, cs1, "C1", "VideoDepoimento", extra={"cs_id": cs2.id})
    assert r.status_code == 201, r.text
    assert r.json()["valor"] == 15.00  # nível 1 do próprio cs1, não o 3 do cs2
    bonus = db.query(models.BonusEntry).filter_by(customer_id="C1").first()
    assert bonus.user_id == cs1.id     # creditado a si mesmo, nunca ao outro


# ---------------------------------------------------------------- validações

def test_tipo_inexistente_retorna_422(client, db):
    cs = criar_usuario(db, "CS", 1, "cs1")
    criar_cliente(db, "C1", cs.id)
    assert lancar(client, cs, "C1", "TipoQueNaoExiste").status_code == 422


def test_cs_nao_pode_lancar_quitacao_manual_422(client, db):
    # Quitação só nasce do fluxo de quitar() em Meus Clientes, nunca por POST manual.
    cs = criar_usuario(db, "CS", 1, "cs1")
    criar_cliente(db, "C1", cs.id)
    r = lancar(client, cs, "C1", "Quitacao")
    assert r.status_code == 422
    assert "Meus Clientes" in r.json()["detail"]
    assert db.query(models.BonusEntry).count() == 0  # nada foi criado


def test_gestao_nao_pode_lancar_quitacao_manual_422(client, db):
    cs = criar_usuario(db, "CS", 1, "cs1")
    gerente = criar_usuario(db, "Gerente", None, "ger")
    criar_cliente(db, "C1", cs.id)
    # sem cs_id
    assert lancar(client, gerente, "C1", "Quitacao").status_code == 422
    # com cs_id (override) — também bloqueado
    assert lancar(client, gerente, "C1", "Quitacao", extra={"cs_id": cs.id}).status_code == 422
    assert db.query(models.BonusEntry).count() == 0


def test_customer_inexistente_retorna_404(client, db):
    cs = criar_usuario(db, "CS", 1, "cs1")
    assert lancar(client, cs, "NAO_EXISTE", "VideoDepoimento").status_code == 404


def test_cs_lanca_em_cliente_alheio_retorna_403(client, db):
    cs1 = criar_usuario(db, "CS", 1, "cs1")
    cs2 = criar_usuario(db, "CS", 2, "cs2")
    criar_cliente(db, "C1", cs1.id)
    assert lancar(client, cs2, "C1", "VideoDepoimento").status_code == 403


# ---------------------------------------------------------------- tabela

def test_cs_nao_pode_alterar_tabela_403(client, db):
    cs = criar_usuario(db, "CS", 1, "cs1")
    r = client.put(
        "/api/comissoes/tabela",
        json=[{"acao": "VideoDepoimento", "valor_nivel_1_2": 15, "valor_nivel_3_5": 25}],
        headers=headers(cs),
    )
    assert r.status_code == 403


def test_get_tabela_qualquer_autenticado(client, db):
    cs = criar_usuario(db, "CS", 1, "cs1")
    r = client.get("/api/comissoes/tabela", headers=headers(cs))
    assert r.status_code == 200
    assert len(r.json()) == 6
    assert "VideoDepoimento" in {x["acao"] for x in r.json()}


def test_mudanca_na_tabela_nao_afeta_lancamentos_passados(client, db):
    cs = criar_usuario(db, "CS", 3, "cs3")
    gerente = criar_usuario(db, "Gerente", None, "ger")
    criar_cliente(db, "C3", cs.id)

    # Lançamento ANTES da mudança → 20.00
    r1 = lancar(client, cs, "C3", "VideoDepoimento")
    assert r1.json()["valor"] == 20.00
    id_antigo = r1.json()["id"]

    # Gerente sobe o nível 3-5 para 25.00
    rp = client.put(
        "/api/comissoes/tabela",
        json=[{"acao": "VideoDepoimento", "valor_nivel_1_2": 15, "valor_nivel_3_5": 25}],
        headers=headers(gerente),
    )
    assert rp.status_code == 200

    # Lançamento DEPOIS → 25.00
    r2 = lancar(client, cs, "C3", "VideoDepoimento")
    assert r2.json()["valor"] == 25.00

    # O lançamento antigo permanece congelado em 20.00
    assert db.get(models.BonusEntry, id_antigo).valor == 20.00


# ---------------------------------------------------------------- extrato

def test_extrato_cs_ve_so_os_seus(client, db):
    cs1 = criar_usuario(db, "CS", 1, "cs1")
    cs2 = criar_usuario(db, "CS", 2, "cs2")
    criar_cliente(db, "C1", cs1.id, first_name="Ana")
    criar_cliente(db, "C2", cs2.id, first_name="Bia")
    lancar(client, cs1, "C1", "VideoDepoimento")
    lancar(client, cs2, "C2", "VideoDepoimento")

    r = client.get("/api/bonus/extrato", headers=headers(cs1))
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["cs"] == "cs1"
    assert r.json()[0]["cliente"] == "Ana"
    assert r.json()[0]["tipo"] == "VideoDepoimento"
