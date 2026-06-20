"""Rotas do Agente Eproc (lado servidor) — Etapa 8.

O servidor NÃO faz scraping — apenas recebe resultados já triados do agente.
`POST /resultado` é autenticado SÓ pelo header X-Robo-Token (nunca por JWT de
pessoa) e REJEITA qualquer payload com CPF. As demais rotas são por pessoa, com
escopo de papel. Nenhuma rota retorna CPF (ele nunca chega ao servidor).
"""

import os
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

import models
from database import get_db
from auth.deps import get_current_user, require_role

router = APIRouter(prefix="/api/robo", tags=["robo"])

ALERTA_VERMELHO = "🚨 ALERTA VERMELHO"
REGISTRO_NORMAL = "REGISTRO NORMAL"


def verificar_robo_token(x_robo_token: Optional[str] = Header(None)):
    """Autentica o AGENTE (máquina), não uma pessoa. Compara com ROBO_TOKEN do .env."""
    esperado = os.getenv("ROBO_TOKEN")
    if not esperado or x_robo_token != esperado:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token do robô inválido ou ausente.")


class ResultadoIn(BaseModel):
    # extra="forbid": qualquer campo a mais (cpf, processo, nome...) → 422.
    model_config = ConfigDict(extra="forbid")

    id_datajuri: str
    classe: Optional[str] = None
    data_movimentacao: Optional[str] = None
    descricao: Optional[str] = None
    triagem: str


class SolicitarIn(BaseModel):
    customer_ids: List[str]


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _inicio_do_dia():
    a = _utcnow()
    return datetime(a.year, a.month, a.day)


def _criar_tarefa_robo(db: Session, customer: models.Customer, classificacao: str, detalhes: str) -> None:
    """Cria tarefa do robô pro CS dono, sem duplicar uma tarefa ABERTA de MESMA
    classificação para o mesmo cliente (dedup por cliente + classificação + origem
    'sistema'). Assim ALERTA (CRÍTICA/URGENTE) e REGISTRO NORMAL (REGULAR) são
    independentes: uma tarefa REGULAR aberta não impede a criação de um alerta."""
    if customer.cs_id is None:
        return  # sem dono, não há a quem atribuir
    ja_aberta = (
        db.query(models.Tarefa)
        .filter(
            models.Tarefa.origem == "sistema",
            models.Tarefa.concluida.is_(False),
            models.Tarefa.cliente_id == customer.id_datajuri,
            models.Tarefa.classificacao == classificacao,
        )
        .first()
    )
    if ja_aberta is not None:
        return
    db.add(models.Tarefa(
        criador_id=customer.cs_id,
        responsavel_id=customer.cs_id,
        cliente_id=customer.id_datajuri,
        setor="Atendimento",
        classificacao=classificacao,
        origem="sistema",
        prazo=_utcnow().date(),
        detalhes=detalhes,
        concluida=False,
    ))


@router.post("/resultado", status_code=status.HTTP_201_CREATED)
def receber_resultado(
    payload: ResultadoIn,
    db: Session = Depends(get_db),
    _=Depends(verificar_robo_token),
):
    customer = db.get(models.Customer, payload.id_datajuri)
    if customer is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cliente (id_datajuri) não encontrado.")

    # Grava o resultado (sem CPF/processo/nome — só o que chega no payload seguro).
    resultado = models.RoboResultado(
        customer_id=customer.id_datajuri,
        classe=payload.classe,
        data_movimentacao=payload.data_movimentacao,
        descricao=payload.descricao,
        triagem=payload.triagem,
    )
    db.add(resultado)

    if payload.triagem == ALERTA_VERMELHO:
        _criar_tarefa_robo(
            db, customer, "CRÍTICA/URGENTE",
            f"🚨 ALERTA VERMELHO no Eproc — cliente {customer.first_name}. Verificar movimentação urgente.",
        )
    elif payload.triagem == REGISTRO_NORMAL:
        # Classe permitida sem alerta: tarefa de acompanhamento de rotina.
        _criar_tarefa_robo(
            db, customer, "REGULAR",
            f"Movimentação no Eproc (registro normal) — cliente {customer.first_name}. Revisar andamento do processo.",
        )

    db.commit()
    db.refresh(resultado)
    return {"id": resultado.id, "customer_id": resultado.customer_id, "triagem": resultado.triagem}


def _resultados_no_escopo(db: Session, user: models.User):
    q = (
        db.query(models.RoboResultado, models.Customer.first_name)
        .join(models.Customer, models.Customer.id_datajuri == models.RoboResultado.customer_id)
    )
    if user.role == "CS":
        q = q.filter(models.Customer.cs_id == user.id)
    return q.order_by(models.RoboResultado.recebido_em.desc())


def _serializar(resultado: models.RoboResultado, first_name):
    # NUNCA inclui CPF (ele nem existe no servidor).
    return {
        "id": resultado.id,
        "customer_id": resultado.customer_id,
        "nome": first_name,
        "classe": resultado.classe,
        "data_movimentacao": resultado.data_movimentacao,
        "descricao": resultado.descricao,
        "triagem": resultado.triagem,
        "recebido_em": resultado.recebido_em,
    }


@router.get("/resultados")
def listar_resultados(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    return [_serializar(r, nome) for r, nome in _resultados_no_escopo(db, user).all()]


@router.get("/alertas")
def listar_alertas(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    q = _resultados_no_escopo(db, user).filter(models.RoboResultado.triagem == ALERTA_VERMELHO)
    return [_serializar(r, nome) for r, nome in q.all()]


@router.post("/encerrar-dia")
def encerrar_dia(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Apaga os robo_resultados do dia (escopo do papel). NÃO toca em
    attendances/bonus/quitacoes."""
    q = (
        db.query(models.RoboResultado)
        .join(models.Customer, models.Customer.id_datajuri == models.RoboResultado.customer_id)
        .filter(models.RoboResultado.recebido_em >= _inicio_do_dia())
    )
    if user.role == "CS":
        q = q.filter(models.Customer.cs_id == user.id)
    linhas = q.all()
    for r in linhas:
        db.delete(r)
    db.commit()
    return {"message": "Resultados do dia apagados.", "removidos": len(linhas)}


# ----------------------------------------------------- SECUNDÁRIO (opcional)
# Modo "gestão solicita varredura": a gestão marca clientes (jobs pendentes) e o
# agente lê a fila com o X-Robo-Token. O modo PRINCIPAL é o CS importando a
# planilha localmente — estas rotas são um extra.

@router.post("/solicitar")
def solicitar_varredura(
    payload: SolicitarIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("Gerente", "Supervisor")),
):
    criados = 0
    for cid in payload.customer_ids:
        if db.get(models.Customer, cid) is None:
            continue
        db.add(models.RoboJob(customer_id=cid, status="pendente"))
        criados += 1
    db.commit()
    return {"solicitados": criados}


@router.get("/fila")
def fila(
    db: Session = Depends(get_db),
    _=Depends(verificar_robo_token),
):
    pendentes = db.query(models.RoboJob).filter(models.RoboJob.status == "pendente").all()
    return [{"id": j.id, "customer_id": j.customer_id} for j in pendentes]
