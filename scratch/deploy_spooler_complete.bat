@echo off
echo === Commit, Push e Deploy da Transicao para Spooler Monitor ===
echo.

git add .
git commit -m "feat: captura automatica de pedidos via Spooler Monitor (Epson TM-T20), webhook seguro com anti-duplicacao, migracao de banco e fluxo de retirada pelo motoboy"

echo.
echo === Enviando para GitHub ===
git push origin main

echo.
echo === Realizando Deploy em Producao na Vercel ===
cmd /c "C:\Users\Usuario\.gemini\antigravity\brain\e9aed6eb-ebb5-463e-80b4-7fa4eb35fbe3\scratch\vercel_deploy_cloud.bat" 2>&1

echo.
echo === Concluido com Sucesso! ===
