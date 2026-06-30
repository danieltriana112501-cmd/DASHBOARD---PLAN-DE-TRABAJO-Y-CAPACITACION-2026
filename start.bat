@echo off
cd /d "%~dp0"
echo Iniciando CGE Dashboard en http://localhost:8080 ...
start "" cmd /c "timeout /t 2 >nul && start http://localhost:8080"
npx --yes serve -l 8080
