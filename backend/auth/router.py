"""Rotas de autenticação — Etapa 2.

POST /api/auth/register · POST /api/auth/login · GET /api/auth/me
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import models
from database import get_db
from auth import deps
from auth.schemas import TokenResponse, UserLogin, UserPublic, UserRegister

router = APIRouter(prefix="/api/auth", tags=["auth"])

DOMINIO_CORPORATIVO = "@reisrevisional.com.br"
LIMITES_POR_PAPEL = {"Gerente": 1, "Supervisor": 1, "CS": 12}
MSG_LOGIN_INVALIDO = "E-mail ou senha incorretos"


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if not email.endswith(DOMINIO_CORPORATIVO):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Acesso negado: somente e-mails {DOMINIO_CORPORATIVO}.",
        )
    if len(payload.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A senha deve ter no mínimo 8 caracteres.",
        )
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="E-mail já cadastrado.")

    # O 1º usuário do sistema vira Gerente, independentemente do papel pedido.
    if db.query(models.User).count() == 0:
        role = "Gerente"
    else:
        role = payload.role
        if role not in LIMITES_POR_PAPEL:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Papel inválido. Use Gerente, Supervisor ou CS.",
            )
        ativos = (
            db.query(models.User)
            .filter(models.User.role == role, models.User.ativo.is_(True))
            .count()
        )
        if ativos >= LIMITES_POR_PAPEL[role]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Limite de {LIMITES_POR_PAPEL[role]} {role} atingido.",
            )

    user = models.User(
        email=email,
        password_hash=deps.hash_password(payload.password),
        role=role,
        level_cs=1 if role == "CS" else None,
        nome_exibicao=payload.nome_exibicao or email.split("@")[0],
        ativo=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(models.User).filter(models.User.email == email).first()
    # Mensagem SEMPRE genérica — não revela se o e-mail existe.
    if user is None or not user.ativo or not deps.verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=MSG_LOGIN_INVALIDO)
    token = deps.create_access_token(user.id, user.role, user.level_cs)
    return TokenResponse(access_token=token, user=UserPublic.model_validate(user))


@router.get("/me", response_model=UserPublic)
def me(current: models.User = Depends(deps.get_current_user)):
    return current
