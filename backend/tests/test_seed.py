"""Testes do seed — Etapa 1: idempotência e valores corretos."""

import models
from seed import seed_commission_table


def test_seed_e_idempotente(db):
    # A fixture já semeou uma vez (6 ações). Rodar de novo não duplica.
    antes = db.query(models.CommissionTable).count()
    inseridos = seed_commission_table(db)
    depois = db.query(models.CommissionTable).count()
    assert antes == 6
    assert inseridos == 0
    assert depois == 6


def test_seed_grava_valores_oficiais(db):
    por_acao = {c.acao: c for c in db.query(models.CommissionTable).all()}
    assert (por_acao["Atendimento"].valor_nivel_1_2,
            por_acao["Atendimento"].valor_nivel_3_5) == (1.00, 1.50)
    assert (por_acao["Quitacao"].valor_nivel_1_2,
            por_acao["Quitacao"].valor_nivel_3_5) == (5.0, 10.0)
    assert (por_acao["ReclameAqui"].valor_nivel_1_2,
            por_acao["ReclameAqui"].valor_nivel_3_5) == (10.0, 15.0)
    assert (por_acao["VideoDepoimento"].valor_nivel_1_2,
            por_acao["VideoDepoimento"].valor_nivel_3_5) == (15.0, 20.0)
