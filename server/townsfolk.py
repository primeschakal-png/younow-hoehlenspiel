"""Stadtbewohner: laufen durch die Gassen, reden mit der Figur und untereinander.

Bewegung wie die Figur über das Zellennetz, aber gemächlich und mit Pausen.
Gespräche schreibt das LLM in einer einzigen Anfrage als Liste von Zeilen.
"""

import itertools
import random

from maze import BACK, DIRS, STEP, Maze

_ids = itertools.count(1)

NAMES = {
    "m": ["Alrik", "Cuno", "Egon", "Gisbert", "Jost", "Leopold", "Notker", "Pankraz", "Siegbert", "Ulrich",
          "Xaver", "Bertram", "Hagen"],
    "w": ["Berta", "Dorle", "Frieda", "Hilde", "Isolde", "Kunigunde", "Magda", "Ottilie", "Rosalind", "Trude",
          "Walburga", "Zenzi", "Elsbeth"],
}

# Beruf in männlicher und weiblicher Form
JOBS = [("Kräuterhändler", "Kräuterhändlerin"), ("Nachtwächter", "Nachtwächterin"),
        ("Zauberlehrling", "Zauberlehrling"), ("Bäcker", "Bäckerin"), ("Schreiber", "Schreiberin"),
        ("Laternenanzünder", "Laternenanzünderin"), ("Wahrsager", "Wahrsagerin"), ("Kesselflicker", "Kesselflickerin"),
        ("Bibliothekar", "Bibliothekarin"), ("Straßenkehrer", "Straßenkehrerin"), ("Taschendieb", "Taschendiebin"),
        ("Alchemist", "Alchemistin"), ("Bettelmönch", "Bettelnonne"), ("Brunnenbauer", "Brunnenbauerin"),
        ("Katzenfänger", "Katzenfängerin"), ("ausgedienter Söldner", "ausgediente Söldnerin")]

QUIRKS = ["ist schwerhörig und versteht vieles falsch", "philosophiert gern über das Wesen der Dinge",
          "redet ständig über das Wetter", "ist abergläubisch und sieht überall Zeichen",
          "erzählt von früher, als die Magier noch hier lebten", "ist misstrauisch gegenüber Fremden",
          "reimt manchmal, ohne es zu merken", "hat eine Theorie über alles", "ist ständig in Eile",
          "flüstert, als würde jemand lauschen", "ist übertrieben höflich", "sammelt seltsame Steine",
          "hält sich für einen großen Denker", "ist schlecht gelaunt, aber gutmütig"]

TOPICS = ["warum die Magier die Stadt verlassen haben", "ob Ratten Träume haben", "das Wetter",
          "was unter der Stadt liegt", "ob man Glück sammeln kann", "warum Brunnen nie versiegen",
          "den Sinn des Weiterlaufens", "ob die Zuschauer im Himmel wohnen", "alte Gerüchte über Schätze",
          "was einen guten Abenteurer ausmacht", "die Stille in der Nacht", "Zufall und Schicksal"]

# Bildvarianten ohne eigene Sprites: Farbtöne für die Platzhalter
TINTS = [0xffd28a, 0x9fd0ff, 0xc8ffb0, 0xffb0d0, 0xd8c0ff, 0xfff0a0, 0xb0fff0]

SPEED_TICKS = 2          # Bewohner gehen jeden zweiten Takt einen Schritt
PAUSE_CHANCE = 0.35      # an einer Kreuzung kurz stehen bleiben


class Townsfolk:
    def __init__(self, maze, cell, rnd, sprite_count, name, gender):
        self.id = next(_ids)
        self.rnd = rnd
        self.name = name
        self.gender = gender
        self.job = rnd.choice(JOBS)[0 if gender == "m" else 1]
        self.quirk = rnd.choice(QUIRKS)
        self.sprite = rnd.randrange(sprite_count) if sprite_count else -1
        self.tint = rnd.choice(TINTS)
        self.maze = maze
        self.cell = cell
        self.pos = Maze.center(cell)
        self.facing = rnd.choice(maze.exits(cell) or ["S"])
        self.path = []
        self.wait = rnd.randint(0, 20)      # Takte Pause
        self.talk_until = 0.0
        self.last_talk = -1e9
        self.ticks = 0

    def describe(self):
        return f"{self.name}, {self.job}, {self.quirk}"

    def info(self):
        return {"id": self.id, "name": self.name, "x": self.pos[0], "y": self.pos[1], "facing": self.facing,
                "sprite": self.sprite, "tint": self.tint}

    def busy(self, now):
        return now < self.talk_until

    def step(self, now):
        """Ein Spieltakt. Gibt True zurück, wenn sich die Position geändert hat."""
        if self.busy(now):
            return False
        self.ticks += 1
        if self.ticks % SPEED_TICKS:
            return False
        if self.path:
            self.pos = self.path.pop(0)
            return True
        if self.wait > 0:
            self.wait -= 1
            return False
        exits = self.maze.exits(self.cell)
        if not exits:
            return False
        forward = [d for d in exits if d != BACK[self.facing]] or exits
        d = self.rnd.choice(forward)
        nxt = self.maze.neighbor(self.cell, d)
        cx, cy = Maze.center(self.cell)
        dx, dy = DIRS[d]
        self.path = [(cx + dx * i, cy + dy * i) for i in range(1, STEP + 1)]
        self.facing = d
        self.cell = nxt
        if self.rnd.random() < PAUSE_CHANCE:
            self.wait = self.rnd.randint(4, 30)
        self.pos = self.path.pop(0)
        return True


def spawn(maze, count, avoid, rnd, sprite_count):
    cells = [(x, y) for y in range(maze.ch) for x in range(maze.cw) if (x, y) not in avoid]
    rnd.shuffle(cells)
    people = [(n, g) for g, names in NAMES.items() for n in names]
    rnd.shuffle(people)            # jeder Name nur einmal pro Ebene
    return [Townsfolk(maze, c, rnd, sprite_count, *people[i % len(people)]) for i, c in enumerate(cells[:count])]


def distance(a, b):
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5


def dialog_messages(first, second, topic, hint, deep, situation=""):
    """first/second: (Name, Beschreibung). Liefert die Nachrichten für das LLM."""
    lines = "6 bis 8" if deep else "3 bis 4"
    style = ("Sie geraten ins Philosophieren, ernst gemeint, aber mit einem Augenzwinkern."
             if deep else "Ein kurzer, lebendiger Wortwechsel im Vorbeigehen.")
    system = (
        "Du schreibst kurze Gespräche zwischen Figuren in einem Fantasy-Spiel, das live auf YouNow gestreamt wird. "
        "Schauplatz ist eine verlassene Magierstadt. Antworte nur auf Deutsch und ausschließlich mit einem JSON-Objekt. "
        "Jede Zeile höchstens 18 Wörter. Frech und witzig erlaubt, aber nie beleidigend, keine Schimpfwörter, nichts Anstößiges."
    )
    task = (
        f"Figur A: {first[0]}, {first[1]}.\n"
        f"Figur B: {second[0]}, {second[1]}.\n"
        + (f"Lage von A: {situation}\n" if situation else "")
        + f"Sie begegnen sich in einer Gasse. Thema: {topic}. {style}\n"
        + (f"Im Gespräch erwähnt B beiläufig: {hint}\n" if hint else "")
        + f"Schreibe {lines} Zeilen im Wechsel, A beginnt.\n"
        'Antworte als JSON: {"zeilen": [{"wer": "A", "text": "..."}, {"wer": "B", "text": "..."}]}'
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": task}]


def parse_lines(data, max_lines=8):
    out = []
    for z in (data or {}).get("zeilen") or []:
        if not isinstance(z, dict):
            continue
        who = str(z.get("wer", "")).strip().upper()[:1]
        text = " ".join(str(z.get("text", "")).split())[:200]
        if who in ("A", "B") and text:
            out.append((who, text))
        if len(out) >= max_lines:
            break
    return out


GREETINGS = [
    [("B", "Na, auch unterwegs bei dem Wetter?"), ("A", "Immer. Stillstand bekommt mir nicht.")],
    [("B", "Pass auf dich auf, da unten ist es finster."), ("A", "Danke, ich hab ja meinen Mut dabei.")],
    [("B", "Schon wieder ein Abenteurer. Ihr werdet nicht weniger."), ("A", "Und trotzdem ist hier niemand.")],
]


def fallback_lines(rnd):
    return list(rnd.choice(GREETINGS))
