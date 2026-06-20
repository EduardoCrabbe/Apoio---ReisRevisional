"""Seed de DEMONSTRAÇÃO do "Apoio ao CS" — Etapa 9.

Popula um banco realista para o apresentador: 1 Gerente + 2 CS, clientes
(somente PRIMEIRO NOME — LGPD), alguns atendimentos/quitação e UM alerta vermelho
do robô (com a tarefa CRÍTICA/URGENTE correspondente) para o momento cross-produto.

Idempotente: rodar de novo não duplica (verifica por e-mail / id_datajuri).
NÃO é o seed de produção — é só para o demo.

Uso (a partir de backend/):
    python demo_seed.py

As credenciais abaixo batem com as variáveis VITE_DEMO_* do frontend.
"""

from datetime import timedelta

import models
from database import SessionLocal
from seed import init_db, seed_commission_table
from auth.deps import hash_password
from services.clientes import agora_utc

ALERTA_VERMELHO = "🚨 ALERTA VERMELHO"
SENHA_DEMO = "demo1234"  # >= 8 chars; vale para todos os usuários do demo

USUARIOS = [
    # email, role, level_cs, nome_exibicao
    ("gerente@reisrevisional.com.br", "Gerente", None, "Gerente Demo"),
    ("cs@reisrevisional.com.br",      "CS",      2,    "Eduardo"),
    ("ana@reisrevisional.com.br",     "CS",      4,    "Ana"),
]


def _get_or_create_user(db, email, role, level_cs, nome):
    u = db.query(models.User).filter(models.User.email == email).first()
    if u is None:
        u = models.User(
            email=email,
            password_hash=hash_password(SENHA_DEMO),
            role=role,
            level_cs=level_cs,
            nome_exibicao=nome,
            ativo=True,
        )
        db.add(u)
        db.commit()
        db.refresh(u)
    return u


def _get_or_create_cliente(db, id_dj, nome, cs_id, **kw):
    c = db.get(models.Customer, id_dj)
    if c is None:
        c = models.Customer(
            id_datajuri=id_dj,
            first_name=nome,                       # SÓ primeiro nome (LGPD)
            uf=kw.get("uf", "SP"),
            contrato=kw.get("contrato", "Veículo"),
            tem_processo=kw.get("tem_processo", "Não"),
            criticidade=kw.get("criticidade", "Regular"),
            status=kw.get("status", "Ativo"),
            cs_id=cs_id,
            contatos=kw.get("contatos", 0),
            tentativas=kw.get("tentativas", 0),
            ultimo_contato=kw.get("ultimo_contato"),
        )
        db.add(c)
        db.commit()
    return c


def _criar_tarefa_alerta(db, cliente):
    """Mesma regra do servidor: tarefa CRÍTICA/URGENTE p/ o dono, sem duplicar."""
    ja = (
        db.query(models.Tarefa)
        .filter(
            models.Tarefa.origem == "sistema",
            models.Tarefa.concluida.is_(False),
            models.Tarefa.cliente_id == cliente.id_datajuri,
        )
        .first()
    )
    if ja is not None:
        return
    db.add(models.Tarefa(
        criador_id=cliente.cs_id,
        responsavel_id=cliente.cs_id,
        cliente_id=cliente.id_datajuri,
        setor="Atendimento",
        classificacao="CRÍTICA/URGENTE",
        origem="sistema",
        prazo=agora_utc().date(),
        detalhes=f"{ALERTA_VERMELHO} no Eproc — cliente {cliente.first_name}. Verificar movimentação urgente.",
        concluida=False,
    ))
    db.commit()


def main():
    init_db()
    db = SessionLocal()
    try:
        seed_commission_table(db)

        gerente = _get_or_create_user(db, *USUARIOS[0])
        eduardo = _get_or_create_user(db, *USUARIOS[1])
        ana = _get_or_create_user(db, *USUARIOS[2])

        agora = agora_utc()

        # Carteira do Eduardo (CS demo logado): nomes só de primeiro nome.
        # Os 3 primeiros ids (10683, 12175, 11839) são os "reais" e batem com a
        # planilha do agente (planilha_exemplo.xlsx) — é o que liga o agente à web.
        clientes_edu = [
            # id, nome, criticidade, tem_processo, status, contatos, ultimo_contato
            ("10683",  "João",    "Crítico", "Sim", "Ativo", 1, agora - timedelta(days=9)),
            ("12175",  "Marcos",  "Atenção", "Não", "Ativo", 0, None),
            ("11839",  "Beatriz", "Regular", "Não", "Ativo", 2, agora - timedelta(hours=10)),
            ("100204", "Carla",   "Crítico", "Sim", "Ativo", 0, None),
            ("100205", "Rafael",  "Regular", "Não", "Quitado", 3, agora - timedelta(days=2)),
        ]
        for id_dj, nome, crit, proc, status, contatos, uc in clientes_edu:
            _get_or_create_cliente(
                db, id_dj, nome, eduardo.id,
                criticidade=crit, tem_processo=proc, status=status,
                contatos=contatos, ultimo_contato=uc,
            )

        # Carteira da Ana (2º CS, p/ visão de gestão fazer sentido).
        clientes_ana = [
            ("100301", "Lucas",   "Atenção", "Não", "Ativo", 1, agora - timedelta(days=1)),
            ("100302", "Fernanda","Regular", "Não", "Ativo", 0, None),
            ("100303", "Pedro",   "Crítico", "Sim", "Ativo", 0, None),
        ]
        for id_dj, nome, crit, proc, status, contatos, uc in clientes_ana:
            _get_or_create_cliente(
                db, id_dj, nome, ana.id,
                criticidade=crit, tem_processo=proc, status=status,
                contatos=contatos, ultimo_contato=uc,
            )

        # Status jurídico de exemplo nos clientes (aparece na tela Quitações).
        for cid, prot, tarifas, consulta in [
            ("100205", "Cliente ciente", True, True),
            ("100303", "Sim", False, True),
            ("10683", "Não possui", False, False),
        ]:
            cc = db.get(models.Customer, cid)
            if cc is not None:
                cc.protesto = prot
                cc.tarifas_restituiveis = tarifas
                cc.consulta_processo = consulta
        db.commit()

        # Atendimentos congelados (alimentam ganhos do mês) — só se ainda não houver.
        if db.query(models.Attendance).count() == 0:
            for cid, uid, val in [("11839", eduardo.id, 1.0), ("11839", eduardo.id, 1.0),
                                  ("100301", ana.id, 1.5)]:
                db.add(models.Attendance(user_id=uid, customer_id=cid, timestamp=agora, commission_value=val))
            db.commit()

        # Quitações de demo (com bônus congelado) p/ a tela não ficar vazia.
        # 'pagamento' é texto livre — duas formas diferentes p/ aparecer no demo.
        if db.query(models.Quitacao).count() == 0:
            db.add(models.Quitacao(
                customer_id="100205", cs_id=eduardo.id,
                valor_original=42000.0, valor_pago=15000.0,
                consulta_processo="Ativa", protesto=False, tarifas_restituiveis=True,
                pagamento="À vista",
                mes_referencia=agora.strftime("%Y-%m"),
                data_boleto=agora.date(), data_pagamento=agora.date(),
            ))
            db.add(models.BonusEntry(user_id=eduardo.id, customer_id="100205",
                                     tipo="Quitacao", valor=5.0, timestamp=agora))
            db.add(models.Quitacao(
                customer_id="100303", cs_id=ana.id,
                valor_original=12000.0, valor_pago=7000.0,
                consulta_processo="Excluída", protesto=False, tarifas_restituiveis=False,
                pagamento="10x de R$500,00",
                mes_referencia=agora.strftime("%Y-%m"),
                data_boleto=agora.date(), data_pagamento=agora.date(),
            ))
            db.commit()

        # 🚨 O momento cross-produto: alerta vermelho do robô + tarefa crítica.
        # Mesmo id (10683) que a planilha do agente envia — rodar o agente
        # reforça este alerta (a tarefa não duplica). Pré-semeado para o demo
        # funcionar mesmo SEM rodar o agente.
        cliente_alerta = db.get(models.Customer, "10683")  # João, crítico do Eduardo
        if db.query(models.RoboResultado).filter_by(triagem=ALERTA_VERMELHO).first() is None:
            db.add(models.RoboResultado(
                customer_id="10683",
                classe="BUSCA E APREENSAO",
                data_movimentacao=agora.strftime("%d/%m/%Y"),
                descricao="Juntada de Petição / Mandado de busca e apreensão expedido.",
                triagem=ALERTA_VERMELHO,
                recebido_em=agora,
            ))
            # Um resultado NORMAL também, p/ a tela de monitoramento ter contraste.
            db.add(models.RoboResultado(
                customer_id="100204",
                classe="EXECUCAO DE TITULO EXTRAJUDICIAL",
                data_movimentacao=agora.strftime("%d/%m/%Y"),
                descricao="Conclusos para despacho.",
                triagem="REGISTRO NORMAL",
                recebido_em=agora,
            ))
            db.commit()
            _criar_tarefa_alerta(db, cliente_alerta)

        # Tarefa CRÍTICA/URGENTE criada pela GESTÃO para o CS (valida o item 5:
        # aparece no Radar de Prioridades do CS dono, marcada como "tarefa da gestão").
        if db.query(models.Tarefa).filter_by(origem="manual", classificacao="CRÍTICA/URGENTE").first() is None:
            db.add(models.Tarefa(
                criador_id=gerente.id,
                responsavel_id=eduardo.id,
                cliente_id="12175",
                setor="Gestão",
                classificacao="CRÍTICA/URGENTE",
                origem="manual",
                prazo=agora.date(),
                detalhes="Gestão: priorizar contato com Marcos hoje (renegociação urgente).",
                concluida=False,
            ))
            db.commit()

        print("OK — demo_seed concluído.")
        print(f"  Usuários: {db.query(models.User).count()} | "
              f"Clientes: {db.query(models.Customer).count()} | "
              f"Quitações: {db.query(models.Quitacao).count()} | "
              f"Alertas robô: {db.query(models.RoboResultado).filter_by(triagem=ALERTA_VERMELHO).count()}")
        print("\nCredenciais do demo (senha para todos: '%s'):" % SENHA_DEMO)
        for email, role, *_ in USUARIOS:
            print(f"  - {role:9s} {email}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
