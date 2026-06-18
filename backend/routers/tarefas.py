"""Rotas do módulo de Tarefas — Etapa 5.

Todas exigem autenticação. A lógica fica em services/tarefas.py.
"""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

import models
from database import get_db
from auth.deps import get_current_user
from services import tarefas as svc

router = APIRouter(prefix="/api/tarefas", tags=["tarefas"])


class TarefaCreate(BaseModel):
    setor: str
    classificacao: str
    prazo: Optional[date] = None
    detalhes: Optional[str] = None
    responsavel_id: Optional[int] = None


class TarefaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    criador_id: int
    responsavel_id: int
    cliente_id: Optional[str] = None
    setor: str
    classificacao: str
    origem: str
    prazo: Optional[date] = None
    detalhes: Optional[str] = None
    concluida: bool
    mes_anterior: bool = False


def _montar(tarefa: models.Tarefa) -> TarefaOut:
    out = TarefaOut.model_validate(tarefa)
    out.mes_anterior = svc.calc_mes_anterior(tarefa)
    return out


@router.post("", response_model=TarefaOut, status_code=status.HTTP_201_CREATED)
def criar(
    payload: TarefaCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    return _montar(svc.criar_tarefa(db, user, payload))


@router.get("", response_model=list[TarefaOut])
def listar(
    responsavel_id: Optional[int] = None,
    concluida: bool = False,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    return [_montar(t) for t in svc.listar_tarefas(db, user, responsavel_id, concluida)]


@router.post("/{tarefa_id}/adiar", response_model=TarefaOut)
def adiar(
    tarefa_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    tarefa = svc.buscar_tarefa(db, tarefa_id)
    return _montar(svc.adiar_tarefa(db, tarefa, user))


@router.post("/{tarefa_id}/concluir", response_model=TarefaOut)
def concluir(
    tarefa_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    tarefa = svc.buscar_tarefa(db, tarefa_id)
    return _montar(svc.concluir_tarefa(db, tarefa, user))


@router.delete("/{tarefa_id}")
def deletar(
    tarefa_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    tarefa = svc.buscar_tarefa(db, tarefa_id)
    svc.deletar_tarefa(db, tarefa, user)
    return {"message": "Tarefa removida."}
