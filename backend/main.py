"""Aplicação FastAPI do "Apoio ao CS" — montagem (Etapa 5.5).

Reconstruído do zero. Usa uma factory create_app() que valida o ambiente e
conecta routers + lifespan + CORS. Nada de lógica de negócio aqui — só montagem.
"""

import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine
from services.tarefas import lifespan

from auth.router import router as auth_router
from routers.clientes import router as clientes_router
from routers.bonus import router as bonus_router
from routers.comissoes import router as comissoes_router
from routers.tarefas import router as tarefas_router
from routers.dashboard import router as dashboard_router
from routers.equipe import router as equipe_router
from routers.ia import router as ia_router
from routers.robo import router as robo_router

# Carrega o .env (não sobrescreve variáveis já definidas no ambiente).
load_dotenv()

DEFAULT_ORIGINS = "http://localhost:5173"


def create_app() -> FastAPI:
    """Valida o ambiente e monta a aplicação. Levanta RuntimeError sem SECRET_KEY."""
    if not os.getenv("SECRET_KEY"):
        raise RuntimeError(
            "SECRET_KEY não definida no ambiente (.env). A aplicação não pode "
            "iniciar sem ela — defina SECRET_KEY antes de subir o servidor."
        )

    app = FastAPI(title="Apoio ao CS API", lifespan=lifespan)

    origens = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", DEFAULT_ORIGINS).split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origens,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Garante as tabelas (idempotente). NÃO semeia — o seed continua manual.
    Base.metadata.create_all(bind=engine)

    @app.get("/api/health", tags=["health"])
    def health():
        return {"status": "ok"}

    # Cada router já traz o próprio prefixo /api/... — não duplicar aqui.
    app.include_router(auth_router)
    app.include_router(clientes_router)
    app.include_router(bonus_router)
    app.include_router(comissoes_router)
    app.include_router(tarefas_router)
    app.include_router(dashboard_router)
    app.include_router(equipe_router)
    app.include_router(ia_router)
    app.include_router(robo_router)

    return app


app = create_app()
