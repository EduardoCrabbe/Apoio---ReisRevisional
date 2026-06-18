"""Schemas Pydantic v2 da autenticação — Etapa 2.

E-mail é `str` (não `EmailStr`) para não depender de `email-validator`; a regra
de domínio corporativo é validada no router. Ver docs/DECISOES.md.
"""

from typing import Optional

from pydantic import BaseModel, ConfigDict


class UserRegister(BaseModel):
    email: str
    password: str
    role: str = "CS"
    nome_exibicao: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    role: str
    level_cs: Optional[int] = None
    nome_exibicao: Optional[str] = None
    ativo: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic
