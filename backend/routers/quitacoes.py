"""Listagem de quitações — Etapa 9 (read-only).

A criação de quitação continua em POST /api/clientes/{id}/quitar (Etapa 3). Aqui
só expomos a LEITURA, para a tela "Quitações" do frontend não depender de mocks.

`economia` e `percentual` são CALCULADOS na resposta — nunca armazenados
(coerente com o ADR-3). Escopo por papel: CS vê só as suas; gestão vê todas.
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import models
from database import get_db
from auth.deps import get_current_user

router = APIRouter(prefix="/api/quitacoes", tags=["quitacoes"])


def _validar_mes(mes: str):
    try:
        ano_s, mes_s = mes.split("-")
        ano, m = int(ano_s), int(mes_s)
        if not 1 <= m <= 12:
            raise ValueError
    except (ValueError, AttributeError):
        raise HTTPException(422, "Parâmetro 'mes' deve estar no formato AAAA-MM.")
    return f"{ano:04d}-{m:02d}"


@router.get("")
def listar_quitacoes(
    cs_id: Optional[int] = None,
    mes: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    # protesto / tarifas_restituiveis / consulta_processo são atributos do CLIENTE
    # (editáveis na tela Quitações) — vêm do Customer via join, não da quitação.
    q = (
        db.query(models.Quitacao, models.User.nome_exibicao, models.Customer)
        .join(models.User, models.User.id == models.Quitacao.cs_id)
        .outerjoin(models.Customer, models.Customer.id_datajuri == models.Quitacao.customer_id)
    )

    if user.role == "CS":
        if cs_id is not None and cs_id != user.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Você só pode ver as suas quitações.")
        q = q.filter(models.Quitacao.cs_id == user.id)
    elif cs_id is not None:
        q = q.filter(models.Quitacao.cs_id == cs_id)

    if mes:
        q = q.filter(models.Quitacao.mes_referencia == _validar_mes(mes))

    q = q.order_by(models.Quitacao.id.desc())

    saida = []
    for quitacao, nome_cs, customer in q.all():
        economia = quitacao.valor_original - quitacao.valor_pago
        percentual = round(economia / quitacao.valor_original * 100, 1) if quitacao.valor_original else 0.0
        saida.append({
            "id": quitacao.id,
            "customer_id": quitacao.customer_id,
            "cliente": customer.first_name if customer else None,
            "cs": nome_cs,
            "valor_original": quitacao.valor_original,
            "valor_pago": quitacao.valor_pago,
            "economia": economia,
            "percentual": percentual,
            "data_boleto": quitacao.data_boleto,
            "data_pagamento": quitacao.data_pagamento,
            "pagamento": quitacao.pagamento,
            "mes_referencia": quitacao.mes_referencia,
            # Status jurídico do CLIENTE (Customer), editável inline na tela:
            "protesto": customer.protesto if customer else "Não possui",
            "tarifas_restituiveis": customer.tarifas_restituiveis if customer else False,
            "consulta_processo": customer.consulta_processo if customer else False,
        })
    return saida
