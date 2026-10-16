@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title Hoehlenspiel

rem ---- Einstellungen aus .env laden (wird beim ersten Start aus .env.example erzeugt) ----
if not exist ".env" copy ".env.example" ".env" >nul
for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do set "%%A=%%B"
if not defined PORT set "PORT=8000"
if not defined LLAMA_PORT set "LLAMA_PORT=8080"

rem ---- llama-server starten (ab Etappe 5 noetig, in .env mit LLAMA_START=1 einschalten) ----
if "%LLAMA_START%"=="1" (
  if exist "%LLAMA_SERVER_EXE%" (
    echo Starte llama-server auf Port %LLAMA_PORT% ...
    start "llama-server" "%LLAMA_SERVER_EXE%" -m "%LLAMA_MODEL_PATH%" --port %LLAMA_PORT%
  ) else (
    echo llama-server nicht gefunden: %LLAMA_SERVER_EXE%  ^(Pfad in .env pruefen^)
  )
) else (
  echo llama-server wird nicht gestartet ^(LLAMA_START=0 in .env^)
)

rem ---- Python-Umgebung einrichten ----
if not exist ".venv\Scripts\python.exe" (
  echo Richte Python-Umgebung ein ...
  where py >nul 2>nul && (py -3 -m venv .venv) || (python -m venv .venv)
  if not exist ".venv\Scripts\python.exe" (
    echo Python wurde nicht gefunden. Bitte Python 3.10 oder neuer installieren.
    pause
    exit /b 1
  )
)
".venv\Scripts\python.exe" -m pip install -q -r requirements.txt

rem ---- Browser mit Test-Chat oeffnen, dann Server starten ----
start "" cmd /c "timeout /t 2 >nul & start http://localhost:%PORT%/?testchat=1"
".venv\Scripts\python.exe" server\main.py
pause
