@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Hoehlenspiel teilen - oeffentlicher Link

rem ================================================================
rem  Zeigt das laufende Spiel ueber einen Cloudflare-Tunnel im Internet.
rem  Vorher start.bat starten. Fenster schliessen beendet den Link.
rem  Zuschauer sehen nur das Spiel, Einstellungen und Test-Chat bleiben gesperrt.
rem ================================================================

for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env.example") do set "%%A=%%B"
if exist ".env" for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do set "%%A=%%B"

curl -s -o nul http://127.0.0.1:%PORT%/ 2>nul
if errorlevel 1 (
  echo Das Spiel laeuft nicht. Bitte zuerst start.bat starten.
  pause
  exit /b 1
)

where cloudflared >nul 2>&1
if errorlevel 1 (
  echo cloudflared fehlt. Einmalig installieren mit:
  echo     winget install --id Cloudflare.cloudflared
  echo Danach dieses Fenster schliessen und teilen.bat neu starten.
  pause
  exit /b 1
)

echo Gleich erscheint unten eine Adresse, die auf .trycloudflare.com endet.
echo Diese Adresse kannst du weitergeben. Sie gilt, solange dieses Fenster offen ist.
echo.
cloudflared tunnel --url http://127.0.0.1:%PORT%
pause
