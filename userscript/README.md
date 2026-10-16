# userscript

## younow-mitschnitt.user.js

Schneidet mit, was YouNow live an den Browser schickt (WebSocket, dazu PubNub- und Chat-Anfragen),
und schickt es an den Spielserver. Der speichert alles in `logs/younow_raw.jsonl`. Daraus wird das Format
von Chat, Likes und Geschenken abgelesen, danach entsteht das eigentliche Bridge-Skript.

1. Tampermonkey: neues Skript anlegen, Inhalt der Datei einfügen, speichern.
2. start.bat muss laufen (der Spielserver nimmt die Daten an).
3. Werbeblocker für younow.com ausschalten, sonst kommen die WebSockets nicht durch.
4. Einen Stream öffnen. Unten links erscheint „Mitschnitt läuft: … Nachrichten“.
5. Auf der Einstellungsseite (http://localhost:8000/einstellungen) steht, wie viel angekommen ist,
   dort lässt sich der Mitschnitt herunterladen.
