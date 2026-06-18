"""Rotas da Equipe — Etapa 6 (apenas gestão)."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from database import get_db
from auth.deps import require_role
from services import dashboard as svc

router = APIRouter(prefix="/api/equipe", tags=["equipe"])


class NivelUpdate(BaseModel):
    level_cs: int


@router.get("")
def listar_equipe(
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("Gerente", "Supervisor")),
):
    return svc.equipe_rows(db)


@router.put("/{user_id}/nivel")
def mudar_nivel(
    user_id: int,
    payload: NivelUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("Gerente")),  # CS/Supervisor → 403
):
    if not 1 <= payload.level_cs <= 5:
        raise HTTPException(422, "level_cs deve estar entre 1 e 5.")
    alvo = db.get(models.User, user_id)
    if alvo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuário não encontrado.")
    if alvo.role != "CS":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Só é possível alterar o nível de um CS.")
    # Afeta apenas lançamentos FUTUROS — os passados estão congelados.
    alvo.level_cs = payload.level_cs
    db.commit()
    db.refresh(alvo)
    return {"id": alvo.id, "nome": alvo.nome_exibicao, "level_cs": alvo.level_cs}


@router.delete("/{user_id}")
def desativar(
    user_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("Gerente")),
):
    alvo = db.get(models.User, user_id)
    if alvo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuário não encontrado.")
    if alvo.role == "Gerente":
        if alvo.id == user.id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "O Gerente não pode desativar a si mesmo.")
        ativos_ger = (
            db.query(models.User)
            .filter(models.User.role == "Gerente", models.User.ativo.is_(True))
            .count()
        )
        if ativos_ger <= 1:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Não é possível desativar o último Gerente ativo.")
    # "Excluir" = desativar (NÃO apaga). O histórico financeiro permanece.
    alvo.ativo = False
    db.commit()
    return {"message": "Usuário desativado.", "id": alvo.id, "ativo": alvo.ativo}
