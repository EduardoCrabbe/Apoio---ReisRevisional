---
tags: [adr, decisoes, arquitetura]
titulo: ADR — Decisões de Arquitetura
status: vivo
data: 2026-06-15
---

# ADR — Decisões de Arquitetura

Índice das decisões estruturais do "Apoio ao CS". O detalhamento por etapa está
em `docs/DECISOES.md` (na raiz de `docs/`) e nas notas de cada etapa.

| # | Decisão | Por quê | Onde |
|---|---|---|---|
| ADR-1 | **Valores congelados** em `attendances.commission_value` e `bonus_entries.valor` | Mudar a tabela de comissões não pode reescrever o passado | [[Etapa 1 - Banco de Dados]], [[Etapa 4 - Comissionamento]] |
| ADR-2 | **JWT 12h** + `get_current_user`/`require_role`; senha só bcrypt; `SECRET_KEY` obrigatória | Identidade (401) vs permissão (403); sem segredo hardcoded | [[Etapa 2 - Autenticacao]] |
| ADR-3 | **Calculado, nunca armazenado** (radar, ganhos do mês, `mes_anterior`, economia/%) | Dependem do "agora"; guardar gera defasagem | [[Etapa 5 - Tarefas]], [[Etapa 6 - Dashboard e Equipe]] |
| ADR-4 | **Factory `create_app()`** + lifespan importado de `services/tarefas.py` | Testabilidade (SECRET_KEY ausente) e loop 24h controlável (`DISABLE_TASK_LOOP`) | [[Etapa 5.5 - Reconstrucao do main.py]] |
| ADR-5 | **IA: limpeza em `finally`** (temp local + arquivo no Gemini); mock por env | Disco + LGPD; falha → 502, nunca 200 com erro | [[Etapa 7 - IA Gemini]] |
| ADR-6 | **Agente Eproc desacoplado** (local-primeiro, best-effort); scraping só no agente | CS trabalha com servidor fora; **CPF nunca viaja** (server rejeita 422) | [[Etapa 8 - Agente Eproc]] |
| ADR-7 | **bcrypt direto** (não passlib) | `passlib 1.7.4` quebra com `bcrypt 5.0` no venv | `docs/DECISOES.md` |
| ADR-8 | **Sem `relationship()` ORM** nesta fase (só FKs) | Evita ambiguidade de mapper em tabelas com 2 FKs p/ `users` | `docs/DECISOES.md` |

Ver também: [[Etapa 0 - Estrutura do Repositorio]] e `docs/DECISOES.md`.
