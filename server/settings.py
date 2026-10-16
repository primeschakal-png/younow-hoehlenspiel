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
    ("balance", "Überleben und Balance"),
    ("karte", "Karte"),
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
