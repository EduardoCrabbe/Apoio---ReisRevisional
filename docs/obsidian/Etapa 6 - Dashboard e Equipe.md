---
tags: [etapa-6, dashboard, equipe, relatorios]
etapa: 6
titulo: Dashboard e Equipe
status: concluida
data: 2026-06-15
---

# Etapa 6 — Dashboard e Equipe

Visões agregadas: o **Dashboard** (KPIs + Radar de prioridades, escopo por papel)
e a **Equipe** (painel da gestão sobre cada CS). Código em
`backend/routers/dashboard.py`, `backend/routers/equipe.py` e a lógica em
`backend/services/dashboard.py`; testes em `backend/tests/test_dashboard.py`.
Registrados no `main.py` em `/api/dashboard` e `/api/equipe`.

## Rotas

- `GET /api/dashboard/stats` — KPIs da carteira + `ganhosTotais` do mês + Radar.
  Escopo por papel (ver abaixo).
- `GET /api/equipe` — **só gestão**; uma linha por CS ativo (nível, clientes,
  atendidos/faltam com %, quitações e ganhos do mês). CS → **403**.
- `PUT /api/equipe/{id}/nivel` — **só Gerente**; muda o `level_cs` de um CS.
- `DELETE /api/equipe/{id}` — **só Gerente**; desativa (`ativo=false`), não apaga.

## Por que radar e ganhos são CALCULADOS (nunca armazenados)

Os números do Dashboard são todos derivados na hora da consulta — não existe
nenhuma coluna "total de atendidos" ou "ganhos do mês" guardada no banco. O
motivo é que esses valores **mudam sozinhos com o tempo e com cada ação**:
o "ganhos do mês" depende de qual é o mês corrente (vira na virada do mês), e o
Radar depende de **quantos dias se passaram desde o último contato** — ou seja,
muda a cada minuto, mesmo sem ninguém mexer no cliente. Guardar esses números
exigiria recalculá-los e regravá-los o tempo todo, criando risco enorme de o
valor exibido ficar defasado da realidade.

Calcular sob demanda é sempre correto e mais barato de manter. Note a diferença
para os **valores congelados** (comissões em `attendances`/`bonus_entries`):
aqueles são gravados porque representam um **fato histórico** que não pode mudar
(o que o CS ganhou naquele lançamento). Já o Radar e os totais são **uma foto do
agora** — fazem sentido apenas no instante da consulta, então são computados, não
armazenados. O `ganhosTotais` soma justamente aqueles valores já congelados,
filtrando pelo mês-calendário atual (UTC).

### Radar de prioridades

Para cada cliente **Ativo** com criticidade **Crítico** (limite 7 dias) ou
**Atenção** (15 dias): `prazo_restante = (ultimo_contato + limite) − agora`. Se
`ultimo_contato` é nulo **ou** o prazo é negativo → **"Atrasado"**. A lista vem
ordenada do **mais atrasado ao menos** (nunca-contatados primeiro). Clientes
**Regular** nunca entram no Radar.

## Escopo por papel

| Recurso | CS | Gerente / Supervisor |
|---|---|---|
| `GET /dashboard/stats` | só a **própria carteira** (`cs_id` = logado) | **agregado** de todos os clientes |
| `GET /equipe` | **403** | vê todos os CS ativos |
| `PUT /equipe/{id}/nivel` | **403** | só **Gerente** (Supervisor → 403) |
| `DELETE /equipe/{id}` | **403** | só **Gerente** |

Regras de proteção do `DELETE`: desativar (`ativo=false`) **preserva** todo o
histórico financeiro do CS — os ganhos continuam aparecendo nos relatórios (ex.:
extrato de bônus). Não é permitido o Gerente desativar **a si mesmo** nem o
**último Gerente ativo**. Mudar o nível de um CS afeta apenas lançamentos
**futuros** — os passados já estão congelados.

## Navegação

- ⬅ [[Etapa 5 - Tarefas]]
- ➡ [[Etapa 7 - IA Gemini]]
