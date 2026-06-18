"""
Migração de senhas legadas para bcrypt — RODA UMA ÚNICA VEZ.

Converte para bcrypt qualquer `password_hash` que NÃO esteja já em formato
bcrypt (ex.: senha em texto puro herdada de um banco legado). Idempotente:
hashes que já são bcrypt são ignorados.

IMPORTANTE: o banco atual (novo schema, gerado pelo seed.py) começa SEM usuários.
Na prática, aqui este script é um no-op — ele existe apenas para o cenário de
importar um banco antigo. Ver auth/README.md.

Uso (a partir de backend/):
    python -m auth.migrate_passwords
"""

import os
import sys

# Garante backend/ no sys.path para imports planos (models, database, auth.*)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import models
from database import SessionLocal
from auth import deps

_BCRYPT_PREFIXES = ("$2a$", "$2b$", "$2y$")


def _ja_e_bcrypt(h: str) -> bool:
    return isinstance(h, str) and h.startswith(_BCRYPT_PREFIXES)


def main():
    db = SessionLocal()
    try:
        usuarios = db.query(models.User).all()
        migrados = 0
        for u in usuarios:
            if not _ja_e_bcrypt(u.password_hash or ""):
                u.password_hash = deps.hash_password(u.password_hash or "")
                migrados += 1
        db.commit()
        print(
            f"Migração concluída. {len(usuarios)} usuário(s) verificado(s); "
            f"{migrados} senha(s) convertida(s) para bcrypt."
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
