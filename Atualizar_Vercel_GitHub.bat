@echo off
title Atualizar Sistema na Nuvem (Vercel e GitHub)
color 0B
cd /d "%~dp0"

echo =============================================================
echo       ATUALIZAR SISTEMA EM PRODUCAO (VERCEL E GITHUB)
echo =============================================================
echo.
echo Escolha uma opcao:
echo.
echo [1] Enviar via GitHub (git push origin main)
echo [2] Fazer login no Vercel CLI e publicar (npx vercel login)
echo [3] Fazer deploy direto na Vercel (npx vercel --prod)
echo [4] Inserir Token de Acesso da Vercel
echo [5] Sair
echo.
set /p opcao="Digite a opcao (1-5): "

if "%opcao%"=="1" (
    echo.
    echo Enviando alteracoes para o GitHub...
    git push origin main
)

if "%opcao%"=="2" (
    echo.
    echo Abrindo login da Vercel...
    cmd /c npx vercel login
    cmd /c npx vercel --prod --yes
)

if "%opcao%"=="3" (
    echo.
    echo Publicando na Vercel em producao...
    cmd /c npx vercel --prod --yes
)

if "%opcao%"=="4" (
    echo.
    set /p vtoken="Cole seu Token da Vercel aqui: "
    cmd /c npx vercel --prod --yes --token %vtoken%
)

echo.
echo =============================================================
pause
