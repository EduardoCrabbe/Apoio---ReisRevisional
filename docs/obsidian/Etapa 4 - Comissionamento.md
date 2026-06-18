---
tags: [etapa-4, comissionamento, bonus]
etapa: 4
titulo: Comissionamento
status: concluida
data: 2026-06-15
---

# Etapa 4 — Comissionamento

Bônus (ganhos extras) e a tabela de comissões. Código em `backend/routers/bonus.py`
e `backend/routers/comissoes.py`; testes em `backend/tests/test_bonus.py`.

- `POST /api/bonus` — lança um bônus. **O valor é sempre calculado no servidor**
  por `get_price(nível do CS dono, tipo)`; qualquer `valor` enviado pelo cliente é
  ignorado em silêncio. CS lança só nos seus clientes (403 se alheio); a gestão
  lança em qualquer um, mas o valor usa o nível do **CS dono** (não o do gestor),
  e o bônus é creditado a esse CS.
- `GET /api/bonus/extrato` — CS vê só os seus; gestão vê todos. Filtros `?cs_id=` e
  `?mes=AAAA-MM`. Ordenado por data desc.
- `GET /api/comissoes/tabela` — qualquer autenticado (o frontend lê daqui os
  valores dos botões, sem hardcode).
- `PUT /api/comissoes/tabela` — só **Gerente**; atualiza os valores existentes
  (não cria nem apaga ações).

## Tabela oficial de valores (atual no banco)

| Ação | Nível 1–2 | Nível 3–5 |
|---|---:|---:|
| Atendimento | R$ 1,00 | R$ 1,50 |
| Quitacao | R$ 5,00 | R$ 10,00 |
| ComentarioGoogle | R$ 5,00 | R$ 10,00 |
| FotoBoleto | R$ 5,00 | R$ 10,00 |
| ReclameAqui | R$ 10,00 | R$ 15,00 |
| VideoDepoimento | R$ 15,00 | R$ 20,00 |

> Estes são os 6 valores semeados por `backend/seed.py`. O Gerente pode ajustá-los
> em `PUT /api/comissoes/tabela`; a alteração vale só para lançamentos **futuros**.

## O congelamento de valores — e por que importa

Quando um atendimento ou bônus é lançado, o sistema lê o valor da
`commission_table` **naquele instante** e o grava na própria linha do lançamento
(`attendances.commission_value`, `bonus_entries.valor`). A partir daí, aquele
número não muda mais: ele está **congelado**. O cálculo nunca é refeito "ao vivo"
a partir da tabela atual na hora de exibir o extrato ou somar os ganhos do mês.

Isso importa porque a tabela de comissões **muda com o tempo** — o Gerente pode,
por exemplo, subir o VideoDepoimento de R$ 20 para R$ 25. Se os valores fossem
recalculados a partir da tabela vigente, essa mudança **reescreveria o passado**:
todos os ganhos já apurados em meses anteriores aumentariam de repente, quebrando
fechamentos, conferências e a confiança da equipe nos próprios números.
Congelando, garantimos auditoria correta — cada lançamento preserva exatamente o
que valia no dia em que aconteceu, e ajustes na tabela afetam só o que vier depois.

## ⚠️ Pendência a confirmar

> **FotoBoleto nível 3–5: a especificação diz R$ 10,00** (valor já semeado no
> banco). **Confirmar com o Gerente antes da apresentação** se é mesmo R$ 10,00 ou
> se haverá ajuste — é o tipo de valor fácil de mudar de última hora.

## Navegação

- ⬅ [[Etapa 3 - CRM Clientes]]
- ➡ [[Etapa 5 - Tarefas]]
