# Pflichtenheft YouNow Höhlenspiel

Stand: 16.10.2026

## 1. Grundidee

- Angelehnt an Little Computer People: Eine Figur lebt und handelt maximal autonom, die Zuschauer schauen zu und greifen nur begrenzt ein.
- Setting: Fantasy, angelehnt an D&D.
- Eigenbau. Das Original LCP wird nicht verwendet (Urheberrecht Activision), kein Reverse Engineering.
- Die Figur wird über ein LLM mit Persona gesteuert.
- Grundziel der Figur: so lange wie möglich im Spiel bleiben, also "streamen".

## 2. Welt: Labyrinth einer verlassenen Magierstadt

Grafik: Mage City Arcanos (Hyptosis, CC0), Kachelbeschreibung in `assets/tiles/magecity.json`.
Das Labyrinth wird als Stadt dargestellt: Gassen 2 Kacheln breit, dazwischen Häuserblöcke von 4 Kacheln
Dicke. Jede Mauerfolge ist unten Fassade (2 Reihen, mit Fenstern und gelegentlich einem Eingang), darüber
Dach. Häuserzeilen werden in Häuser von meist 3 Kacheln Breite geteilt, jedes Haus würfelt Dach und Fenster aus.
Plätze entstehen aus vier verbundenen Zellen (Brunnen, Markt, Park oder Statuen), dazu Gärten zwischen den
Häusern. Das Viertel wird je Karte gewürfelt: Marktviertel (Sandstein, Holzdächer, Kopfsteinpflaster) oder
verfallenes Viertel (graue Ziegel, Moosdächer, Plattenweg).

Gebiete nach Tiefe (in `server/game.py`, Liste `AREAS`): Ebene 1 Magierstadt, Ebene 2 Keller, Ebene 3 Katakomben,
ab Ebene 4 Höhlen. Unter Tage ist die Karte eine Draufsicht im Stil von Dungeon Crawl Stone Soup (CC0, Kachelblatt
`assets/dcss/unterwelt.png`, erzeugt mit `tools/build_unterwelt.py`), mit Dunkelheit und Lichtkreis um die Figur,
der am Lagerfeuer flackert. Brunnen, Statuen und Gemüse werden dort zu Springbrunnen, Engelsstatue und Pilzen.
Monster, Truhen, Fallen und Beute-Symbole stammen ebenfalls aus Dungeon Crawl Stone Soup.

Ursprüngliche Beschreibung:

- Prozedural erzeugt. Gerüst ist ein klassischer Labyrinth-Algorithmus (klare Gänge und Kreuzungen), darüber Höhlenoptik: unterschiedlich breite Gänge, Grotten an einzelnen Knoten, Felswände per Autotiling.
- Ebenen: Treppen führen tiefer, jede Ebene wird neu erzeugt. Tiefer bedeutet gefährlicher, wertvoller und karger an Vorräten.
- Nebel: Nur bereits begangene Bereiche sind sichtbar, die Karte wächst mit.
- Zufällig platzierte Dinge: Truhen, Monster, Fallen, Quellen, Schreine, verlassene Lager, Händler, Nahrung, Wasser.
- Begegnungen lösen sichtbare Würfelwürfe aus, das LLM erzählt das Ergebnis.

## 3. Überleben

- Werte: Lebenspunkte, Hunger, Durst, Inventar mit kleinem Vorrat.
- Hunger und Durst sinken pro Schritt, Durst schneller als Hunger. Bei null sinken die Lebenspunkte.
- Nachschub aus Truhen, Fundstellen, Quellen, Beute aus Kämpfen, Händlern. Gelegentlich verdorben.
- Überlebenswille: feste Kraft unter allem. Wird nie schwächer, wächst mit der Not (hungrig, durstig, verletzt), übernimmt kurz vor dem Tod komplett. Liegt außerhalb des Charakter-Koordinatensystems.
- Tod: Die Figur stirbt endgültig. Eintrag in die Ehrenhalle (Name, Archetyp, erreichte Tiefe, Todesursache, wer zuletzt abgestimmt oder bestochen hat). Danach neue Figur mit neuer Persona.

## 4. Entscheidungen an Kreuzungen

- Die Figur bleibt stehen, das LLM kommentiert die Hinweise.
- Hinweise werden vom Code aus dem tatsächlichen Inhalt der Gänge erzeugt (Wasser hören, Essen riechen, Knurren), nicht immer zuverlässig, manchmal irreführend.
- Abstimmung per Chat-Befehl (`!links`, `!rechts`, `!geradeaus` usw.).
- Timer ca. 25 bis 30 Sekunden (YouNow-Verzögerung beachten).
- Eine Stimme pro Zuschauer, umentscheiden erlaubt, die letzte Stimme zählt.
- Live-Balken der Stimmen im Overlay.
- Mehrheit der abgegebenen Stimmen entscheidet und ist bindend. Die Persona darf zögern, maulen, kommentieren.
- Gleichstand: Das LLM wählt zwischen den gleichauf liegenden Optionen.
- Keine Stimmen: Das LLM entscheidet aus der Persona heraus. Die LLM-Anfrage läuft bereits während des Timers, damit nach Ablauf keine Wartezeit entsteht. Zufall nur als Notfall, wenn das LLM nicht antwortet.

## 5. Bestechung

- Zuschauer können die Figur mit Likes oder Geschenken überreden, auch zum Trollen.
- Umsetzung als Zusatzgewicht für eine Option (Beispielwerte: 10 Likes = 1 Stimme, 1 Geschenk = 5 Stimmen), kein absolutes Überstimmen.
- Gegenbieten möglich (Bietgefecht in den letzten Sekunden).
- Öffentlich: Im Overlay steht, wer welche Option gekauft hat. Die Figur kennt den Namen.
- Die Persona reagiert auf Bestechung entsprechend ihrem Charakter.
- OFFEN: Prüfen, ob YouNow im Browser anzeigt, WER geliked hat. Geschenke erscheinen mit Absender im Chat.

## 6. Charakter-System

### 6.1 Persona

- Pro Figur fest: Name, Herkunft, Klasse, einige klare Eigenschaften, Sprechweise.
- Die Figur weiß, dass sie auf Sendung ist, und spricht den Chat direkt an.

### 6.2 Koordinatensystem

Zwei Achsen mit je zwei Polen (vier Attribute):

- Achse 1: Feige bis Mutig. Verschiebt sich durch Kämpfe, Fallen, Beinahe-Tode, Schätze.
- Achse 2: Eigensinnig bis Publikumsnah. Verschiebt sich durch das Verhältnis zum Chat (hat der Chat geholfen oder geschadet, Bestechungen, eigene Erfolge).

Archetypen nach Quadrant:

| | Eigensinnig | Publikumsnah |
|---|---|---|
| Mutig | Held | Entertainer |
| Feige | Feigling | Schmeichler |

Mitte: Abenteurer. Je weiter außen, desto extremer die Ausprägung.

- Sichtbar im Overlay als Kreuz mit wanderndem Punkt.
- Wechsel des Archetyps wird angekündigt, danach erhält das LLM die neue Beschreibung.
- Hysterese gegen Flackern: Wechsel erst, wenn der Punkt ein Stück ins neue Feld hineingewandert ist.

### 6.3 Vertrauen

- Vertrauen in den Chat, Selbstvertrauen, Vertrauen in einzelne Zuschauer.
- Jede Entscheidung (Chat, Bestechung, eigene) verändert die Werte je nach Ergebnis.
- Wirkung: Ton, Zögern, Eigenentscheidungen, Preis der Bestechung. Nicht das Votum.

### 6.4 Regeln

- Alle Werte haben Ober- und Untergrenzen.
- Alle Werte wandern langsam zur Grundhaltung zurück.
- Übergabe an das LLM als Sätze, nicht als Zahlen.

## 7. Leerlauf (Bildschirmschoner)

- Kein Chat-Input für einige Minuten: Lagerzustand.
- Lager an geeignetem Platz (ruhige Grotte, nahe Wasser).
- Tätigkeiten: Feuer machen, ausruhen, kochen, Ausrüstung flicken, schlafen nach echter Uhrzeit, Tagebuch schreiben oder murmeln (LLM).
- Nutzen: Heilung, Kraft, haltbareres oder sättigenderes Essen.
- Spielt vorsichtiger, große Wagnisse nur mit Publikum.
- Ende des Lagers: Chat wird aktiv (Begrüßung), Vorräte gehen aus (Hunger und Durst sinken langsamer weiter), kleine Störereignisse.
- Routine per Code, LLM nur gelegentlich (GPU schonen).

## 8. Technik

### 8.1 Architektur

- Userscript (Tampermonkey) liest den YouNow-Chat, schickt Befehle, Likes, Geschenke per WebSocket an den Python-Server.
- Python-Server: komplette Logik, LLM-Anbindung, Speicherstand, Webserver für die Overlay-Seite plus WebSocket.
- Overlay: HTML + Phaser. Stellt nur dar, was der Server anweist (laufen, Aktion, sprechen), meldet Abschluss zurück.
- Lokal: `http://localhost:8000`, im Stream als OBS-Browserquelle, OBS sendet per Stream-Key an YouNow.
- Kein Build-Prozess im Overlay, Phaser per CDN.

### 8.2 Module

1. Labyrinth-Generator
2. Bestückung
3. Figur und Überleben
4. Charakter-System
5. Entscheider (Abstimmung, Timer, Bestechung, Leerlauf)
6. LLM-Anbindung (OpenAI-kompatibel: lokal llama-server, auf VPS eine API)
7. Chat-Anbindung (Quelle austauschbar: Tampermonkey oder Playwright)
8. Speicherstand und Ehrenhalle
9. Userscript
10. Phaser-Overlay

### 8.2a YouNow-Chat im Browser (Stand 16.10.2026)

- Jede Chatnachricht ist ein Block mit der Klasse `comment`.
- Name: `.user-card__username-level span.truncate` (Text und `title`-Attribut).
- Text: `.user-card__body`.
- Level: `app-user-level p`.
- Rolle: zusätzliche Klassen am `comment`-Block, z.B. `broadcaster-mod`. Badges unter `user-badges`.
- Angular-Attribute wie `_ngcontent-ng-c…` ändern sich bei Updates und werden nicht verwendet.
- OFFEN: Aufbau einer Geschenk-Nachricht, Sichtbarkeit von Likes mit Namen.

### 8.3 Robustheit

- Spiel und Stream laufen unabhängig. Ein Stream-Abbruch beeinflusst den Spielzustand nicht.
- YouNow-Spiele laufen typischerweise 24 Stunden, eventuell mit Zwangs-Reconnect.
- OBS: automatische Wiederverbindung aktivieren.
- Userscript verbindet sich bei Abbruch selbst neu.
- Kommen längere Zeit keine Chat-Daten an: Lagerzustand, laufende Abstimmung anhalten oder verlängern.

### 8.4 Start

- `start.bat` startet llama-server und Python-Server.
- Schlüssel und Einstellungen in `.env` (nicht im Repository).

### 8.5 VPS (später)

- Unsichtbarer Chromium per Playwright rendert das Overlay und liest den Chat.
- ffmpeg kodiert und sendet per Stream-Key, Überwachungsschleife für Neustarts.
- LLM über API statt llama-server.
- Richtwert: 4 CPU-Kerne, 8 GB RAM für 720p30.
- Vorher Nutzungsbedingungen von YouNow zu Dauer-Streams prüfen.

## 9. Grafik

- Favorit: LPC (Liberated Pixel Cup). Freie Lizenzen (CC, GPL), kommerziell nutzbar, keine KI-Klausel, Credits Pflicht. Charaktergenerator mit Gehen, Stehen, Rennen, Springen, Sitzen, Emotes, Klettern, Zaubern, Hieb, Stoß, Bogen, Getroffen.
- Alternative: Ninja Adventure (CC0).
- Ausgeschlossen: Mana Seed (Lizenz verbietet Nutzung zusammen mit KI-Inhalten jeder Art).
- Grundregel: Bei jedem Asset-Pack vor Verwendung die Lizenz auf KI-Klauseln prüfen.
- OFFEN: Welche Lager-Objekte (Feuerstelle, Zelt, Schlafsack) und Höhlen-Tilesets es bei LPC gibt.

## 10. Reihenfolge

1. Labyrinth, Figur und Overlay mit Test-Chat (Eingabefeld statt YouNow), ohne LLM
2. Überleben, Begegnungen, Lager
3. Entscheider mit Abstimmung und Bestechung
4. Charakter-System
5. LLM-Anbindung
6. YouNow-Anbindung
7. Speicherstand, Ehrenhalle, Robustheit
8. Optional: VPS-Betrieb
