"""Rotas de IA (Gemini) e configuração do prompt — Etapa 7.

POST /api/ai/summarize        — resume áudio/vídeo (autenticado).
GET  /api/settings/ai-prompt  — lê o prompt atual (autenticado).
PUT  /api/settings/ai-prompt  — atualiza o prompt (só Gerente).
"""

import os
import tempfile
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from database import get_db
from auth.deps import get_current_user, require_role
from services import gemini

router = APIRouter(tags=["ia"])

EXTENSOES_PERMITIDAS = {"mp3", "wav", "mp4", "m4a", "ogg"}
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50MB


class PromptIn(BaseModel):
    ai_prompt: str


@router.post("/api/ai/summarize")
async def summarize(
    file: UploadFile = File(...),
    bonus_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    ext = os.path.splitext(file.filename or "")[1].lower().lstrip(".")
    if ext not in EXTENSOES_PERMITIDAS:
        raise HTTPException(422, f"Extensão não suportada. Use: {sorted(EXTENSOES_PERMITIDAS)}.")

    conteudo = await file.read()
    if len(conteudo) > MAX_UPLOAD_BYTES:
        raise HTTPException(422, "Arquivo excede o limite de 50MB.")

    # Valida o bônus (se veio) ANTES da chamada cara à IA.
    bonus = None
    if bonus_id is not None:
        bonus = db.get(models.BonusEntry, bonus_id)
        if bonus is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Bônus não encontrado.")
        if user.role == "CS" and bonus.user_id != user.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Este bônus não pertence a você.")

    prompt = gemini.get_ai_prompt(db)

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}")
    tmp.write(conteudo)
    tmp.close()
    caminho = tmp.name
    try:
        try:
            resumo = gemini.gerar_resumo(caminho, prompt)
        except HTTPException:
            raise
        except Exception:
            # Falha da IA NUNCA vira 200 com erro no corpo.
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY,
                "Não foi possível gerar o resumo com a IA no momento. Tente novamente.",
            )

        if bonus is not None:
            bonus.ai_summary = resumo
            db.commit()

        return {"summary": resumo}
    finally:
        # Limpeza garantida do temporário local, haja o que houver.
        if os.path.exists(caminho):
            os.remove(caminho)


@router.get("/api/settings/ai-prompt")
def obter_prompt(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    return {"ai_prompt": gemini.get_ai_prompt(db)}


@router.put("/api/settings/ai-prompt")
def atualizar_prompt(
    payload: PromptIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_role("Gerente")),  # CS/Supervisor → 403
):
    return {"ai_prompt": gemini.set_ai_prompt(db, payload.ai_prompt)}
