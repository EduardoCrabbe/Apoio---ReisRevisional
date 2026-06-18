# Agente Eproc — instalação na máquina do CS

Worker **local-primeiro**: o CS roda o agente na própria máquina, ele consulta o
Eproc, grava o resultado **localmente** e, em best-effort, envia ao servidor
apenas os campos seguros. **O CPF e o número do processo nunca saem desta
máquina.** Se o servidor estiver fora do ar, o trabalho continua e os envios
ficam pendentes para o próximo ciclo.

## O que fica nesta pasta

- `agente.py` — o agente (empacotável com PyInstaller).
- `scraper.py`, `eproc_scraper.py`, `qa_tester.py` — o scraper Eproc existente.
- `config.example.json` — modelo de configuração (copie para `config.json`).
- `planilha_exemplo.xlsx` — planilha de exemplo (colunas: id_datajuri, cpf, processo).
- Gerados ao rodar: `resultados_local.db`, `relatorio_dia.html`,
  `pendentes_local.json`, `agente.log`.

## Instalação

1. Instale o Python 3.11+ na máquina do CS.
2. Instale as dependências:
   ```
   pip install openpyxl undetected-chromedriver selenium
   ```
   (No **modo simulado** basta `openpyxl`.)
3. Copie `config.example.json` para `config.json` e preencha:
   - `SERVER_URL` — endereço do servidor (ex.: `https://apoio.suaempresa.com.br`).
   - `ROBO_TOKEN` — **o mesmo** valor configurado no `.env` do servidor.
   - `PLANILHA_DIA` — caminho do `.xlsx` do dia (colunas: id_datajuri, cpf, processo).
   - `MODO_SIMULADO` — `1` para demonstração (sem rede); `0` para Eproc real.

## Uso

```
python agente.py                 # importa a planilha, consulta, grava local e envia
python agente.py encerrar-dia    # apaga a planilha importada e os resultados locais
```

- Acompanhe o andamento abrindo `relatorio_dia.html` (atualizado a cada ciclo).
- Para empacotar: `pyinstaller --onefile agente.py` (gera um `.exe`).

## Privacidade (LGPD)

- O envio ao servidor (`POST /api/robo/resultado`) contém **somente**
  `{id_datajuri, classe, data_movimentacao, descricao, triagem}`.
- **Nunca** são enviados CPF, número do processo ou nome. O servidor inclusive
  **rejeita** (HTTP 422) qualquer payload que contenha um campo `cpf`.
- CPF/processo ficam apenas no `resultados_local.db` desta máquina; o
  `relatorio_dia.html` também não os exibe.

## Demo ponta a ponta

Os `id_datajuri` da `planilha_exemplo.xlsx` devem **bater com os do `demo_seed`**
do servidor, para o fluxo alerta→tarefa aparecer no painel. O agente garante que
ao menos um cliente gere **🚨 ALERTA VERMELHO** no modo simulado.
