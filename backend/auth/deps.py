"""Dependências e utilitários de autenticação — Etapa 2.

- Hash/verificação de senha com bcrypt (nunca texto puro).
- Emissão/validação de JWT de 12h (python-jose) com sub/role/level_cs.
- `get_current_user` (401) e `require_role(...)` (403) para proteger rotas.

`SECRET_KEY` vem do `.env`. Se ausente, `get_secret_key()` levanta RuntimeError
com mensagem clara — a autenticação não opera sem ela (cumpre a regra de "não
iniciar sem SECRET_KEY").
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

import models
from database import get_db

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 12

# auto_error=False: token ausente devolve None -> tratamos como 401 (e não 403).
_bearer = HTTPBearer(auto_error=False)


def get_secret_key() -> str:
    key = os.getenv("SECRET_KEY")
    if not key:
        raise RuntimeError(
            "SECRET_KEY não definida no ambiente (.env). A aplicação não pode "
            "operar a autenticação sem ela."
        )
    return key


def _pw_bytes(password: str) -> bytes:
    # bcrypt opera sobre no máximo 72 bytes e LEVANTA erro acima disso (bcrypt 5).
    # Truncamos de forma consistente entre hash e verify para senhas longas.
    return password.encode("utf-8")[:72]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_pw_bytes(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_pw_bytes(password), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: int, role: str, level_cs: Optional[int]) -> str:
    expira = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {"sub": str(user_id), "role": role, "level_cs": level_cs, "exp": expira}
    return jwt.encode(payload, get_secret_key(), algorithm=ALGORITHM)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> models.User:
    nao_autenticado = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não autenticado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None or not credentials.credentials:
        raise nao_autenticado
    try:
        payload = jwt.decode(credentials.credentials, get_secret_key(), algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            raise nao_autenticado
    except JWTError:
        raise nao_autenticado

    user = db.query(models.User).filter(models.User.id == int(sub)).first()
    if user is None or not user.ativo:
        raise nao_autenticado
    return user


def require_role(*roles: str):
    """Dependência-fábrica: garante que o usuário logado tem um dos papéis dados."""

    def checker(user: models.User = Depends(get_current_user)) -> models.User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso negado: você não tem permissão para esta ação.",
            )
        return user

    return checker
