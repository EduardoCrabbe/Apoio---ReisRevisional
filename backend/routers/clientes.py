"""Rotas do CRM de clientes — Etapa 3.

Todas exigem autenticação (get_current_user). A lógica fica em
services/clientes.py; aqui só fazemos a tradução HTTP e a validação de papel.
"""

from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

import models
from database import get_db
from auth.deps import get_current_user, require_role
from services import clientes as svc

router = APIRouter(prefix="/api/clientes", tags=["clientes"])


# --------------------------------------------------------------------- schemas

class ClienteCreate(BaseModel):
    id_datajuri: str
    first_name: str
    uf: Optional[str] = None
    contrato: Optional[str] = None
    tem_processo: str = "Não"
    criticidade: str = "Regular"
    cs_id: Optional[int] = None  # obrigatório só para gestão


class ClienteUpdate(BaseModel):
    criticidade: Optional[str] = None
    tem_processo: Optional[str] = None
    contrato: Optional[str] = None


class ClienteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_datajuri: str
    first_name: Optional[str] = None
    uf: Optional[str] = None
    contrato: Optional[str] = None
    tem_processo: str
    criticidade: str
    status: str
    cs_id: Optional[int] = None
    contatos: int
    tentativas: int
    ultimo_contato: Optional[datetime] = None


class QuitarIn(BaseModel):
    valor_original: float
    valor_pago: float
    data_boleto: Optional[date] = None
    data_pagamento: Optional[date] = None
    consulta_processo: str = "Ativa"
    protesto: bool = False
    tarifas_restituiveis: bool = False
    mes_referencia: Optional[str] = None


class QuitarOut(BaseModel):
    id: int
    customer_id: str
    valor_original: float
    valor_pago: float
    economia: float
    percentual: float
    status_cliente: str


# ----------------------------------------------------------------- CRUD básico

@router.get("", response_model=list[ClienteOut])
def listar(
    cs_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    return svc.listar_clientes(db, user, cs_id)


@router.post("", response_model=ClienteOut, status_code=status.HTTP_201_CREATED)
def criar(
    payload: ClienteCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    return svc.criar_cliente(db, user, payload)


@router.post("/importar")
async def importar(
    file: UploadFile = File(...),
    cs_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    alvo_cs = svc.resolver_cs_id(user, cs_id)
    conteudo = await file.read()
    n = svc.importar_clientes(db, conteudo, alvo_cs)
    return {"message": f"{n} cliente(s) importado(s).", "importados": n}


@router.post("/reset-mensal")
def reset_mensal(
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("Gerente", "Supervisor")),
):
    n = svc.reset_mensal(db, user)
    return {"message": f"Reset mensal executado: {n} cliente(s) ativo(s) zerado(s).", "clientes_afetados": n}


@router.put("/{customer_id}", response_model=ClienteOut)
def atualizar(
    customer_id: str,
    payload: ClienteUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    cliente = svc.buscar_cliente(db, customer_id)
    svc.exigir_pode_editar(cliente, user)
    if payload.criticidade is not None:
        cliente.criticidade = payload.criticidade
    if payload.tem_processo is not None:
        cliente.tem_processo = payload.tem_processo
    if payload.contrato is not None:
        cliente.contrato = payload.contrato
    db.commit()
    db.refresh(cliente)
    return cliente


@router.delete("/{customer_id}")
def remover(
    customer_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    cliente = svc.buscar_cliente(db, customer_id)
    svc.exigir_pode_editar(cliente, user)
    db.delete(cliente)
    db.commit()
    return {"message": "Cliente removido."}


# ----------------------------------------------------------- ações do CS dono

@router.post("/{customer_id}/atendimento", status_code=status.HTTP_201_CREATED)
def atender(
    customer_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    cliente = svc.buscar_cliente(db, customer_id)
    svc.exigir_dono(cliente, user)
    svc.checar_atendimento_permitido(cliente)
    att = svc.registrar_atendimento(db, cliente, user)
    return {
        "message": "Atendimento registrado.",
        "attendance_id": att.id,
        "commission_value": att.commission_value,
        "contatos": cliente.contatos,
        "ultimo_contato": cliente.ultimo_contato,
    }


@router.delete("/{customer_id}/atendimento")
def desfazer_atendimento(
    customer_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    cliente = svc.buscar_cliente(db, customer_id)
    svc.exigir_dono(cliente, user)
    svc.desfazer_atendimento(db, cliente, user)
    return {
        "message": "Atendimento desfeito.",
        "contatos": cliente.contatos,
        "ultimo_contato": cliente.ultimo_contato,
    }


@router.post("/{customer_id}/tentativa")
def tentativa(
    customer_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    cliente = svc.buscar_cliente(db, customer_id)
    svc.exigir_dono(cliente, user)
    cliente.tentativas = (cliente.tentativas or 0) + 1  # sem comissão, sem mexer no timer
    db.commit()
    db.refresh(cliente)
    return {"message": "Tentativa registrada.", "tentativas": cliente.tentativas}


@router.post("/{customer_id}/quitar", response_model=QuitarOut)
def quitar(
    customer_id: str,
    payload: QuitarIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    cliente = svc.buscar_cliente(db, customer_id)
    svc.exigir_dono(cliente, user)
    quitacao, economia, percentual = svc.quitar(db, cliente, user, payload)
    return QuitarOut(
        id=quitacao.id,
        customer_id=quitacao.customer_id,
        valor_original=quitacao.valor_original,
        valor_pago=quitacao.valor_pago,
        economia=economia,
        percentual=percentual,
        status_cliente=cliente.status,
    )
