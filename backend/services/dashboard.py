"""Cálculos do Dashboard e da Equipe — Etapa 6.

TUDO é calculado na consulta — nada é pré-armazenado. Escopo por papel:
CS enxerga só a própria carteira; gestão enxerga o agregado.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import func

import models

LIMITE_DIAS = {"Crítico": 7, "Atenção": 15}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _intervalo_mes_atual():
    agora = _utcnow()
    inicio = datetime(agora.year, agora.month, 1)
    fim = datetime(agora.year + 1, 1, 1) if agora.month == 12 else datetime(agora.year, agora.month + 1, 1)
    return inicio, fim


def _mes_atual_str() -> str:
    agora = _utcnow()
    return f"{agora.year:04d}-{agora.month:02d}"


def _pct(parte: int, total: int) -> float:
    return round(parte / total * 100, 1) if total else 0.0


def ganhos_do_mes(db, cs_id=None) -> float:
    """Soma attendances.commission_value + bonus_entries.valor do mês corrente.

    cs_id=None → agregado (gestão). cs_id=<id> → só daquele CS.
    """
    inicio, fim = _intervalo_mes_atual()
    qa = db.query(func.coalesce(func.sum(models.Attendance.commission_value), 0.0)).filter(
        models.Attendance.timestamp >= inicio, models.Attendance.timestamp < fim
    )
    qb = db.query(func.coalesce(func.sum(models.BonusEntry.valor), 0.0)).filter(
        models.BonusEntry.timestamp >= inicio, models.BonusEntry.timestamp < fim
    )
    if cs_id is not None:
        qa = qa.filter(models.Attendance.user_id == cs_id)
        qb = qb.filter(models.BonusEntry.user_id == cs_id)
    return round(float(qa.scalar() or 0.0) + float(qb.scalar() or 0.0), 2)


def radar_prioridades(db, cs_id=None):
    """Radar = clientes Ativos Crítico/Atenção em atraso + tarefas abertas
    CRÍTICA/URGENTE (origem sistema OU manual), mescladas e ordenadas do mais
    atrasado ao menos. Cada item traz `tipo` ("cliente"|"tarefa") e `origem_radar`
    para a tela diferenciar visualmente."""
    agora = _utcnow()

    # --- clientes Crítico/Atenção ---
    q = db.query(models.Customer).filter(
        models.Customer.status == "Ativo",
        models.Customer.criticidade.in_(list(LIMITE_DIAS.keys())),
    )
    if cs_id is not None:
        q = q.filter(models.Customer.cs_id == cs_id)

    itens = []
    for c in q.all():
        limite = timedelta(days=LIMITE_DIAS[c.criticidade])
        if c.ultimo_contato is None:
            horas = None
            atrasado = True
        else:
            restante = (c.ultimo_contato + limite) - agora
            horas = round(restante.total_seconds() / 3600, 1)
            atrasado = restante.total_seconds() < 0
        itens.append({
            "tipo": "cliente",
            "origem_radar": "cliente em atraso",
            "customer_id": c.id_datajuri,
            "nome": c.first_name,
            "criticidade": c.criticidade,
            "ultimo_contato": c.ultimo_contato,
            "horas_restantes": horas,
            "status": "Atrasado" if atrasado else "No prazo",
        })

    # --- tarefas abertas CRÍTICA/URGENTE (sistema ou manual) ---
    tq = db.query(models.Tarefa).filter(
        models.Tarefa.concluida.is_(False),
        models.Tarefa.classificacao == "CRÍTICA/URGENTE",
    )
    if cs_id is not None:
        tq = tq.filter(models.Tarefa.responsavel_id == cs_id)
    tarefas = tq.all()

    # Nome do cliente (se a tarefa estiver ligada a um) para exibir no radar.
    nomes = {}
    ids = [t.cliente_id for t in tarefas if t.cliente_id]
    if ids:
        for cid, fname in db.query(models.Customer.id_datajuri, models.Customer.first_name).filter(
            models.Customer.id_datajuri.in_(ids)
        ).all():
            nomes[cid] = fname

    for t in tarefas:
        if t.prazo is None:
            horas = None
            atrasado = True
        else:
            # prazo vence no fim do dia do prazo.
            fim_do_dia = datetime(t.prazo.year, t.prazo.month, t.prazo.day) + timedelta(days=1)
            restante = fim_do_dia - agora
            horas = round(restante.total_seconds() / 3600, 1)
            atrasado = restante.total_seconds() < 0
        nome = nomes.get(t.cliente_id) or (t.detalhes[:40] if t.detalhes else "Tarefa")
        itens.append({
            "tipo": "tarefa",
            "origem_radar": "tarefa da gestão" if t.origem == "manual" else "tarefa do sistema",
            "tarefa_id": t.id,
            "customer_id": t.cliente_id,
            "nome": nome,
            "criticidade": "Crítico",  # CRÍTICA/URGENTE → estilo de urgência máxima
            "ultimo_contato": None,
            "horas_restantes": horas,
            "status": "Atrasado" if atrasado else "No prazo",
        })

    # Mais atrasado primeiro: horas None = -inf; depois horas crescente.
    itens.sort(key=lambda x: x["horas_restantes"] if x["horas_restantes"] is not None else float("-inf"))
    return itens


def dashboard_stats(db, user):
    cs_id = user.id if user.role == "CS" else None

    base = db.query(models.Customer).filter(models.Customer.status == "Ativo")
    if cs_id is not None:
        base = base.filter(models.Customer.cs_id == cs_id)
    ativos = base.all()

    total = len(ativos)
    atendidos = sum(1 for c in ativos if (c.contatos or 0) > 0)
    tentativas = sum(1 for c in ativos if (c.contatos or 0) == 0 and (c.tentativas or 0) > 0)
    nao_atendidos = total - atendidos - tentativas

    return {
        "totalAtivos": total,
        "atendidos": atendidos,
        "tentativas": tentativas,
        "naoAtendidos": nao_atendidos,
        "percentuais": {
            "atendidos": _pct(atendidos, total),
            "tentativas": _pct(tentativas, total),
            "naoAtendidos": _pct(nao_atendidos, total),
        },
        "ganhosTotais": ganhos_do_mes(db, cs_id),
        "prioridades": radar_prioridades(db, cs_id),
    }


def equipe_rows(db):
    """Uma linha por CS ATIVO."""
    mes_ref = _mes_atual_str()
    cs_list = (
        db.query(models.User)
        .filter(models.User.role == "CS", models.User.ativo.is_(True))
        .order_by(models.User.id)
        .all()
    )
    rows = []
    for cs in cs_list:
        clientes = db.query(models.Customer).filter(models.Customer.cs_id == cs.id).all()
        total = len(clientes)
        atendidos = sum(1 for c in clientes if (c.contatos or 0) > 0)
        faltam = total - atendidos
        quitacoes_mes = (
            db.query(models.Quitacao)
            .filter(models.Quitacao.cs_id == cs.id, models.Quitacao.mes_referencia == mes_ref)
            .count()
        )
        rows.append({
            "cs_id": cs.id,
            "nome": cs.nome_exibicao,
            "nivel": cs.level_cs,
            "totalClientes": total,
            "atendidos": atendidos,
            "atendidosPct": _pct(atendidos, total),
            "faltam": faltam,
            "faltamPct": _pct(faltam, total),
            "quitacoesMes": quitacoes_mes,
            "ganhosMes": ganhos_do_mes(db, cs.id),
        })
    return rows
