"""
Serviço de comissão — Etapa 1.

`get_price` é a ÚNICA porta de entrada para valores de comissão: lê sempre da
`commission_table` no banco (nunca de constantes no código). Mapeamento de nível:
    níveis 1 e 2  -> coluna valor_nivel_1_2
    níveis 3,4,5  -> coluna valor_nivel_3_5

Assinatura: get_price(level, acao, db). O `db` (Session) é necessário porque o
valor vem do banco; mantém-se a ordem (level, acao) pedida na especificação.
"""

from sqlalchemy.orm import Session

import models


def get_price(level: int, acao: str, db: Session) -> float:
    """Retorna o valor de comissão para o nível do CS e a ação informada.

    Levanta ValueError (mensagem clara) se a ação não existir na tabela ou se o
    nível estiver fora da faixa 1–5.
    """
    row = db.query(models.CommissionTable).filter_by(acao=acao).first()
    if row is None:
        validas = [c.acao for c in db.query(models.CommissionTable).all()]
        raise ValueError(
            f"Ação de comissão desconhecida: {acao!r}. Ações válidas: {validas}"
        )

    if level in (1, 2):
        return row.valor_nivel_1_2
    if level in (3, 4, 5):
        return row.valor_nivel_3_5

    raise ValueError(
        f"Nível de CS inválido: {level!r}. Esperado um inteiro de 1 a 5."
    )
