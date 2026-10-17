"""Schreibt alle vertonbaren Erzählersprüche (ohne {Platzhalter}) in Textdateien für die Vertonung.

Aufruf: python tools/narrator_export.py
Ergebnis in assets/narrator/:
  vertonung.txt          eine Zeile pro Spruch:  ID<TAB>Text
  vertonung_kapitel.txt  jeder Spruch als eigenes Kapitel mit der ID als Überschrift
Die fertigen Audiodateien heißen wie die ID (z. B. kampf_sieg_03.mp3) und kommen nach assets/narrator/audio/.
Bereits vertonte Sprüche werden übersprungen.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "server"))
from narrator import AUDIO_EXT, Narrator  # noqa: E402

folder = ROOT / "assets" / "narrator"
n = Narrator(folder)
rows = []
for kind, lines in n.all_lines().items():
    for line_id, text in lines:
        if "{" in text:
            continue
        if any((folder / "audio" / (line_id + ext)).exists() for ext in AUDIO_EXT):
            continue
        rows.append((line_id, text))
(folder / "vertonung.txt").write_text("".join(f"{i}\t{t}\n" for i, t in rows), encoding="utf-8")
(folder / "vertonung_kapitel.txt").write_text("".join(f"# {i}\n\n{t}\n\n" for i, t in rows), encoding="utf-8")
print(f"{len(rows)} Sprüche zum Vertonen in assets/narrator/vertonung.txt und vertonung_kapitel.txt")
