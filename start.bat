@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Hoehlenspiel - llama-server + Spielserver

rem ================================================================
rem  Einstellungen: erst .env.example als Vorgabe, dann .env
rem ================================================================
for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env.example") do set "%%A=%%B"
if exist ".env" for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do set "%%A=%%B"

if not "%LLAMA_START%"=="1" goto skip_llm
if not "%LLM_ENABLED%"=="1" goto skip_llm

rem ================================================================
rem  1. llama-server: laeuft schon einer? Dann mitnutzen.
rem ================================================================
curl -s -o nul -w "%%{http_code}" http://127.0.0.1:%LLAMA_PORT%/health 2>nul | findstr "200" >nul
if not errorlevel 1 goto llm_running

if not exist "%LLAMA_MODEL_PATH%" goto err_model

if exist "%LLAMA_SERVER_EXE%" goto use_cuda
set "EXE=llama-server"
set "EXTRA=-np 1"
set "ART=llama-server aus PATH, ohne MTP"
where llama-server >nul 2>&1
if errorlevel 1 goto err_exe
goto start_llm

:use_cuda
set "EXE=%LLAMA_SERVER_EXE%"
set "EXTRA=%LLAMA_EXTRA%"
set "ART=CUDA-Build"

:start_llm
echo Modell: %LLAMA_MODEL_PATH%
echo Server: %ART%
echo Starte llama-server ...
start "llama-server" "%EXE%" -m "%LLAMA_MODEL_PATH%" -c %LLAMA_CTX% -ngl %LLAMA_NGL% --jinja --host 127.0.0.1 --port %LLAMA_PORT% %EXTRA%

set /a TRIES=0
:wait
timeout /t 2 /nobreak >nul
set /a TRIES+=1
curl -s -o nul -w "%%{http_code}" http://127.0.0.1:%LLAMA_PORT%/health 2>nul | findstr "200" >nul
if not errorlevel 1 goto llm_ready
if %TRIES% GEQ 120 goto err_timeout
<nul set /p "=."
goto wait

:llm_running
echo llama-server laeuft bereits auf Port %LLAMA_PORT%, wird mitgenutzt.
goto venv

:llm_ready
echo.
echo llama-server bereit auf Port %LLAMA_PORT%.
goto venv

:skip_llm
echo llama-server wird nicht gestartet (LLAMA_START oder LLM_ENABLED nicht 1).

rem ================================================================
rem  2. Python-Umgebung (nur beim ersten Mal komplett)
rem ================================================================
:venv
if exist ".venv\Scripts\python.exe" goto venv_ok
echo Erstelle virtuelle Umgebung ...
python -m venv .venv
if errorlevel 1 goto err_python
:venv_ok
".venv\Scripts\python.exe" -m pip install -q -r requirements.txt
if errorlevel 1 goto err_pip

rem ================================================================
rem  3. Browser mit Test-Chat oeffnen, Spielserver starten
rem ================================================================
start "" cmd /c "timeout /t 2 >nul & start http://localhost:%PORT%/?testchat=1"
".venv\Scripts\python.exe" server\main.py
pause
endlocal
exit /b 0

:err_model
echo [FEHLER] Modell nicht gefunden:
echo          %LLAMA_MODEL_PATH%
echo Pfad in .env pruefen oder LLAMA_START=0 setzen.
pause
exit /b 1

:err_exe
echo [FEHLER] Weder %LLAMA_SERVER_EXE% noch llama-server im PATH gefunden.
pause
exit /b 1

:err_timeout
echo.
echo [FEHLER] llama-server nach 240 s nicht bereit. Ausgabe im Fenster "llama-server" pruefen.
echo Haeufigste Ursache: zu wenig freier VRAM.
pause
exit /b 1

:err_python
echo [FEHLER] Python nicht gefunden. Bitte Python 3.10 oder neuer installieren.
pause
exit /b 1

:err_pip
echo [FEHLER] Installation der Pakete fehlgeschlagen.
pause
exit /b 1
