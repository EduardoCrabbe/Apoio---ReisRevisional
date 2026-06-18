"""Rotas da tabela de comissões — Etapa 4.

GET /api/comissoes/tabela  — qualquer autenticado (frontend usa para exibir
                             valores nos botões, sem hardcode).
PUT /api/comissoes/tabela  — só Gerente; atualiza valores existentes.

Mudar a tabela NÃO altera lançamentos passados: os valores ficam congelados em
`bonus_entries.valor` e `attendances.commission_value`.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

import models
from database import get_db
from auth.deps import get_current_user, require_role

router = APIRouter(prefix="/api/comissoes", tags=["comissoes"])


class ComissaoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    acao: str
    valor_nivel_1_2: float
    valor_nivel_3_5: float


class ComissaoUpdate(BaseModel):
    acao: str
    valor_nivel_1_2: float
    valor_nivel_3_5: float


def _tabela_ordenada(db: Session):
    return db.query(models.CommissionTable).order_by(models.CommissionTable.id).all()


@router.get("/tabela", response_model=list[ComissaoOut])
def obter_tabela(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    return _tabela_ordenada(db)


@router.put("/tabela", response_model=list[ComissaoOut])
def atualizar_tabela(
    itens: list[ComissaoUpdate],
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("Gerente")),
):
    for item in itens:
        regra = db.query(models.CommissionTable).filter_by(acao=item.acao).first()
        if regra is None:
            continue  # não cria ações novas (nem apaga as existentes)
        regra.valor_nivel_1_2 = item.valor_nivel_1_2
        regra.valor_nivel_3_5 = item.valor_nivel_3_5
    db.commit()
    return _tabela_ordenada(db)
