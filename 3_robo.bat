@echo off
title Apoio ao CS - ROBO (agente Eproc)
echo ============================================
echo  Apoio ao CS - Robo Eproc (MODO SIMULADO)
echo ============================================
echo  Precisa do backend (1_backend.bat) ja rodando.
echo ============================================
cd /d "c:\Users\Eduardo\OneDrive\Documents\Projeto Reis Revisional\agente-eproc"
set "PY=c:\Users\Eduardo\OneDrive\Documents\Projeto Reis Revisional\Apoio Ao CS\backend\venv\Scripts\python.exe"
echo.
"%PY%" agente.py
echo.
echo Pronto. Atualize a tela "Alertas Criticos" no navegador.
pause
