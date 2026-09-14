@echo off
title Atualizar e Reiniciar Spooler Monitor - Ao Ponto
color 0A
cd /d "%~dp0"

:: Verificar permissao de Administrador para garantir acesso ao Spool e impressoras
if "%1"=="ELEVATED" goto :EXECUTAR
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo Solicitando privilegios de Administrador...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -ArgumentList 'ELEVATED' -Verb RunAs" 2>nul
    exit /b
)

:EXECUTAR
echo =============================================================
echo     ATUALIZANDO SPOOLER MONITOR BALCAO - AO PONTO CARNES
echo     Suporte Completo: Comidas Brasileiras, Burgers e Carnes
echo =============================================================
echo.
echo [1/5] Encerrando processos antigos do monitor...
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/5] Baixando scripts mais recentes do repositorio oficial...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/lmarinho0312/aoprastreador/main/agent/spooler-monitor.js' -OutFile 'spooler-monitor.js'; Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/lmarinho0312/aoprastreador/main/agent/comanda-parser.js' -OutFile 'comanda-parser.js'"

echo [3/5] Garantindo retencao de comandas (KeepPrintedJobs) em todas as impressoras...
powershell -Command "Get-Printer | Set-Printer -KeepPrintedJobs:1" >nul 2>&1

echo [4/5] Limpando cache antigo para sincronizacao imediata...
if exist processed_cache.json del /f /q processed_cache.json >nul 2>&1

echo [5/5] Reiniciando Spooler Monitor em segundo plano...
schtasks /run /tn "SpoolerMonitorBalcao" >nul 2>&1
wscript.exe "%~dp0iniciar_oculto.vbs"

echo.
echo =============================================================
echo   [SUCESSO] MONITOR ATUALIZADO COM SUCESSO!
echo   - 99Food Comidas Brasileiras: ATIVA
echo   - 99Food Burgers e Sanduiches: ATIVA
echo   - 99Food Ao Ponto Carnes:     ATIVA
echo   - iFood e Cardapio Web:       ATIVOS
echo =============================================================
echo.
timeout /t 5 >nul
exit /b
