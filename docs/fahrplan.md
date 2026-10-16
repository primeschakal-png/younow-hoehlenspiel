# Fahrplan

Abhaken mit `[x]`. Abschnittsnummern verweisen auf das [Pflichtenheft](pflichtenheft.md).

## 1. Labyrinth, Figur und Overlay mit Test-Chat

Erste lauffähige Version ohne LLM und ohne YouNow.

- [x] Labyrinth-Generator: Gänge, Kreuzungen, Grotten, Treppe (2)
- [x] Python-Server mit Webserver und WebSocket
- [x] Phaser-Overlay: Karte mit Autotiling, Nebel, Figur läuft Wegpunkte ab
- [x] Test-Chat: Eingabefeld im Overlay statt YouNow
- [x] Einfache Abstimmung an Kreuzungen mit Timer
- [x] start.bat und .env

## 2. Überleben, Begegnungen und Lager

- [x] Lebenspunkte, Hunger, Durst, Inventar (3)
- [x] Bestückung: Truhen, Monster, Fallen, Quellen, Schreine, Händler, abhängig von der Tiefe
- [x] Würfelwürfe und Kämpfe, sichtbar im Overlay
- [x] Kreuzungshinweise aus dem Inhalt der Gänge
- [x] Lagerzustand im Leerlauf mit Tätigkeiten und Abbruchgründen (7)
- [x] Tod und neue Figur (Ehrenhalle vorerst nur im Speicher, dauerhaft in Etappe 7)

## 3. Entscheider: Abstimmung und Bestechung

- [ ] Eine Stimme pro Zuschauer, umentscheiden erlaubt (4)
- [ ] Live-Balken im Overlay
- [x] Gleichstand und fehlende Stimmen (ohne Stimmen: Gespür nach Hinweisen und Not, bis Etappe 5 das LLM übernimmt)
- [ ] Bestechung als Zusatzgewicht, Gegenbieten, öffentliche Nennung (5)

## 4. Charakter-System

- [x] Persona-Erzeugung für jede neue Figur (6.1)
- [x] Zwei Achsen, vier Archetypen, Mitte, Hysterese (6.2)
- [x] Vertrauen in Chat, sich selbst, einzelne Zuschauer (6.3)
- [x] Grenzen und Rückwanderung zur Grundhaltung (6.4)
- [x] Anzeige als Kreuz mit Punkt im Overlay, Ankündigung beim Archetyp-Wechsel

## 5. LLM-Anbindung

- [ ] OpenAI-kompatible Schnittstelle, lokal llama-server, später API
- [ ] Persona und Lage als Sätze an das LLM
- [ ] Entscheidung bei fehlenden Stimmen, Anfrage schon während des Timers
- [ ] Kommentare, Sprechblasen, Tagebuch im Lager
- [ ] Zufall als Notfall bei Ausfall des LLM

## 6. YouNow-Anbindung

- [ ] Im laufenden Stream prüfen: Aufbau von Chat, Geschenken und Likes im Browser (HTML-Ausschnitt oder Screenshot)
- [ ] Klären: Wird angezeigt, WER geliked hat?
- [ ] Userscript (Tampermonkey) mit automatischer Wiederverbindung
- [ ] Chat-Quelle austauschbar halten (später Playwright)

## 7. Speicherstand, Ehrenhalle und Robustheit

- [ ] Spielstand regelmäßig speichern, Overlay nach Neuladen sofort wiederherstellen
- [ ] Ehrenhalle (Name, Archetyp, Tiefe, Todesursache, Beteiligte)
- [ ] Verhalten bei Stream- oder Chat-Ausfall: Lager, Abstimmung anhalten (8.3)
- [ ] OBS-Einstellungen für automatische Wiederverbindung dokumentieren

## 8. Optional: Betrieb auf VPS

- [ ] Playwright-Chromium für Overlay und Chat
- [ ] ffmpeg mit Überwachungsschleife
- [ ] LLM über API
- [ ] YouNow-Nutzungsbedingungen zu Dauer-Streams prüfen (8.5)
