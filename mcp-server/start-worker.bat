@echo off
cd /d "%~dp0"

:loop
echo [%date% %time%] Arrancando el worker de NEXUS... >> worker.log
call npm run worker >> worker.log 2>&1
echo [%date% %time%] El worker se cortó, reintentando en 10s... >> worker.log
timeout /t 10 /nobreak >nul
goto loop
