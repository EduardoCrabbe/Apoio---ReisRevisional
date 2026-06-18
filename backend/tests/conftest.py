"""Fixtures de teste.

Garante que o diretório `backend/` esteja no sys.path (imports planos: models,
database, services.comissao, auth.*) e fornece um banco SQLite em memória,
isolado e já semeado com a commission_table.
"""

import os
import sys

# backend/ no sys.path (este arquivo está em backend/tests/)
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# SECRET_KEY de teste (a autenticação se recusa a operar sem ela).
os.environ.setdefault("SECRET_KEY", "test-secret-key-etapa2")

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
import models  # noqa: F401 — registra as tabelas em Base.metadata
from seed import seed_commission_table


@pytest.fixture
def db():
    """Session SQLite em memória, com tabelas criadas e commission_table semeada."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestSession()
    seed_commission_table(session)
    try:
        yield session
    finally:
        session.close()
        engine.dispose()
