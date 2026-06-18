# Autenticação (`backend/auth/`)

Pacote de autenticação da **Etapa 2**.

- `schemas.py` — modelos Pydantic (entrada/saída da API).
- `deps.py` — hashing bcrypt, emissão/validação de JWT (12h), `get_current_user`
  (401) e `require_role(...)` (403).
- `router.py` — rotas `POST /api/auth/register`, `POST /api/auth/login`,
  `GET /api/auth/me`.
- `migrate_passwords.py` — migração de senhas legadas → bcrypt (ver abaixo).

## Regras de negócio

- E-mail apenas do domínio `@reisrevisional.com.br` (senão **403**).
- O **1º usuário** registrado vira **Gerente** automaticamente.
- Limites por papel: **1 Gerente, 1 Supervisor, 12 CS** (excedente → **400**).
- "Excluir" usuário = `ativo=false` (histórico preservado); usuário inativo não
  loga.
- Erro de login é **sempre genérico**: `"E-mail ou senha incorretos"` (401), sem
  revelar se o e-mail existe.
- Login devolve **JWT de 12h** com `sub` (id), `role` e `level_cs`.
- `SECRET_KEY` é obrigatória (vem do `.env`); sem ela a autenticação não opera.

## Script de migração de senhas (roda UMA vez)

`migrate_passwords.py` converte para bcrypt qualquer senha que ainda não esteja
em formato bcrypt.

> **Na prática, aqui é um no-op.** O banco atual usa o novo schema e começa
> **limpo, sem usuários** — o `seed.py` apenas cria as tabelas e popula a
> `commission_table`. O script existe só para o caso de importar um banco legado
> com senhas em texto puro.

Rodar (a partir de `backend/`):

```bash
python -m auth.migrate_passwords
```
