@echo off
title Apoio ao CS - BACKEND
echo ============================================
echo  Apoio ao CS - Backend (porta 8000)
echo ============================================
cd /d "c:\Users\Eduardo\OneDrive\Documents\Projeto Reis Revisional\backend"
set "PY=c:\Users\Eduardo\OneDrive\Documents\Projeto Reis Revisional\Apoio Ao CS\backend\venv\Scripts\python.exe"

echo.
echo [1/2] Populando o banco de demonstracao...
"%PY%" demo_seed.py
if errorlevel 1 goto erro

echo.
echo [2/2] Subindo o servidor... (deixe esta janela aberta)
echo      Quando aparecer "Uvicorn running", esta pronto.
echo.
"%PY%" -m uvicorn main:app --port 8000
goto fim

:erro
echo.
echo *** Algo deu errado ao popular o banco. Copie a mensagem acima. ***
:fim
echo.
pause
