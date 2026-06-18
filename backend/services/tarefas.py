"""Regras de negócio do módulo de Tarefas — Etapa 5.

Inclui o gerador automático de tarefas do sistema como FUNÇÃO PURA
(`gerar_tarefas_sistema`), testável diretamente, mais o agendamento opcional
(lifespan + loop de 24h, só asyncio) pronto para o futuro main.py plugar.
"""

import asyncio
import os
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

import models
from database import SessionLocal

SETORES_VALIDOS = {
    "Mediação/Negociação",
    "Administrativo",
    "Jurídico",
    "Gestão",
    "Atendimento",
}
CLASSIFICACOES_VALIDAS = {"REGULAR", "CRÍTICA/URGENTE", "LEMBRETE"}

LIMITE_DIAS = {"Crítico": 7, "Atenção": 15}
GERADOR_INTERVALO_HORAS = 24


# --------------------------------------------------------------------- helpers

def hoje_utc() -> date:
    return datetime.now(timezone.utc).date()


def calc_mes_anterior(tarefa: models.Tarefa) -> bool:
    """Flag CALCULADA (nunca salva): prazo no mês passado E não concluída."""
    if tarefa.prazo is None or tarefa.concluida:
        return False
    hoje = hoje_utc()
    primeiro_dia_mes = date(hoje.year, hoje.month, 1)
    return tarefa.prazo < primeiro_dia_mes


def buscar_tarefa(db: Session, tarefa_id: int) -> models.Tarefa:
    tarefa = db.get(models.Tarefa, tarefa_id)
    if tarefa is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tarefa não encontrada.")
    return tarefa


def pode_gerir(tarefa: models.Tarefa, user: models.User) -> bool:
    if user.role in ("Gerente", "Supervisor"):
        return True
    return user.id in (tarefa.criador_id, tarefa.responsavel_id)


def exigir_pode_gerir(tarefa: models.Tarefa, user: models.User) -> None:
    if not pode_gerir(tarefa, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Você não pode gerir esta tarefa.")


def _validar_enums(setor: str, classificacao: str) -> None:
    if setor not in SETORES_VALIDOS:
        raise HTTPException(422, f"Setor inválido. Válidos: {sorted(SETORES_VALIDOS)}")
    if classificacao not in CLASSIFICACOES_VALIDAS:
        raise HTTPException(422, f"Classificação inválida. Válidas: {sorted(CLASSIFICACOES_VALIDAS)}")


def resolver_responsavel(db: Session, user: models.User, responsavel_id) -> int:
    """CS sempre a si mesmo; gestão pode atribuir a qualquer CS ativo."""
    if user.role == "CS":
        return user.id
    if responsavel_id is None or responsavel_id == user.id:
        return user.id
    alvo = db.get(models.User, responsavel_id)
    if alvo is None or not alvo.ativo or alvo.role != "CS":
        raise HTTPException(422, "responsavel_id deve ser um CS ativo.")
    return alvo.id


# ----------------------------------------------------------------- operações

def criar_tarefa(db: Session, user: models.User, dados) -> models.Tarefa:
    _validar_enums(dados.setor, dados.classificacao)
    responsavel_id = resolver_responsavel(db, user, dados.responsavel_id)
    tarefa = models.Tarefa(
        criador_id=user.id,
        responsavel_id=responsavel_id,
        cliente_id=None,
        setor=dados.setor,
        classificacao=dados.classificacao,
        origem="manual",
        prazo=dados.prazo,
        detalhes=dados.detalhes,
        concluida=False,
    )
    db.add(tarefa)
    db.commit()
    db.refresh(tarefa)
    return tarefa


def listar_tarefas(db: Session, user: models.User, responsavel_id, concluida: bool):
    q = db.query(models.Tarefa).filter(models.Tarefa.concluida.is_(concluida))
    if user.role == "CS":
        if responsavel_id is not None and responsavel_id != user.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Você só pode ver as suas tarefas.")
        q = q.filter(models.Tarefa.responsavel_id == user.id)
    elif responsavel_id is not None:
        q = q.filter(models.Tarefa.responsavel_id == responsavel_id)

    tarefas = q.all()
    # mes_anterior=True primeiro; depois prazo ascendente (None por último).
    tarefas.sort(key=lambda t: (0 if calc_mes_anterior(t) else 1, t.prazo or date.max))
    return tarefas


def adiar_tarefa(db: Session, tarefa: models.Tarefa, user: models.User) -> models.Tarefa:
    exigir_pode_gerir(tarefa, user)
    tarefa.prazo = hoje_utc()  # não altera concluida
    db.commit()
    db.refresh(tarefa)
    return tarefa


def concluir_tarefa(db: Session, tarefa: models.Tarefa, user: models.User) -> models.Tarefa:
    exigir_pode_gerir(tarefa, user)
    tarefa.concluida = True
    db.commit()
    db.refresh(tarefa)
    return tarefa


def deletar_tarefa(db: Session, tarefa: models.Tarefa, user: models.User) -> None:
    exigir_pode_gerir(tarefa, user)  # origem="sistema" pode ser deletada normalmente
    db.delete(tarefa)
    db.commit()


# ------------------------------------------------- gerador automático (puro)

def gerar_tarefas_sistema(db: Session) -> int:
    """Cria tarefas origem='sistema' para clientes Ativos com retorno vencido.

    Idempotente: não duplica se já existe tarefa de sistema aberta para o cliente.
    Retorna quantas tarefas criou.
    """
    hoje = hoje_utc()
    clientes = (
        db.query(models.Customer)
        .filter(
            models.Customer.status == "Ativo",
            models.Customer.criticidade.in_(list(LIMITE_DIAS.keys())),
        )
        .all()
    )

    criadas = 0
    for c in clientes:
        if c.cs_id is None:
            continue  # sem dono não há a quem atribuir
        limite = LIMITE_DIAS[c.criticidade]
        vencido = c.ultimo_contato is None or (hoje - c.ultimo_contato.date()) >= timedelta(days=limite)
        if not vencido:
            continue

        ja_existe = (
            db.query(models.Tarefa)
            .filter(
                models.Tarefa.origem == "sistema",
                models.Tarefa.concluida.is_(False),
                models.Tarefa.cliente_id == c.id_datajuri,
            )
            .first()
        )
        if ja_existe is not None:
            continue

        classificacao = "CRÍTICA/URGENTE" if c.criticidade == "Crítico" else "LEMBRETE"
        db.add(models.Tarefa(
            criador_id=c.cs_id,
            responsavel_id=c.cs_id,
            cliente_id=c.id_datajuri,
            setor="Atendimento",
            classificacao=classificacao,
            origem="sistema",
            prazo=hoje,
            detalhes=f"Falar com o cliente {c.first_name} ({c.criticidade}) — prazo de retorno vencido.",
            concluida=False,
        ))
        criadas += 1

    db.commit()
    return criadas


# ------------------------------------- agendamento (pronto p/ o futuro main.py)

async def _loop_gerador():
    """Loop infinito: a cada 24h roda o gerador numa sessão própria."""
    while True:
        await asyncio.sleep(GERADOR_INTERVALO_HORAS * 3600)
        db = SessionLocal()
        try:
            gerar_tarefas_sistema(db)
        except Exception as exc:  # nunca derruba o loop
            print(f"[gerador-tarefas] erro: {exc}")
        finally:
            db.close()


@asynccontextmanager
async def lifespan(app):
    """Lifespan do FastAPI: roda o gerador uma vez no startup e, se habilitado,
    agenda o loop de 24h.

    DISABLE_TASK_LOOP=1 → roda só a passada inicial e NÃO agenda o loop
    (usado em testes para não pendurar uma task de 24h). Caso contrário, roda a
    passada inicial e agenda o loop; no shutdown a task é cancelada.
    Uso:  app = FastAPI(lifespan=lifespan)
    """
    db = SessionLocal()
    try:
        gerar_tarefas_sistema(db)
    except Exception as exc:
        print(f"[gerador-tarefas] erro no startup: {exc}")
    finally:
        db.close()

    task = None
    if os.getenv("DISABLE_TASK_LOOP") != "1":
        task = asyncio.create_task(_loop_gerador())

    try:
        yield
    finally:
        if task is not None:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
