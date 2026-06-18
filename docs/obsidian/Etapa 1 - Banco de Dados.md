---
tags: [etapa-1, banco-de-dados]
etapa: 1
titulo: Banco de Dados
status: concluida
data: 2026-06-13
---

# Etapa 1 — Banco de Dados

Fundação de dados do **Apoio ao CS**: 10 tabelas SQLAlchemy (SQLite), seed
idempotente da tabela de comissões e o serviço `get_price`. Esquema conforme
**PROMPT_MESTRE, Seção 4**.

> **Nota de fonte:** o prompt da Etapa 1 citava `02 - Lógica das Funções por
> Etapa.md`, que não existe no repositório. A especificação usada foi a Seção 4
> do `PROMPT_MESTRE_Plataforma_Autonoma.md` (autossuficiente e consistente com a
> lista de tabelas/valores pedida).

## Diagrama ER

```mermaid
erDiagram
    users ||--o{ customers       : "cs_id (responsável)"
    users ||--o{ attendances     : "user_id"
    users ||--o{ bonus_entries   : "user_id"
    users ||--o{ quitacoes       : "cs_id"
    users ||--o{ tarefas         : "criador/responsável"
    customers ||--o{ attendances   : "customer_id"
    customers ||--o{ bonus_entries : "customer_id"
    customers ||--o{ quitacoes     : "customer_id"
    customers ||--o{ tarefas       : "cliente_id"
    customers ||--o{ robo_jobs       : "customer_id"
    customers ||--o{ robo_resultados : "customer_id"

    users {
        int id PK
        string email UK "@reisrevisional.com.br"
        string password_hash "bcrypt"
        string role "Gerente|Supervisor|CS"
        int level_cs "1-5 (só CS)"
        string nome_exibicao
        bool ativo "excluir = false"
    }
    customers {
        string id_datajuri PK "SEM CPF"
        string first_name "só 1º nome"
        string uf
        string contrato "Veículo|Empréstimo"
        string tem_processo "Sim|Não"
        string criticidade "Crítico|Atenção|Regular"
        string status "Ativo|Quitado"
        int cs_id FK
        int contatos
        int tentativas
        datetime ultimo_contato
    }
    commission_table {
        int id PK
        string acao UK
        float valor_nivel_1_2
        float valor_nivel_3_5
    }
    attendances {
        int id PK
        int user_id FK
        string customer_id FK
        datetime timestamp
        float commission_value "CONGELADO"
    }
    bonus_entries {
        int id PK
        int user_id FK
        string customer_id FK
        string tipo
        float valor "CONGELADO"
        datetime timestamp
        text ai_summary
    }
    quitacoes {
        int id PK
        string customer_id FK
        int cs_id FK
        float valor_original
        float valor_pago
        date data_boleto
        date data_pagamento
        string consulta_processo "Ativa|Excluída"
        bool protesto
        bool tarifas_restituiveis
        string mes_referencia
    }
    tarefas {
        int id PK
        int criador_id FK
        int responsavel_id FK
        string cliente_id FK
        string setor
        string classificacao
        string origem "manual|sistema"
        date prazo
        text detalhes
        bool concluida
    }
    robo_jobs {
        int id PK
        string customer_id FK
        string status "pendente|em_execucao|concluido|erro"
        datetime solicitado_em
        datetime concluido_em
        text mensagem_erro
    }
    robo_resultados {
        int id PK
        string customer_id FK
        string classe
        string data_movimentacao
        text descricao
        string triagem "NORMAL | 🚨 ALERTA VERMELHO"
        datetime recebido_em
    }
    system_settings {
        int id PK
        string key UK
        text value
    }
```

> `commission_table` e `system_settings` não têm FK — são consultadas pela lógica
> (ex.: `get_price`, prompt da IA), não relacionadas por chave.

## As tabelas (resumo)

- **users** — contas da equipe (1 Gerente, 1 Supervisor, até 12 CS). `level_cs`
  define o valor das comissões; "excluir" é `ativo=false` (preserva histórico).
- **customers** — carteira de clientes. Identificados por `id_datajuri` e só o
  primeiro nome; **nenhum dado pessoal sensível** (sem CPF/telefone/endereço).
- **commission_table** — fonte única dos valores de comissão por ação e faixa de
  nível (1–2 / 3–5). Nenhum valor é hardcoded no código.
- **attendances** — registros de atendimento; guardam o valor de comissão
  **congelado** no instante do lançamento.
- **bonus_entries** — ganhos extras (Quitação, ComentárioGoogle, etc.) com valor
  **congelado**; `ai_summary` guarda o resumo do áudio quando houver.
- **quitacoes** — quitações de contrato; economia e percentual são calculados na
  resposta da API, **nunca armazenados**.
- **tarefas** — organização do trabalho (manual ou gerada pelo sistema), com
  criador, responsável, setor, classificação e prazo.
- **robo_jobs** — fila de varreduras solicitadas ao agente Eproc (estado do job).
- **robo_resultados** — movimentações devolvidas pelo agente e sua triagem
  (NORMAL ou 🚨 ALERTA VERMELHO). Sem CPF.
- **system_settings** — configurações chave/valor (ex.: `ai_prompt`).

## Por que valores congelados?

`attendances.commission_value` e `bonus_entries.valor` são gravados **no momento
do lançamento** e nunca recalculados. Motivo: a `commission_table` pode mudar com
o tempo (o Gerente edita os valores). Se a comissão fosse calculada "ao vivo" a
partir da tabela atual, **alterar a tabela reescreveria o passado** — o extrato e
os ganhos já apurados de meses anteriores mudariam retroativamente. Congelar o
valor garante auditoria correta: cada lançamento preserva o que valia naquele dia.
Por isso `get_price` é chamado **uma vez**, na escrita, e o resultado é persistido.

## Navegação

- ⬅ [[Etapa 0 - Estrutura do Repositorio]]
- ➡ [[Etapa 2 - Autenticacao]]
