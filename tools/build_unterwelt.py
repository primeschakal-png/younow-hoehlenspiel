"""Packt ausgewählte Kacheln aus Dungeon Crawl Stone Soup (CC0) in ein Kachelblatt.

Aufruf: python tools/build_unterwelt.py "<Pfad zu Dungeon Crawl Stone Soup Full>"
Ergebnis: assets/dcss/unterwelt.png (8 Kacheln pro Zeile, 32x32) und unterwelt.json (Name -> Bildnummer)
"""
import json
import os
import sys

from PIL import Image, ImageEnhance

# Böden sind im Original sehr dunkel, unter dem Lichtkreis wären sie kaum zu sehen
# Höhlenwände etwas dunkler, damit der Weg heller ist als der Fels
BRIGHTEN = {"keller_floor": 1.45, "kata_floor": 1.4, "hoehle_floor": 2.0, "hoehle_wall": 0.7}

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "dcss")

# Gruppenname -> Dateien relativ zu dungeon/ (mit / am Anfang: relativ zum Hauptordner)
GROUPS = {
    "keller_wall": [f"wall/brick_gray_{i}.png" for i in range(4)],
    "keller_floor": [f"floor/pebble_brown_{i}_new.png" for i in range(9)],
    "keller_deco": ["large_box.png", "boulder.png", "mold_large_1.png", "mold_large_2.png"],
    "kata_wall": [f"wall/catacombs_{i}.png" for i in range(8)],
    "kata_wall_alt": [f"wall/catacombs_{i}.png" for i in range(8, 16)],
    "kata_floor": [f"floor/tomb_{i}_new.png" for i in range(4)],
    "kata_deco": ["sarcophagus_open.png", "statues/crumbled_column.png", "statues/statue_wraith.png",
                  "statues/granite_stump_new.png"],
    "hoehle_wall": [f"wall/brick_dark_{i}.png" for i in range(5)],
    "hoehle_floor": [f"floor/grey_dirt_{i}_new.png" for i in range(8)],
    "hoehle_deco": ["boulder.png", "mold_large_3.png", "mold_large_4.png", "statues/granite_stump_old.png"],
    "stairs_down": ["gateways/stone_stairs_down.png"],
    "fountain": ["blue_fountain.png", "blue_fountain_2.png"],
    "altar": ["statues/statue_angel.png"],
    "pilz": ["/monster/fungi_plants/deathcap.png"],
}


def main():
    names, frames = {}, []
    for group, files in GROUPS.items():
        names[group] = []
        for f in files:
            # Pfade mit / am Anfang liegen nicht unter dungeon/
            path = os.path.join(SRC, f[1:]) if f.startswith("/") else os.path.join(SRC, "dungeon", f)
            if not os.path.exists(path):
                print("fehlt:", f)
                continue
            names[group].append(len(frames))
            im = Image.open(path).convert("RGBA").resize((32, 32), Image.NEAREST)
            if group in BRIGHTEN:
                alpha = im.getchannel("A")
                im = ImageEnhance.Brightness(im.convert("RGB")).enhance(BRIGHTEN[group]).convert("RGBA")
                im.putalpha(alpha)
            frames.append(im)
    cols = 8
    rows = (len(frames) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * 32, rows * 32), (0, 0, 0, 0))
    for i, im in enumerate(frames):
        sheet.alpha_composite(im, ((i % cols) * 32, (i // cols) * 32))
    sheet.save(os.path.join(OUT, "unterwelt.png"))
    with open(os.path.join(OUT, "unterwelt.json"), "w", encoding="utf-8") as fh:
        json.dump(names, fh, indent=1)
    print(len(frames), "Kacheln")


if __name__ == "__main__":
    main()
