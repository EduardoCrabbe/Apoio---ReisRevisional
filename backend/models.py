"""
Modelos SQLAlchemy do "Apoio ao CS" — Etapa 1 (Banco de Dados).

Esquema conforme PROMPT_MESTRE, Seção 4. Proibições invioláveis aplicadas:
  - Nenhuma tabela contém CPF, nome completo, telefone ou endereço de cliente.
    Clientes são identificados por `id_datajuri` e apenas o primeiro nome.
  - `attendances.commission_value` e `bonus_entries.valor` são CONGELADOS no
    momento do lançamento (gravados pela camada de serviço, nunca recalculados).

Decisão de projeto: nesta etapa NÃO declaramos `relationship()` ORM — apenas as
chaves estrangeiras (colunas). Isso evita ambiguidade de mapper em tabelas com
duas FKs para `users` (tarefas, quitacoes) e mantém a fundação simples. As
relações são adicionadas por etapa, conforme as rotas precisarem. Ver docs/DECISOES.md.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)

from database import Base


def _utcnow():
    """UTC *naive* (sem a deprecação de datetime.utcnow), consistente com a
    aritmética de janela de 72h que compara datetimes naive."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)  # só @reisrevisional.com.br
    password_hash = Column(String, nullable=False)                   # bcrypt, nunca texto puro
    role = Column(String, nullable=False)                            # Gerente | Supervisor | CS
    level_cs = Column(Integer, nullable=True)                        # 1–5, apenas para CS
    nome_exibicao = Column(String, nullable=True)
    ativo = Column(Boolean, default=True, nullable=False)            # "excluir" = ativo=False


class Customer(Base):
    __tablename__ = "customers"

    # PK textual = código DataJuri. SEM CPF/nome completo/telefone/endereço.
    id_datajuri = Column(String, primary_key=True, index=True)
    first_name = Column(String, nullable=True)                       # apenas primeiro nome (LGPD)
    uf = Column(String, nullable=True)
    contrato = Column(String, nullable=True)                         # Veículo | Empréstimo
    tem_processo = Column(String, default="Não", nullable=False)     # Sim | Não
    criticidade = Column(String, default="Regular", nullable=False)  # Crítico | Atenção | Regular
    status = Column(String, default="Ativo", nullable=False)         # Ativo | Quitado
    cs_id = Column(Integer, ForeignKey("users.id"), nullable=True)   # CS responsável
    contatos = Column(Integer, default=0, nullable=False)
    tentativas = Column(Integer, default=0, nullable=False)
    ultimo_contato = Column(DateTime, nullable=True)


class CommissionTable(Base):
    """Fonte ÚNICA dos valores de comissão. Nada de valor hardcoded no código."""

    __tablename__ = "commission_table"

    id = Column(Integer, primary_key=True, index=True)
    acao = Column(String, unique=True, index=True, nullable=False)
    valor_nivel_1_2 = Column(Float, nullable=False)                  # níveis 1 e 2
    valor_nivel_3_5 = Column(Float, nullable=False)                  # níveis 3, 4 e 5


class Attendance(Base):
    __tablename__ = "attendances"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    customer_id = Column(String, ForeignKey("customers.id_datajuri"), nullable=False)
    timestamp = Column(DateTime, default=_utcnow, nullable=False)
    commission_value = Column(Float, nullable=False)                 # CONGELADO no lançamento


class BonusEntry(Base):
    __tablename__ = "bonus_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    customer_id = Column(String, ForeignKey("customers.id_datajuri"), nullable=True)
    tipo = Column(String, nullable=False)                            # ação da commission_table
    valor = Column(Float, nullable=False)                            # CONGELADO no lançamento
    timestamp = Column(DateTime, default=_utcnow, nullable=False)
    ai_summary = Column(Text, nullable=True)


class Quitacao(Base):
    __tablename__ = "quitacoes"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(String, ForeignKey("customers.id_datajuri"), nullable=False)
    cs_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    valor_original = Column(Float, nullable=False)
    valor_pago = Column(Float, nullable=False)
    data_boleto = Column(Date, nullable=True)
    data_pagamento = Column(Date, nullable=True)
    consulta_processo = Column(String, default="Ativa", nullable=False)  # Ativa | Excluída
    protesto = Column(Boolean, default=False, nullable=False)
    tarifas_restituiveis = Column(Boolean, default=False, nullable=False)  # Sim/Não, não valor
    mes_referencia = Column(String, nullable=True)                   # "AAAA-MM"
    # Economia e percentual NÃO são armazenados — calculados na resposta da API.


class Tarefa(Base):
    __tablename__ = "tarefas"

    id = Column(Integer, primary_key=True, index=True)
    criador_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    responsavel_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    # cliente_id: adicionado (nullable) para suportar a regra do gerador automático
    # que não duplica tarefa aberta do mesmo cliente (Seção 5). Ver docs/DECISOES.md.
    cliente_id = Column(String, ForeignKey("customers.id_datajuri"), nullable=True)
    setor = Column(String, nullable=False)        # Mediação/Negociação, Administrativo, Jurídico, Gestão, Atendimento
    classificacao = Column(String, nullable=False)  # REGULAR | CRÍTICA/URGENTE | LEMBRETE
    origem = Column(String, default="manual", nullable=False)        # manual | sistema
    prazo = Column(Date, nullable=True)
    detalhes = Column(Text, nullable=True)
    concluida = Column(Boolean, default=False, nullable=False)


class RoboJob(Base):
    __tablename__ = "robo_jobs"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(String, ForeignKey("customers.id_datajuri"), nullable=False)
    status = Column(String, default="pendente", nullable=False)      # pendente | em_execucao | concluido | erro
    solicitado_em = Column(DateTime, default=_utcnow, nullable=False)
    concluido_em = Column(DateTime, nullable=True)
    mensagem_erro = Column(Text, nullable=True)


class RoboResultado(Base):
    __tablename__ = "robo_resultados"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(String, ForeignKey("customers.id_datajuri"), nullable=False)
    classe = Column(String, nullable=True)
    data_movimentacao = Column(String, nullable=True)               # texto vindo do tribunal
    descricao = Column(Text, nullable=True)
    triagem = Column(String, nullable=False)                        # NORMAL | "🚨 ALERTA VERMELHO"
    recebido_em = Column(DateTime, default=_utcnow, nullable=False)


class SystemSettings(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)    # ex.: "ai_prompt"
    value = Column(Text, nullable=True)
