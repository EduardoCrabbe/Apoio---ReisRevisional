"""Testes de get_price — Etapa 1.

Cobre níveis 1, 2, 3 e 5 e o caso de ação inexistente (deve levantar erro claro).
"""

import pytest

from services.comissao import get_price


def test_atendimento_niveis_1_e_2_usam_coluna_1_2(db):
    assert get_price(1, "Atendimento", db) == 1.00
    assert get_price(2, "Atendimento", db) == 1.00


def test_atendimento_niveis_3_e_5_usam_coluna_3_5(db):
    assert get_price(3, "Atendimento", db) == 1.50
    assert get_price(5, "Atendimento", db) == 1.50


def test_quitacao_por_nivel(db):
    assert get_price(1, "Quitacao", db) == 5.0   # nível 1–2
    assert get_price(3, "Quitacao", db) == 10.0  # nível 3–5


def test_video_depoimento_cobre_os_quatro_niveis(db):
    # Níveis 1, 2, 3 e 5 explicitamente cobertos.
    assert get_price(1, "VideoDepoimento", db) == 15.0
    assert get_price(2, "VideoDepoimento", db) == 15.0
    assert get_price(3, "VideoDepoimento", db) == 20.0
    assert get_price(5, "VideoDepoimento", db) == 20.0


def test_acao_inexistente_levanta_valueerror_claro(db):
    with pytest.raises(ValueError) as exc:
        get_price(1, "AcaoQueNaoExiste", db)
    assert "desconhecida" in str(exc.value).lower()


def test_nivel_invalido_levanta_valueerror(db):
    with pytest.raises(ValueError) as exc:
        get_price(9, "Atendimento", db)
    assert "nível" in str(exc.value).lower() or "nivel" in str(exc.value).lower()
