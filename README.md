# YouNow Höhlenspiel

Chat-Spiel für einen YouNow-Stream. Eine autonome, LLM-gesteuerte Figur erkundet ein prozedural erzeugtes Höhlenlabyrinth. Die Zuschauer greifen nur begrenzt ein: Sie stimmen an Kreuzungen ab, können die Figur bestechen und formen über ihre Entscheidungen den Charakter der Figur.

Die vollständige Beschreibung steht im [Pflichtenheft](docs/pflichtenheft.md), der Stand der Arbeit im [Fahrplan](docs/fahrplan.md).

## Aufbau

```
server/        Python: Labyrinth, Figur, Charakter, Entscheider, LLM, Chat, Speicherstand, Webserver
overlay/       HTML + Phaser: Karte, Figur, Abstimmung, Statusanzeigen (OBS-Browserquelle)
userscript/    YouNow-Chatleser für Tampermonkey
assets/        Grafiken (LPC) plus Credits
docs/          Pflichtenheft und Fahrplan
start.bat      startet llama-server und Python-Server (kommt mit dem ersten Code-Modul)
.env.example   Vorlage für Schlüssel und Einstellungen
```

## Betrieb

Lokal: Python-Server liefert die Overlay-Seite auf `http://localhost:8000` aus. Im Stream wird genau diese Seite als Browserquelle in OBS eingebunden, OBS sendet per Stream-Key an YouNow.

Später optional: Betrieb auf einem VPS mit unsichtbarem Chromium (Playwright), ffmpeg und LLM über eine API.
