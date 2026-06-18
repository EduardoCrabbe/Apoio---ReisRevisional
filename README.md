# Plataforma Apoio ao CS (Reis Revisional) - V5 Web

A plataforma **Apoio ao CS** é um ecossistema completo para a gestão da equipe de Customer Success (CS) da Reis Revisional. A partir da V5, o sistema foi transformado em uma **Aplicação Web (React + FastAPI)** que une gestão de performance, relatórios financeiros em tempo real e automação nativa contra portais jurídicos (Eproc-SP).

## 🚀 Como Executar em um Computador Novo

Para rodar este sistema do zero em qualquer computador com Windows, criamos um script que faz tudo por você.

### Pré-requisitos
1. **Python 3.10+** (Com o `pip` incluso e adicionado ao PATH do Windows)
2. **Node.js** (Versão 18+ com NPM)
3. **Google Chrome** (Para a automação RPA funcionar em segundo plano)

### Iniciando com 1 Clique
Basta dar um duplo clique no arquivo **`setup_e_iniciar.bat`** localizado na raiz desta pasta.

**O que ele faz automaticamente:**
1. Cria e configura o ambiente virtual Python (`venv`).
2. Instala todas as dependências da automação e do servidor (FastAPI, DrissionPage, SQLAlchemy).
3. Liga o servidor do Backend na porta `8000`.
4. Instala as dependências de interface (Vite, Tailwind, React).
5. Inicia a interface gráfica e abre o navegador no painel.

---

## 🏛️ Arquitetura do Sistema

O projeto adota uma arquitetura Cliente-Servidor (Frontend + Backend), focado em estabilidade, modernidade estética (*Glassmorphism*) e eficiência no banco de dados SQLite nativo.

### 1. Backend (Python + FastAPI)
Diretório: `Apoio Ao CS/backend/`

O motor principal. Ele não só serve os dados para as telas, como também roda o robô de extração de dados.
- **`main.py` e `patch_routes.py`**: Arquivos principais que rodam as APIs, calculam as comissões, métricas e o motor de prioridades.
- **`areacs_routes.py`**: Rotas exclusivas de gerenciamento de contatos, quitações, e o sistema importador de planilhas de base (`Clientes.xlsx`).
- **`eproc_scraper.py`**: O Robô (RPA). Utiliza a biblioteca `DrissionPage` para controlar o Google Chrome por debaixo dos panos via protocolo *CDP (Chrome DevTools)*, superando o Cloudflare (Captcha invisível) que bloqueia robôs comuns (como o Selenium).
- **`database.db`**: Banco de dados relacional oficial. Armazena usuários, clientes importados, comissionamentos (`Attendance`) e histórico da triagem do Eproc.

### 2. Frontend (React + Vite)
Diretório: `Apoio Ao CS/frontend/`

A interface gráfica de altíssimo padrão, dividida em dois perfis de acesso (Gerente/Supervisor e Operador CS).
- **`Dashboard.jsx`**: Painel central. Possui gráficos automáticos (Pizza, Barras) e um *Radar de Prioridades* que calcula as metas e prazos (7 dias para clientes Críticos, 15 para Atenção) e atualiza os ganhos financeiros em tempo real.
- **`AreaCS.jsx` (Meus Clientes)**: Funil de atendimento. Quando o CS clica em "Atender", o frontend sinaliza o backend para somar contatos e depositar R$ 1,50 (ajustável) na conta do colaborador.
- **`Configuracoes.jsx`**: Tela Gerencial. Permite ao gerente enviar e atualizar a base corporativa lendo automaticamente o arquivo `Clientes.xlsx`.

---

## 🔒 Regras de Negócio Implementadas

1. **Upload Inteligente:** A importação da planilha lida automaticamente com acentuações ("Código DJ") e impede duplicação de dados, mesclando IDs.
2. **Triagem de Processos:** O EprocTracker lê e varre eventos processuais dos TJs. Quando ele localiza a classe "Busca e Apreensão", o sistema gera um Alerta Crítico vermelho interativo piscando na tela do Gerente.
3. **Comissionamento Automático:** Nenhum valor ou cálculo é gerado na tela. Tudo é oficializado no cofre do servidor, travando fraudes. Se o atendimento for desfeito ("Tentativa/Desfazer"), o valor gerado é revogado no cofre.
4. **Escalabilidade Multi-Usuários:** Base preparada para expandir para múltiplos operadores simultâneos conectados ao mesmo servidor.

---
*Desenvolvido e documentado exclusivamente para Reis Revisional.*
