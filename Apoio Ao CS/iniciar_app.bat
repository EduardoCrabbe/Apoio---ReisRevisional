@echo off
title Apoio CS - Iniciador do Servidor Local
echo ==================================================
echo.       Iniciando o Sistema Apoio CS...
echo ==================================================
echo.

:: 1. Iniciar o Backend em uma nova janela oculta/minimizada
echo [1/3] Iniciando o Servidor Eproc (Backend)...
cd backend
start "Backend Eproc" cmd /k "venv\Scripts\uvicorn.exe main:app --host 127.0.0.1 --port 8000"

:: Voltar para a raiz do Apoio Ao CS
cd ..

:: 2. Iniciar o Frontend (React) e abrir o navegador
echo [2/3] Iniciando o Painel de Controle (Frontend)...
cd frontend
start "Frontend Apoio CS" cmd /c "npm run dev"

echo.
echo [3/3] Tudo pronto!
echo O navegador será aberto automaticamente no endereco http://localhost:5175
echo.
echo ==================================================
echo IMPORTANTE: Para desligar o sistema, feche as 
echo janelinhas pretas (CMD) que abriram no fundo!
echo ==================================================
pause
