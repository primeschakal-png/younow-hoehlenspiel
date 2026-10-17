"""Fertige Erzähler-Audiodateien aus einem Booxter-Ausgabeordner übernehmen.

Aufruf: python tools/narrator_import.py "E:\\buchvertonung\\...\\<Ausgabeordner>" [--nummern]
Nimmt die Audiodateien direkt in diesem Ordner (keine Unterordner). Zuordnung:
  1. steht die ID im Dateinamen (z. B. "007 - kampf_sieg_03.mp3"), gilt die ID
  2. nur mit --nummern: führende Nummer im Dateinamen = Kapitelnummer aus der letzten vertonung.txt
Kopiert nach assets/narrator/audio/<ID>.<endung>. Vorhandene Dateien werden nicht überschrieben.
"""
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "server"))
from narrator import AUDIO_EXT, Narrator  # noqa: E402

folder = ROOT / "assets" / "narrator"
if len(sys.argv) < 2:
    print(__doc__)
    sys.exit(1)
src = Path(sys.argv[1])
nach_nummern = "--nummern" in sys.argv[2:]
ids = {line_id for lines in Narrator(folder).all_lines().values() for line_id, _ in lines}
order = []
listing = folder / "vertonung.txt"
if listing.exists():
    order = [line.split("\t", 1)[0] for line in listing.read_text(encoding="utf-8").splitlines() if "\t" in line]

(folder / "audio").mkdir(exist_ok=True)
done, skipped, unknown = 0, 0, []
for f in sorted(src.glob("*")):
    if f.suffix.lower() not in AUDIO_EXT:
        continue
    stem = f.stem.lower()
    line_id = next((i for i in sorted(ids, key=len, reverse=True) if i in stem), None)
    if not line_id and nach_nummern:
        m = re.match(r"\s*(\d+)", f.stem)
        if m and 0 < int(m.group(1)) <= len(order):
            line_id = order[int(m.group(1)) - 1]
    if not line_id:
        unknown.append(f.name)
        continue
    target = folder / "audio" / (line_id + f.suffix.lower())
    if any((folder / "audio" / (line_id + ext)).exists() for ext in AUDIO_EXT):
        skipped += 1
        continue
    shutil.copy2(f, target)
    done += 1
print(f"{done} übernommen, {skipped} waren schon da.")
if unknown:
    print("Nicht zuordenbar:", ", ".join(unknown[:20]))
