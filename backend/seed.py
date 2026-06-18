"""
Seed idempotente do "Apoio ao CS" — Etapa 1.

Cria todas as tabelas e popula a `commission_table` com os valores oficiais.
Rodar duas vezes NÃO duplica linhas (verifica a ação antes de inserir).

Uso:
    python seed.py
"""

import models
from database import Base, SessionLocal, engine

# Valores oficiais de comissão (PROMPT_MESTRE, Seção 4).
# colunas: valor para níveis 1–2  /  valor para níveis 3–5
COMMISSION_SEED = [
    {"acao": "Atendimento",      "valor_nivel_1_2": 1.00, "valor_nivel_3_5": 1.50},
    {"acao": "Quitacao",         "valor_nivel_1_2": 5.0,  "valor_nivel_3_5": 10.0},
    {"acao": "ComentarioGoogle", "valor_nivel_1_2": 5.0,  "valor_nivel_3_5": 10.0},
    {"acao": "FotoBoleto",       "valor_nivel_1_2": 5.0,  "valor_nivel_3_5": 10.0},
    {"acao": "ReclameAqui",      "valor_nivel_1_2": 10.0, "valor_nivel_3_5": 15.0},
    {"acao": "VideoDepoimento",  "valor_nivel_1_2": 15.0, "valor_nivel_3_5": 20.0},
]


def init_db():
    """Cria todas as tabelas registradas em Base.metadata (idempotente)."""
    Base.metadata.create_all(bind=engine)


def seed_commission_table(db):
    """Insere as ações de comissão que ainda não existem. Retorna quantas inseriu."""
    inseridos = 0
    for item in COMMISSION_SEED:
        existe = db.query(models.CommissionTable).filter_by(acao=item["acao"]).first()
        if existe is None:
            db.add(models.CommissionTable(**item))
            inseridos += 1
    db.commit()
    return inseridos


def main():
    init_db()
    db = SessionLocal()
    try:
        n = seed_commission_table(db)
        total = db.query(models.CommissionTable).count()
        print(f"OK: tabelas criadas. {n} ação(ões) inserida(s); {total} no total (idempotente).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
