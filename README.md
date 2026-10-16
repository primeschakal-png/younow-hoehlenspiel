# YouNow Höhlenspiel

Chat-Spiel für einen YouNow-Stream. Eine autonome, LLM-gesteuerte Figur erkundet ein prozedural erzeugtes Höhlenlabyrinth. Die Zuschauer greifen nur begrenzt ein: Sie stimmen an Kreuzungen ab, können die Figur bestechen und formen über ihre Entscheidungen den Charakter der Figur.

Die vollständige Beschreibung steht im [Pflichtenheft](docs/pflichtenheft.md), der Stand der Arbeit im [Fahrplan](docs/fahrplan.md).

## Starten (Windows)

1. Python 3.10 oder neuer installieren (Haken bei "Add to PATH").
2. `start.bat` doppelklicken. Beim ersten Start wird `.env` aus `.env.example` erzeugt, eine Python-Umgebung eingerichtet und `aiohttp` installiert.
3. Der Browser öffnet `http://localhost:8000/?testchat=1`. Unten rechts ist der Test-Chat, dort `!links`, `!rechts`, `!geradeaus` oder `!zurueck` eintippen, sobald an einer Kreuzung abgestimmt wird. Mit verschiedenen Namen im kleinen Feld lassen sich mehrere Zuschauer simulieren.

Die Figur spricht über den lokalen llama-server (Pfade und Parameter in `.env`, Vorgaben in `.env.example`). `start.bat` startet ihn mit, läuft schon einer auf dem Port, wird er mitgenutzt. Ohne LLM (`LLM_ENABLED=0`) entscheidet die Figur nach eigenem Gespür und bleibt stumm.

Zuschauer können die Figur mit `!sag <Text>` ansprechen (pro Zuschauer höchstens alle 30 Sekunden).

Für OBS: Browserquelle mit `http://localhost:8000/`, Größe 1280 x 720 (ohne Test-Chat). Die Grafik wird doppelt vergrößert, mit `?zoom=1` oder `?zoom=3` an der Adresse lässt sich das ändern. In der Stadt folgt das Licht der Uhrzeit des PCs (Abendrot, Nacht mit Lichtkreis um die Figur), zum Ausprobieren `?stunde=22` an die Adresse hängen.

Grafik: Kacheln aus „Mage City Arcanos“ von Hyptosis (CC0), Unterwelt, Monster und Gegenstände aus „Dungeon Crawl Stone Soup“ (CC0), Spielfigur aus dem LPC-Generator (OGA-BY 3.0), siehe `assets/CREDITS.md`.

## Aufbau

```
server/        Python: Labyrinth, Figur, Charakter, Entscheider, LLM, Chat, Speicherstand, Webserver
tools/         Hilfsskripte, z. B. Kachelblatt der Unterwelt neu bauen
overlay/       HTML + Phaser: Karte, Figur, Abstimmung, Statusanzeigen (OBS-Browserquelle)
userscript/    YouNow-Chatleser für Tampermonkey
assets/        Grafiken (LPC) plus Credits
docs/          Pflichtenheft und Fahrplan
start.bat      startet llama-server (wenn LLAMA_START=1) und Python-Server
.env.example   Vorlage für Schlüssel und Einstellungen
```

## Betrieb

Lokal: Python-Server liefert die Overlay-Seite auf `http://localhost:8000` aus. Im Stream wird genau diese Seite als Browserquelle in OBS eingebunden, OBS sendet per Stream-Key an YouNow.

Später optional: Betrieb auf einem VPS mit unsichtbarem Chromium (Playwright), ffmpeg und LLM über eine API.
