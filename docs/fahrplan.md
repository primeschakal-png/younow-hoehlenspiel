# Fahrplan

Abhaken mit `[x]`. Abschnittsnummern verweisen auf das [Pflichtenheft](pflichtenheft.md).

## 1. Labyrinth, Figur und Overlay mit Test-Chat

Erste lauffähige Version ohne LLM und ohne YouNow.

- [ ] Labyrinth-Generator: Gänge, Kreuzungen, Grotten, Treppe (2)
- [ ] Python-Server mit Webserver und WebSocket
- [ ] Phaser-Overlay: Karte mit Autotiling, Nebel, Figur läuft Wegpunkte ab
- [ ] Test-Chat: Eingabefeld im Overlay statt YouNow
- [ ] Einfache Abstimmung an Kreuzungen mit Timer
- [ ] start.bat und .env

## 2. Überleben, Begegnungen und Lager

- [ ] Lebenspunkte, Hunger, Durst, Inventar (3)
- [ ] Bestückung: Truhen, Monster, Fallen, Quellen, Schreine, Händler, abhängig von der Tiefe
- [ ] Würfelwürfe und Kämpfe, sichtbar im Overlay
- [ ] Kreuzungshinweise aus dem Inhalt der Gänge
- [ ] Lagerzustand im Leerlauf mit Tätigkeiten und Abbruchgründen (7)
- [ ] Tod und neue Figur

## 3. Entscheider: Abstimmung und Bestechung

- [ ] Eine Stimme pro Zuschauer, umentscheiden erlaubt (4)
- [ ] Live-Balken im Overlay
- [ ] Gleichstand und fehlende Stimmen
- [ ] Bestechung als Zusatzgewicht, Gegenbieten, öffentliche Nennung (5)

## 4. Charakter-System

- [ ] Persona-Erzeugung für jede neue Figur (6.1)
- [ ] Zwei Achsen, vier Archetypen, Mitte, Hysterese (6.2)
- [ ] Vertrauen in Chat, sich selbst, einzelne Zuschauer (6.3)
- [ ] Grenzen und Rückwanderung zur Grundhaltung (6.4)
- [ ] Anzeige als Kreuz mit Punkt im Overlay, Ankündigung beim Archetyp-Wechsel

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
