---
tags: [etapa-0, estrutura]
etapa: 0
titulo: Estrutura do Repositório
status: concluida
data: 2026-06-13
---

# Etapa 0 — Estrutura do Repositório

Reorganização do repositório do **Apoio ao CS** (Reis Revisional) para uma
estrutura definitiva, separando com clareza as três frentes do produto
(backend, frontend e o agente de automação) e a documentação viva. Nenhuma
lógica existente foi apagada — apenas movida.

## Diagrama da estrutura

```
Projeto Reis Revisional/
├── backend/                  # API oficial — FastAPI + SQLite/SQLAlchemy
│   ├── main.py               # App FastAPI (rotas, CORS, StaticFiles do React)
│   ├── models.py             # Modelos SQLAlchemy (USERS, CUSTOMERS, ATTENDANCES)
│   ├── database.py           # Engine/Session do SQLAlchemy
│   ├── auth.py               # Registro/login (domínio @reisrevisional.com.br)
│   ├── areacs_routes.py      # Rotas da Área CS
│   ├── gemini_service.py     # Resumo de atendimentos via Gemini
│   ├── eproc_scraper.py      # Integração do scraper (importado por main.py)
│   ├── requirements.txt
│   ├── .env.example          # Modelo de variáveis de ambiente
│   └── _legado/              # Código antigo só para referência (DEPRECATED)
│       ├── app.py            # Backend do antigo platform_manager
│       └── README.md
│
├── frontend/                 # SPA React + Vite (Glassmorphism) + Electron
│   ├── src/
│   │   ├── pages/            # Login, Dashboard, AreaCS, EprocTracker, ...
│   │   ├── components/       # Sidebar, ...
│   │   └── assets/
│   ├── public/
│   ├── main.cjs              # Bootstrap do Electron
│   ├── vite.config.js
│   └── package.json
│
├── agente-eproc/             # Agente autônomo (scraper do Eproc TJSP)
│   ├── scraper.py            # EprocScraper (Context Manager, anti-bot)
│   ├── qa_tester.py          # Fail-Fast: valida planilha e portal
│   └── test_scraper.py
│
├── docs/
│   └── obsidian/             # Documentação viva (vault Obsidian) — esta série
│       └── Etapa 0 - Estrutura do Repositorio.md
│
└── .gitignore                # Ignora .env, *.db, venv, node_modules, etc.
```

> Pastas regeneráveis (`venv/`, `node_modules/`, `dist/`, `build/`,
> `__pycache__/`, `release/`) e dados de runtime (`*.db`, `uploads/`,
> planilhas, `page_source*.html`) ficam fora do versionamento.

## Justificativa de cada pasta

- **`backend/`** — destino do **backend oficial** (FastAPI + SQLite/SQLAlchemy),
  antes em `Apoio Ao CS/backend`. Concentra a API, os modelos de dados e a
  autenticação. O `eproc_scraper.py` permanece aqui porque é **importado** por
  `main.py` (`from eproc_scraper import EprocScraper`); separá-lo quebraria o
  backend.
- **`backend/_legado/`** — guarda o `app.py` do antigo `platform_manager` como
  **referência marcada DEPRECATED**. Não é importado nem executado. Suas rotas
  úteis serão reimplementadas sobre a stack oficial nas próximas etapas.
- **`frontend/`** — a SPA React + Vite (empacotada como app desktop via
  Electron). Isolada do backend para ter build, dependências e deploy próprios.
- **`agente-eproc/`** — o **worker de automação** (scraper do Eproc TJSP). Roda
  de forma independente da API e lida com dados sensíveis (CPFs em planilha
  local), respeitando a segregação LGPD — por isso fica em pasta separada.
- **`docs/obsidian/`** — **documentação viva** em formato Obsidian. Abriga esta
  série de notas "Etapa N" que documenta a reconstrução do projeto passo a passo.

## Próxima etapa

[[Etapa 1 - Banco de Dados]]
