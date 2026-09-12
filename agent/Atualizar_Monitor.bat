@echo off
title Atualizar e Reiniciar Spooler Monitor
color 0A
cd /d "%~dp0"

echo =============================================================
echo          ATUALIZANDO SPOOLER MONITOR BALCAO (OFICIAL)
echo =============================================================
echo.
echo [1/4] Encerrando processos antigos em segundo plano...
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/4] Baixando scripts mais recentes do repositorio...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/lmarinho0312/aoprastreador/main/agent/spooler-monitor.js' -OutFile 'spooler-monitor.js'; Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/lmarinho0312/aoprastreador/main/agent/comanda-parser.js' -OutFile 'comanda-parser.js'"

echo [3/4] Limpando cache antigo que bloqueava a 99Food...
if exist processed_cache.json del /f /q processed_cache.json >nul 2>&1

echo [4/4] Reiniciando Spooler Monitor protegido...
schtasks /run /tn "SpoolerMonitorBalcao" >nul 2>&1
wscript.exe "%~dp0iniciar_oculto.vbs"

echo.
echo =============================================================
echo   [SUCESSO] MONITOR ATUALIZADO E REINICIADO COM SUCESSO!
echo =============================================================
echo.
timeout /t 4 >nul
exit /b
