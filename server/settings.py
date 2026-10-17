"""Einstellungen: Beschreibung aller Werte, Laden, Speichern und Übernehmen im laufenden Spiel.

Vorgaben stehen in .env.example, eigene Werte in .env. Die Einstellungsseite schreibt in .env
nur, was von der Vorgabe abweicht. So kommen neue Vorgaben nach einem Update automatisch an.
"""

from pathlib import Path

import game as game_mod

ROOT = Path(__file__).resolve().parent.parent
EXAMPLE = ROOT / ".env.example"
LOCAL = ROOT / ".env"

# Gruppen in der Reihenfolge der Seite
GROUPS = [
    ("spiel", "Ablauf"),
    ("lager", "Lager und Leerlauf"),
    ("bewohner", "Stadtbewohner"),
    ("erzaehler", "Erzähler"),
    ("balance", "Überleben und Balance"),
    ("karte", "Karte"),
    ("younow", "YouNow"),
    ("ton", "Ton"),
    ("llm", "LLM"),
    ("llama", "llama-server (start.bat)"),
    ("web", "Webserver"),
]

# key, gruppe, typ, beschriftung, erklärung, sofort wirksam
FIELDS = [
    ("VOTE_SECONDS", "spiel", "int", "Abstimmungszeit (Chat aktiv)",
     "Sekunden pro Abstimmung, solange in der letzten Minute jemand geschrieben hat.", True),
    ("IDLE_VOTE_SECONDS", "lager", "int", "Kürzeste Abstimmungszeit",
     "Ohne Chat wird die Abstimmungszeit stetig kürzer, bis sie hier ankommt.", True),
    ("IDLE_MINUTES", "lager", "float", "Minuten bis „niemand da“",
     "So lange ohne Chat, dann gilt der Stream als leer: kürzeste Abstimmungszeit, Lager erlaubt.", True),
    ("CAMP_MAX_MINUTES", "lager", "float", "Lager höchstens (Minuten)",
     "Danach packt die Figur zusammen und erkundet allein weiter.", True),
    ("CAMP_PAUSE_MINUTES", "lager", "float", "Pause bis zum nächsten Lager (Minuten)",
     "So lange muss die Figur nach einem Lager unterwegs sein, bevor sie wieder rastet.", True),
    ("NPC_COUNT_DAY", "bewohner", "int", "Bewohner am Tag", "So viele laufen auf einer Stadtebene herum.", True),
    ("NPC_COUNT_NIGHT", "bewohner", "int", "Bewohner nachts", "Zwischen 23 und 6 Uhr. Gilt ab der nächsten Ebene.", True),
    ("NPC_TALK_MINUTES", "bewohner", "float", "Abstand zwischen Gesprächen (Minuten)",
     "So lange redet die Figur nach einem Gespräch mit keinem Bewohner.", True),
    ("IDLE_ZOOM_MINUTES", "bewohner", "float", "Herauszoomen nach (Minuten im Lager)",
     "Dann zeigt die Karte die ganze Stadt mit ihren Bewohnern, ohne Gegenstände.", True),
    ("NARRATOR_ENABLED", "erzaehler", "bool", "Erzähler an", "Sprüche aus assets/narrator/narrator.json, Änderungen dort gelten sofort.", True),
    ("NARRATOR_COOLDOWN", "erzaehler", "int", "Mindestabstand (Sekunden)",
     "Zwischen zwei Sprüchen. Tod, neue Figur, neues Gebiet und Tageszeit kommen trotzdem immer.", True),
    ("NARRATOR_CHANCE", "erzaehler", "int", "Häufigkeit bei kleinen Anlässen (Prozent)",
     "Kampf, Truhe, Sackgasse und Ähnliches: so oft meldet sich der Erzähler, wenn der Abstand erlaubt.", True),
    ("STEP_SECONDS", "spiel", "float", "Sekunden pro Kachel",
     "Laufgeschwindigkeit. Kleiner ist schneller. Hunger und Durst hängen an den Schritten, nicht an der Zeit.", True),
    ("SAY_COOLDOWN", "spiel", "int", "Abstand für !sag (Sekunden)",
     "So oft antwortet die Figur demselben Zuschauer höchstens.", True),
    ("BAL_THIRST_PER_TILE", "balance", "float", "Durst pro Kachel",
     "Wie viel Durst (von 100) ein Schritt kostet.", True),
    ("BAL_HUNGER_PER_TILE", "balance", "float", "Hunger pro Kachel",
     "Wie viel Sättigung (von 100) ein Schritt kostet.", True),
    ("BAL_CAMP_NEED_FACTOR", "balance", "float", "Verbrauch im Lager",
     "Verbrauch pro Spieltakt im Lager im Verhältnis zu einem Schritt.", True),
    ("BAL_FOOD_VALUE", "balance", "int", "Proviant macht satt um", "Punkte von 100.", True),
    ("BAL_COOKED_FOOD_VALUE", "balance", "int", "Gekochtes macht satt um", "Punkte von 100, beim Kochen im Lager.", True),
    ("BAL_WATER_VALUE", "balance", "int", "Wasserflasche löscht Durst um", "Punkte von 100.", True),
    ("BAL_POTION_HEAL", "balance", "int", "Heiltrank heilt", "Lebenspunkte (von 20).", True),
    ("BAL_HERO_BONUS", "balance", "int", "Würfelbonus der Figur",
     "Wird auf jeden W20-Wurf addiert. Höher heißt seltener verletzt.", True),
    ("BAL_EVENT_PAUSE", "balance", "float", "Pause nach Begegnungen (Sekunden)", "", True),
    ("BAL_DEATH_PAUSE", "balance", "float", "Anzeige nach dem Tod (Sekunden)", "", True),
    ("MAP_CELLS_W", "karte", "int", "Kartenbreite (Kreuzungen)", "Gilt ab der nächsten Ebene.", True),
    ("MAP_CELLS_H", "karte", "int", "Kartenhöhe (Kreuzungen)", "Gilt ab der nächsten Ebene.", True),
    ("REVEAL_RADIUS", "karte", "int", "Sichtweite (Kacheln)", "So weit deckt die Figur die Karte auf.", True),
    ("YOUNOW_ENABLED", "younow", "bool", "YouNow-Chat lesen",
     "Fragt die öffentliche Stream-Info ab: Chat, Befehle und Geschenke kommen direkt ins Spiel, ohne Browser.", True),
    ("YOUNOW_USER", "younow", "text", "YouNow-Name des Streams", "Der Benutzername, unter dem gestreamt wird.", True),
    ("CHAT_OVERLAY", "younow", "bool", "Chat im Bild anzeigen",
     "YouNow zeigt den Chat selbst. Mit ?testchat=1 ist der Kasten immer sichtbar.", True),
    ("YOUNOW_POLL_SECONDS", "younow", "float", "Abfrage alle (Sekunden)", "Kleiner heißt schnellere Reaktion, 3 ist ein guter Wert.", True),
    ("BRIBE_LIKES_PER_VOTE", "younow", "int", "Likes pro Zusatzstimme",
     "Geschenkwert in Likes, der eine zusätzliche Stimme ergibt. Ein Geschenk für 2.500 Likes ist bei 1000 also 2,5 Stimmen wert.", True),
    ("PLAIN_LIKES_PER_VOTE", "younow", "int", "Normale Likes pro Zusatzstimme",
     "Einzelne Likes sieht das Spiel nur bei den Top-Fans des Streams (die 6 bis 7 mit den meisten Likes). Auch Likes-Geschenke wie „10 Likes“ zählen hier, sie erscheinen nicht als Chatzeile.", True),
    ("SOUND_ENABLED", "ton", "bool", "Ton an", "Musik und Geräusche im Overlay. In OBS bei der Browserquelle „Audio über OBS steuern“ anhaken.", True),
    ("MUSIC_VOLUME", "ton", "int", "Musik (0 bis 100)", "Im Lager und nachts automatisch leiser.", True),
    ("SFX_VOLUME", "ton", "int", "Geräusche (0 bis 100)", "Schritte, Kampf, Truhen, Abstimmung.", True),
    ("LLM_ENABLED", "llm", "bool", "LLM benutzen", "Aus: Die Figur entscheidet nach eigenen Regeln und spricht nicht.", True),
    ("LLM_BASE_URL", "llm", "text", "Adresse", "OpenAI-kompatibel, z. B. http://127.0.0.1:8080/v1", True),
    ("LLM_MODEL", "llm", "text", "Modellname", "Bei llama-server egal, bei einer API der Modellname.", True),
    ("LLM_API_KEY", "llm", "password", "API-Schlüssel", "Für llama-server leer lassen.", True),
    ("LLM_TIMEOUT", "llm", "float", "Wartezeit (Sekunden)", "Länger wartet das Spiel nicht auf eine Antwort.", True),
    ("LLAMA_START", "llama", "bool", "llama-server mit starten", "", False),
    ("LLAMA_PORT", "llama", "int", "Port", "", False),
    ("LLAMA_SERVER_EXE", "llama", "text", "llama-server.exe", "", False),
    ("LLAMA_MODEL_PATH", "llama", "text", "Modelldatei (.gguf)", "", False),
    ("LLAMA_CTX", "llama", "int", "Kontextlänge", "", False),
    ("LLAMA_NGL", "llama", "int", "Schichten auf der Grafikkarte", "", False),
    ("LLAMA_EXTRA", "llama", "text", "Weitere Parameter", "", False),
    ("HOST", "web", "text", "Adresse", "127.0.0.1: nur dieser PC. 0.0.0.0: auch andere Geräte im Netz.", False),
    ("PORT", "web", "int", "Port", "", False),
]

FIELD = {f[0]: f for f in FIELDS}


def read_env(path):
    env = {}
    if not path.exists():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip()
    return env


def defaults():
    return read_env(EXAMPLE)


def current():
    return {**defaults(), **read_env(LOCAL)}


def check(key, raw):
    """Prüft einen Wert, gibt (text, fehler) zurück."""
    kind = FIELD[key][2]
    raw = str(raw).strip()
    if kind == "bool":
        return ("1" if raw in ("1", "true", "True", "on") else "0"), None
    if kind in ("int", "float"):
        try:
            num = float(raw.replace(",", "."))
        except ValueError:
            return None, "keine Zahl"
        if num < 0:
            return None, "darf nicht negativ sein"
        if kind == "int":
            return str(int(round(num))), None
        return f"{num:g}", None
    if "\n" in raw or "\r" in raw:
        return None, "nur eine Zeile"
    return raw, None


def save(changes):
    """Übernimmt geänderte Werte. Schreibt .env mit allen Abweichungen von der Vorgabe,
    unbekannte Schlüssel in .env bleiben erhalten. Gibt (werte, fehler) zurück."""
    errors = {}
    values = current()
    for key, raw in changes.items():
        if key not in FIELD:
            continue
        val, err = check(key, raw)
        if err:
            errors[key] = err
        else:
            values[key] = val
    if errors:
        return None, errors
    base = defaults()
    local = read_env(LOCAL)
    lines = ["# Eigene Einstellungen. Wird von der Einstellungsseite geschrieben,",
             "# hier steht nur, was von .env.example abweicht.", ""]
    for key, *_ in FIELDS:
        if key in values and values[key] != base.get(key):
            lines.append(f"{key}={values[key]}")
    for key, val in local.items():
        if key not in FIELD:
            lines.append(f"{key}={val}")
    LOCAL.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return values, None


def num(values, key, fallback):
    try:
        return float(values.get(key, fallback))
    except (TypeError, ValueError):
        return float(fallback)


def apply(values, game, llm):
    """Setzt alle sofort wirksamen Werte im laufenden Spiel."""
    game.vote_seconds = num(values, "VOTE_SECONDS", 28)
    game.idle_vote_seconds = num(values, "IDLE_VOTE_SECONDS", 10)
    game.idle_seconds = num(values, "IDLE_MINUTES", 5) * 60
    game.camp_max_seconds = num(values, "CAMP_MAX_MINUTES", 8) * 60
    game.camp_pause_seconds = num(values, "CAMP_PAUSE_MINUTES", 10) * 60
    game.step_seconds = max(0.05, num(values, "STEP_SECONDS", 0.25))
    game.cells_w = max(4, int(num(values, "MAP_CELLS_W", 16)))
    game.cells_h = max(4, int(num(values, "MAP_CELLS_H", 10)))
    game.reveal_radius = max(1, int(num(values, "REVEAL_RADIUS", 4)))
    game_mod.SAY_COOLDOWN = num(values, "SAY_COOLDOWN", 30)
    for key in values:
        if key.startswith("BAL_"):
            name = key[4:].lower()
            if name in game_mod.BAL:
                v = num(values, key, game_mod.BAL[name])
                game_mod.BAL[name] = int(v) if key in FIELD and FIELD[key][2] == "int" else v
    game.likes_per_vote = max(1, int(num(values, "BRIBE_LIKES_PER_VOTE", 1000)))
    game.plain_likes_per_vote = max(1, int(num(values, "PLAIN_LIKES_PER_VOTE", 20)))
    game.chat_overlay = values.get("CHAT_OVERLAY", "0") == "1"
    game.npc_count_day = max(0, int(num(values, "NPC_COUNT_DAY", 5)))
    game.npc_count_night = max(0, int(num(values, "NPC_COUNT_NIGHT", 2)))
    game.hero_talk_cooldown = num(values, "NPC_TALK_MINUTES", 2.5) * 60
    game.idle_zoom_seconds = num(values, "IDLE_ZOOM_MINUTES", 2) * 60
    game.narr_enabled = values.get("NARRATOR_ENABLED", "1") == "1"
    game.narr_cooldown = num(values, "NARRATOR_COOLDOWN", 45)
    game.narr_chance = max(0.0, min(1.0, num(values, "NARRATOR_CHANCE", 50) / 100))
    game.audio = {
        "enabled": values.get("SOUND_ENABLED", "1") == "1",
        "music": max(0.0, min(1.0, num(values, "MUSIC_VOLUME", 35) / 100)),
        "sfx": max(0.0, min(1.0, num(values, "SFX_VOLUME", 70) / 100)),
    }
    if llm is not None:
        llm.enabled = values.get("LLM_ENABLED", "1") == "1"
        llm.url = values.get("LLM_BASE_URL", "http://127.0.0.1:8080/v1").rstrip("/") + "/chat/completions"
        llm.model = values.get("LLM_MODEL", "local")
        llm.api_key = values.get("LLM_API_KEY", "")
        llm.timeout = num(values, "LLM_TIMEOUT", 25)
        llm.fail_until = 0.0   # neue Adresse sofort probieren


def describe(values):
    base = defaults()
    groups = []
    for gid, title in GROUPS:
        fields = []
        for key, grp, kind, label, help_text, live in FIELDS:
            if grp != gid:
                continue
            fields.append({"key": key, "type": kind, "label": label, "help": help_text, "live": live,
                           "value": values.get(key, ""), "default": base.get(key, "")})
        groups.append({"id": gid, "title": title, "fields": fields})
    return groups
