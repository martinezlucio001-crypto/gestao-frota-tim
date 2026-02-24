@echo off
echo ===================================================
echo   INICIANDO SISTEMA DE AUDITORIA LOCAL (TIM)
echo ===================================================

echo [1/3] Iniciando Servidor Python (Backend)...
start "Motor de Auditoria (Python)" /min python local_server.py
if errorlevel 1 (
    echo [ERRO] Falha ao iniciar Python. Verifique se o Python esta instalado e no PATH.
    pause
    exit /b
)

echo [2/3] Aguardando motor iniciar...
timeout /t 5 >nul

echo [3/3] Iniciando Interface Web...
echo (Se ja estiver rodando, pode fechar essa janela)
echo.
echo ACESSE NO NAVEGADOR: http://localhost:5175/despacho-auditoria
echo.
call npm run dev

pause
