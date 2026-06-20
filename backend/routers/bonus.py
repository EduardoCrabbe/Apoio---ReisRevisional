"""Rotas de bônus (ganhos extras) — Etapa 4.

POST /api/bonus            — lança um bônus (valor calculado no servidor).
GET  /api/bonus/extrato    — extrato de ganhos extras, com filtros.

O valor NUNCA vem do cliente: é calculado por get_price(nível do CS dono, tipo)
e gravado congelado. Qualquer campo "valor" no body é silenciosamente ignorado.
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

import models
from database import get_db
from auth.deps import get_current_user
from services.comissao import get_price
from services.clientes import buscar_cliente, exigir_pode_editar

router = APIRouter(prefix="/api/bonus", tags=["bonus"])


class BonusIn(BaseModel):
    # Sem campo "valor" de propósito: Pydantic ignora extras → cliente não
    # consegue influenciar o valor (e nem recebe erro por tentar).
    customer_id: str
    tipo: str
    cs_id: Optional[int] = None  # override de CS — só a gestão pode usar (ver abaixo)


class BonusOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tipo: str
    valor: float
    customer_id: Optional[str] = None
    timestamp: datetime


def _intervalo_mes(mes: str):
    """'AAAA-MM' -> (inicio_inclusive, fim_exclusivo) como datetimes."""
    try:
        ano_s, mes_s = mes.split("-")
        ano, m = int(ano_s), int(mes_s)
        if not 1 <= m <= 12:
            raise ValueError
    except (ValueError, AttributeError):
        raise HTTPException(422, "Parâmetro 'mes' deve estar no formato AAAA-MM.")
    inicio = datetime(ano, m, 1)
    fim = datetime(ano + 1, 1, 1) if m == 12 else datetime(ano, m + 1, 1)
    return inicio, fim


@router.post("", response_model=BonusOut, status_code=status.HTTP_201_CREATED)
def lancar_bonus(
    payload: BonusIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    cliente = buscar_cliente(db, payload.customer_id)       # 404 se não existe
    exigir_pode_editar(cliente, user)                       # CS só nos seus; gestão qualquer

    if db.query(models.CommissionTable).filter_by(acao=payload.tipo).first() is None:
        raise HTTPException(422, f"Tipo de bônus inexistente: {payload.tipo!r}.")

    # Quem RECEBE o crédito (e cujo nível define o valor):
    if user.role == "CS":
        # CS comum NUNCA redireciona bônus: cs_id do body é ignorado, força a si
        # mesmo (e já passou pelo 403 de cliente alheio em exigir_pode_editar).
        alvo = user
    elif payload.cs_id is not None:
        # Override da gestão: credita o CS escolhido (não precisa ser o dono),
        # usando o NÍVEL DELE. Precisa existir e estar ativo.
        alvo = db.get(models.User, payload.cs_id)
        if alvo is None or not alvo.ativo or alvo.role != "CS":
            raise HTTPException(404, "CS informado não existe ou está inativo.")
    else:
        # Gestão sem override: comportamento da Etapa 4 — o CS DONO do cliente.
        alvo = db.get(models.User, cliente.cs_id) if cliente.cs_id is not None else None

    if alvo is None or alvo.level_cs is None:
        raise HTTPException(400, "Cliente sem CS dono com nível definido para calcular o bônus.")

    valor = get_price(alvo.level_cs, payload.tipo, db)       # valor SEMPRE do servidor
    bonus = models.BonusEntry(
        user_id=alvo.id,
        customer_id=cliente.id_datajuri,
        tipo=payload.tipo,
        valor=valor,                # CONGELADO no lançamento
        # timestamp: default _utcnow do modelo
    )
    db.add(bonus)
    db.commit()
    db.refresh(bonus)
    return bonus


@router.get("/extrato")
def extrato(
    cs_id: Optional[int] = None,
    mes: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    q = (
        db.query(models.BonusEntry, models.User.nome_exibicao, models.Customer.first_name)
        .join(models.User, models.User.id == models.BonusEntry.user_id)
        .outerjoin(models.Customer, models.Customer.id_datajuri == models.BonusEntry.customer_id)
    )

    if user.role == "CS":
        if cs_id is not None and cs_id != user.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Você só pode ver o seu extrato.")
        q = q.filter(models.BonusEntry.user_id == user.id)
    elif cs_id is not None:
        q = q.filter(models.BonusEntry.user_id == cs_id)

    if mes:
        inicio, fim = _intervalo_mes(mes)
        q = q.filter(models.BonusEntry.timestamp >= inicio, models.BonusEntry.timestamp < fim)

    q = q.order_by(models.BonusEntry.timestamp.desc())
    return [
        {
            "data": bonus.timestamp,
            "cs": nome_exibicao,
            "cliente": first_name,
            "tipo": bonus.tipo,
            "valor": bonus.valor,
        }
        for bonus, nome_exibicao, first_name in q.all()
    ]
