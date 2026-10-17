"""Erzähler: vorbereitete Sprüche je Anlass aus assets/narrator/narrator.json.

Jeder Spruch hat eine ID aus Kategorie und Nummer (kampf_sieg_03). Liegt in assets/narrator/audio
eine Datei mit dieser ID, wird sie mit abgespielt. Die JSON-Datei wird bei Änderungen neu geladen,
neue Sprüche gelten also ohne Neustart.
"""

import json
import random
import string
from collections import deque
from pathlib import Path

AUDIO_EXT = (".ogg", ".mp3", ".wav", ".m4a", ".opus")


class Narrator:
    def __init__(self, folder):
        self.folder = Path(folder)
        self.file = self.folder / "narrator.json"
        self.lines = {}
        self.mtime = None
        self.recent = {}
        self.rnd = random.Random()

    def _load(self):
        try:
            mtime = self.file.stat().st_mtime
        except OSError:
            self.lines = {}
            return
        if mtime == self.mtime:
            return
        try:
            data = json.loads(self.file.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            print("Erzähler: narrator.json fehlerhaft, alte Sprüche bleiben:", exc)
            self.mtime = mtime
            return
        self.lines = {}
        for kind, texts in data.items():
            if kind.startswith("_") or not isinstance(texts, list):
                continue
            self.lines[kind] = [(f"{kind}_{i + 1:02d}", str(t)) for i, t in enumerate(texts) if str(t).strip()]
        self.mtime = mtime

    @staticmethod
    def _fields(text):
        return {f for _, f, _, _ in string.Formatter().parse(text) if f}

    def _audio(self, line_id):
        for ext in AUDIO_EXT:
            if (self.folder / "audio" / (line_id + ext)).exists():
                return f"assets/narrator/audio/{line_id}{ext}"
        return None

    def pick(self, kind, **values):
        """Gibt {"id", "text", "audio"} zurück oder None, wenn es für den Anlass nichts gibt."""
        self._load()
        known = {k for k, v in values.items() if v not in (None, "")}
        options = [(i, t) for i, t in self.lines.get(kind, []) if self._fields(t) <= known]
        if not options:
            return None
        recent = self.recent.setdefault(kind, deque(maxlen=max(1, len(options) // 2)))
        fresh = [o for o in options if o[0] not in recent] or options
        line_id, text = self.rnd.choice(fresh)
        recent.append(line_id)
        try:
            text = text.format(**values)
        except (KeyError, IndexError, ValueError):
            return None
        return {"id": line_id, "text": text, "audio": self._audio(line_id)}

    def all_lines(self):
        self._load()
        return self.lines
