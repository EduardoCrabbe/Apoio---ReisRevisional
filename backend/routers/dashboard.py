"""Rotas do Dashboard — Etapa 6."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import models
from database import get_db
from auth.deps import get_current_user
from services import dashboard as svc

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
def stats(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    return svc.dashboard_stats(db, user)
