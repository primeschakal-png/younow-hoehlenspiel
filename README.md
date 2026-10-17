# YouNow Höhlenspiel

Chat-Spiel für einen YouNow-Stream. Eine autonome, LLM-gesteuerte Figur erkundet ein prozedural erzeugtes Höhlenlabyrinth. Die Zuschauer greifen nur begrenzt ein: Sie stimmen an Kreuzungen ab, können die Figur bestechen und formen über ihre Entscheidungen den Charakter der Figur.

Die vollständige Beschreibung steht im [Pflichtenheft](docs/pflichtenheft.md), der Stand der Arbeit im [Fahrplan](docs/fahrplan.md).

## Starten (Windows)

1. Python 3.10 oder neuer installieren (Haken bei "Add to PATH").
2. `start.bat` doppelklicken. Beim ersten Start wird `.env` aus `.env.example` erzeugt, eine Python-Umgebung eingerichtet und `aiohttp` installiert.
3. Der Browser öffnet `http://localhost:8000/?testchat=1`. Unten rechts ist der Test-Chat, dort `!links`, `!rechts`, `!geradeaus` oder `!zurueck` eintippen, sobald an einer Kreuzung abgestimmt wird. Mit verschiedenen Namen im kleinen Feld lassen sich mehrere Zuschauer simulieren.

Die Figur spricht über den lokalen llama-server (Pfade und Parameter in `.env`, Vorgaben in `.env.example`). `start.bat` startet ihn mit, läuft schon einer auf dem Port, wird er mitgenutzt. Ohne LLM (`LLM_ENABLED=0`) entscheidet die Figur nach eigenem Gespür und bleibt stumm.

Einstellungen: `http://localhost:8000/einstellungen` (nur auf diesem PC erreichbar). Dort lassen sich Abstimmungszeit, Leerlauf, Lager, Balance, Karte, LLM und llama-server einstellen, die meisten Werte wirken sofort. Gespeichert wird in `.env`, und zwar nur, was von `.env.example` abweicht. Außerdem gibt es Knöpfe für „LLM testen“, „Neue Ebene“ und „Neue Figur“.

Ohne Chat wird die Abstimmungszeit nach einer Minute Stille stetig kürzer, bis sie nach `IDLE_MINUTES` bei `IDLE_VOTE_SECONDS` ankommt. Hat die Figur dann schon selbst entschieden, geht sie nach 3 Sekunden los. Das Lager dauert höchstens `CAMP_MAX_MINUTES`, danach erkundet sie mindestens `CAMP_PAUSE_MINUTES` allein weiter.

YouNow: Auf der Einstellungsseite unter „YouNow“ einschalten und den Namen des Streams eintragen. Der Server liest dann alle paar Sekunden die öffentliche Stream-Info von YouNow: Chat und Befehle gehen direkt ins Spiel, Geschenke werden zu Zusatzstimmen bei der Abstimmung (Bestechung). Ein Browser oder Userscript ist dafür nicht nötig.

Zuschauer können die Figur mit `!sag <Text>` ansprechen (pro Zuschauer höchstens alle 30 Sekunden).

Für OBS: Browserquelle mit `http://localhost:8000/`, Größe 1280 x 720 (ohne Test-Chat). Die Grafik wird doppelt vergrößert, mit `?zoom=1` oder `?zoom=3` an der Adresse lässt sich das ändern. In der Stadt folgt das Licht der Uhrzeit des PCs (Abendrot, Nacht mit Lichtkreis um die Figur), zum Ausprobieren `?stunde=22` an die Adresse hängen.

Ton: Musik je Gebiet und Geräusche zu den Ereignissen, alles CC0 (siehe `assets/CREDITS.md`). In OBS bei der Browserquelle „Audio über OBS steuern“ anhaken, dann steht der Ton als eigene Spur im Audiomixer. Lautstärken auf der Einstellungsseite. Musik liegt je Stimmung in `assets/audio/music/stadt`, `nacht`, `keller`, `katakomben` und `hoehle` (.ogg, .mp3, .wav). Das Spiel spielt alles aus dem passenden Ordner in zufälliger Reihenfolge, neue Dateien gelten ab der nächsten Ebene. Ist ein Ordner leer, kommt Musik aus einer ähnlichen Stimmung. Im normalen Browser muss man einmal ins Bild klicken, bevor Ton kommt.

Grafik: Kacheln aus „Mage City Arcanos“ von Hyptosis (CC0), Unterwelt, Monster und Gegenstände aus „Dungeon Crawl Stone Soup“ (CC0), Spielfigur aus dem LPC-Generator (OGA-BY 3.0), siehe `assets/CREDITS.md`.

## Erzähler

Sprüche je Anlass stehen in `assets/narrator/narrator.json` (Tod, Kampf, neues Gebiet, Sackgasse, Bestechung ...).
Änderungen gelten sofort. Platzhalter: `{held}`, `{monster}`, `{ebene}`, `{gebiet}`, `{zuschauer}`, `{bewohner}`, `{archetyp}`.
Vertonen: `python tools/narrator_export.py` schreibt alle Sprüche ohne Platzhalter nach `assets/narrator/vertonung.txt`
und `vertonung.epub` (für Booxter: ein Kapitel pro Spruch, als Einzelclips markiert). Fertige Dateien holt `python tools/narrator_import.py <Booxter-Ausgabeordner>` ab. Oder Audiodateien mit der ID als Namen (z. B. `kampf_sieg_03.mp3`) nach `assets/narrator/audio/` legen,
dann spricht der Erzähler sie, und die Musik wird solange leiser. Häufigkeit auf der Einstellungsseite.

## Spiel im Internet zeigen

`teilen.bat` macht das laufende Spiel über einen Cloudflare-Tunnel unter einer öffentlichen Adresse
(`...trycloudflare.com`) erreichbar, ohne Videostream: Jeder Zuschauer sieht das Spiel live in seinem Browser.
Einmalig nötig: `winget install --id Cloudflare.cloudflared`. Einstellungsseite und Test-Chat bleiben dabei gesperrt.

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
