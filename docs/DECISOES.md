# Decisões de Projeto

Registro das escolhas tomadas quando a especificação não detalhou algo (conforme
orientação do PROMPT_MESTRE: "escolha a opção mais simples e documente").

## Etapa 1 — Banco de Dados (2026-06-13)

- **Fonte da especificação:** o prompt citava `docs/obsidian/02 - Lógica das
  Funções por Etapa.md`, inexistente no repositório. Usou-se a **Seção 4 do
  PROMPT_MESTRE** (modelo de dados), consistente com a lista de tabelas e valores
  pedida.

- **Tipos não especificados em `quitacoes`:**
  - `protesto` → `Boolean` (default `False`) — interpretado como "houve protesto?".
  - `tarifas_restituiveis` → `Boolean` (default `False`) — flag Sim/Não indicando
    se há tarifas passíveis de restituição (não é valor monetário).
  - `data_boleto` / `data_pagamento` → `Date` (datas de calendário).
  - `mes_referencia` → `String` no formato `"AAAA-MM"`.

- **`tarefas.cliente_id` (adicionado):** a Seção 4 não lista vínculo de tarefa
  com cliente, mas a Seção 5 exige "não duplicar tarefa aberta do mesmo cliente"
  no gerador automático. Adicionou-se `cliente_id` (FK `customers`, **nullable**)
  para suportar essa regra sem quebrar tarefas manuais sem cliente.

- **Assinatura de `get_price(level, acao, db)`:** mantida a ordem `(level, acao)`
  da especificação; o parâmetro `db` (Session) foi acrescentado por ser
  necessário para ler a `commission_table` do banco.

- **Sem `relationship()` ORM nesta etapa:** apenas as colunas FK foram definidas.
  Evita ambiguidade de mapper em tabelas com duas FKs para `users` (`tarefas`,
  `quitacoes`) e mantém a fundação simples; relações entram por etapa, conforme
  as rotas precisarem.

- **Esquema legado substituído:** o antigo `backend/models.py` (tabelas
  `eproc_clients` e `clientes_cs`) foi substituído. A tabela `eproc_clients`
  continha uma coluna **`cpf`**, violação direta da Proibição #1 — removida.
  As rotas legadas (`main.py`, `areacs_routes.py`) que referenciavam esses
  modelos serão reimplementadas nas próximas etapas sobre o esquema novo.

## Etapa 2 — Autenticação (2026-06-13)

- **E-mail como `str` (não `EmailStr`):** evita depender de `email-validator`
  (ausente no venv). A regra de domínio `@reisrevisional.com.br` (e a unicidade)
  é validada no router; e-mail malformado cai no 403 de domínio.

- **bcrypt direto (não passlib):** usa o pacote `bcrypt` diretamente para
  hash/verify. **Confirmado neste venv:** `passlib 1.7.4` falha ao ler a versão
  do `bcrypt 5.0` (`AttributeError __about__`) e aborta o hash com
  `ValueError: password cannot be longer than 72 bytes`. Como é o mesmo algoritmo
  que o passlib usaria por baixo, usamos `bcrypt` direto e **truncamos a senha em
  72 bytes** (limite do bcrypt) de forma consistente em hash e verify.

- **`SECRET_KEY` obrigatória (verificação lazy):** `deps.get_secret_key()`
  levanta `RuntimeError` claro se a variável não existir. A recusa de *startup*
  da aplicação será amarrada quando o `main.py` for reconstruído; por ora a
  autenticação simplesmente não opera sem a chave.

- **`HTTPBearer(auto_error=False)`:** token ausente vira **401** (e não o 403
  padrão do FastAPI), conforme a spec (`get_current_user` → 401;
  `require_role` → 403 apenas para papel insuficiente).

- **`auth.py` legado removido:** o módulo único `backend/auth.py` foi apagado
  (colisão de nome com o novo pacote `backend/auth/`). Sua lógica de
  register/login foi reimplementada no pacote, com JWT; o original está no
  histórico git.
