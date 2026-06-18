---
tags: [etapa-5-5, backend, montagem, fastapi]
etapa: 5.5
titulo: Reconstrução do main.py
status: concluida
data: 2026-06-15
---

# Etapa 5.5 — Reconstrução do `main.py`

O `main.py` legado (do app antigo, quebrado) foi **substituído por inteiro**.
Agora ele só **monta e conecta** — nenhuma lógica de negócio. Padrão **factory**:
`create_app()` valida o ambiente e devolve o `FastAPI`; o módulo expõe
`app = create_app()` para o uvicorn (`uvicorn main:app`).

## Diagrama de montagem

```mermaid
flowchart TD
    ENV[".env (python-dotenv)"] --> CA["create_app()"]
    CA --> CHK{SECRET_KEY definida?}
    CHK -- Não --> ERR["RuntimeError — recusa subir"]
    CHK -- Sim --> APP["FastAPI(title='Apoio ao CS API', lifespan=lifespan)"]

    APP --> CORS["CORSMiddleware<br/>ALLOWED_ORIGINS · credentials · * métodos/headers"]
    APP --> DB["Base.metadata.create_all (garante tabelas, NÃO semeia)"]
    APP --> H["GET /api/health → {status: ok}"]

    APP --> R1["auth.router → /api/auth"]
    APP --> R2["clientes.router → /api/clientes"]
    APP --> R3["bonus.router → /api/bonus"]
    APP --> R4["comissoes.router → /api/comissoes"]
    APP --> R5["tarefas.router → /api/tarefas"]

    subgraph LIFE["lifespan (services/tarefas.py)"]
        S1["startup: gerar_tarefas_sistema() — 1 passada"]
        S2{DISABLE_TASK_LOOP=1?}
        S2 -- Sim --> NL["não agenda loop"]
        S2 -- Não --> LP["agenda loop asyncio de 24h"]
        S3["shutdown: task.cancel() + trata CancelledError"]
    end
    APP -. usa .-> LIFE
```

> Cada router já define o próprio prefixo `/api/...` — o `include_router` é
> chamado **sem** prefixo extra, para não duplicar.

## Variáveis de ambiente

| Variável | Obrigatória | Default | Para que serve |
|---|---|---|---|
| `SECRET_KEY` | **Sim** | — | Assina o JWT. Sem ela, `create_app()` levanta `RuntimeError` e o app não sobe. |
| `ALLOWED_ORIGINS` | Não | `http://localhost:5173` | Origens do CORS (lista separada por vírgula). |
| `DISABLE_TASK_LOOP` | Não | (vazio) | `=1` roda só a passada inicial do gerador e **não** agenda o loop de 24h (usado em testes). |
| `GEMINI_API_KEY` | Não* | — | Resumos de IA (usado em etapa de IA). |
| `ROBO_TOKEN` | Não* | — | Autenticação do agente Eproc (etapa futura). |
| `DATABASE_URL` | Não* | `sqlite:///./database.db` | Conexão do banco. Hoje o `database.py` ainda fixa o SQLite; a chave fica no `.env.example` para uso futuro. |

\* não consumida pela montagem do `main.py` nesta etapa; documentada em
`backend/.env.example`.

## Decisões / observações

- **Factory `create_app()`**: permite testar "SECRET_KEY ausente → RuntimeError"
  sem depender de cache de import (basta chamar a função após remover a env).
- **`create_all` no boot, sem seed**: o boot garante a existência das tabelas,
  mas **não** popula nada — `python seed.py` continua manual.
- **Lifespan importado de `services/tarefas.py`** (não reescrito aqui). Foi feita
  uma alteração cirúrgica no próprio lifespan para honrar `DISABLE_TASK_LOOP` e
  tratar `CancelledError` no shutdown — sem tocar em nenhuma lógica de negócio.
- **`GET /api/health`** é público (sem auth), para checagem de boot/monitoração.

## Navegação

- ⬅ [[Etapa 5 - Tarefas]]
- ➡ [[Etapa 6 - Dashboard e Equipe]]
