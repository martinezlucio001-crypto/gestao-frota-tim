@echo off
title Sistema TIM - Auditoria
cd /d "%~dp0"
echo ===================================================
echo   INICIANDO SISTEMA DE AUDITORIA TIM
echo ===================================================
echo.
echo [1/4] Verificando dependencias...
pip install flask flask-cors pdfplumber google-cloud-firestore google-auth-oauthlib >nul 2>&1

echo [2/4] Iniciando Servidor Local...
start "Motor Local" python local_server.py
if errorlevel 1 goto error

echo [3/4] Aguardando motor...
timeout /t 3 >nul

echo [4/4] Abrindo Sistema...
start http://localhost:5175/

echo.
echo ===================================================
echo   SISTEMA RODANDO
echo ===================================================
echo   NAO FECHE ESTA JANELA ENQUANTO USAR O SISTEMA.
echo ===================================================
echo.

call npm run dev
goto end

:error
echo.
echo [ERRO] Nao foi possivel iniciar o servidor Python.
echo Verifique se o Python esta instalado.
pause
exit /b

:end
pause
