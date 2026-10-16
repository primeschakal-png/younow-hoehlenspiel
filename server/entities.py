"""Bestückung des Labyrinths und Hinweise an Kreuzungen.

Dinge liegen immer auf Zellmitten. Tiefer heißt: mehr Monster und Fallen,
weniger Vorräte.
"""

import itertools

from maze import BACK

_ids = itertools.count(1)

MONSTERS = [
    "Ratte", "Fledermaus", "Riesenspinne", "Goblin",
    "Höhlenwolf", "Skelett", "Grottenschrat", "Oger",
]

HINTS = {
    "spring": "Wasser tropft",
    "chest": "Etwas glitzert im Dunkeln",
    "monster": "Ein Knurren",
    "trap": "Etwas stimmt hier nicht",
    "shrine": "Ein schwaches Leuchten",
    "mushroom": "Es riecht modrig",
    "stairs": "Ein kühler Luftzug von unten",
}


def counts_for_depth(depth):
    return {
        "chest": max(3, 8 - depth),
        "spring": max(2, 6 - depth),
        "mushroom": max(2, 7 - depth),
        "shrine": 1 if depth % 2 == 1 else 0,
        "monster": 3 + depth * 2,
        "trap": 2 + depth,
    }


def populate(maze, depth, rnd):
    """Gibt {zelle: entity} zurück. Start- und Treppenzelle bleiben frei."""
    free = [
        (x, y) for y in range(maze.ch) for x in range(maze.cw)
        if (x, y) not in (maze.start, maze.stairs)
    ]
    rnd.shuffle(free)
    entities = {}
    for kind, n in counts_for_depth(depth).items():
        for _ in range(n):
            if not free:
                return entities
            cell = free.pop()
            ent = {"id": next(_ids), "kind": kind, "cell": cell}
            if kind == "monster":
                top = min(len(MONSTERS), 2 + depth)
                idx = rnd.randrange(max(0, top - 4), top)
                ent["name"] = MONSTERS[idx]
                ent["level"] = idx + 1
            entities[cell] = ent
    return entities


def look_ahead(maze, cell, d, entities, max_cells=6):
    """Folgt dem Gang in Richtung d bis zur nächsten Kreuzung und sammelt,
    was dort liegt. Liefert eine Liste von Arten."""
    found = []
    cur = maze.neighbor(cell, d)
    facing = d
    for _ in range(max_cells):
        ent = entities.get(cur)
        if ent:
            found.append(ent["kind"])
        if cur == maze.stairs:
            found.append("stairs")
        exits = [e for e in maze.exits(cur) if e != BACK[facing]]
        if len(exits) != 1:
            break
        facing = exits[0]
        cur = maze.neighbor(cur, facing)
    return found


def hint_text(kinds, rnd, reliability=0.75, false_chance=0.12):
    """Macht aus gefundenen Arten einen Hinweis. Nicht immer zuverlässig."""
    parts = []
    for k in dict.fromkeys(kinds):  # Reihenfolge behalten, doppelte weg
        if rnd.random() < reliability:
            parts.append(HINTS[k])
    if rnd.random() < false_chance:
        fake = rnd.choice(list(HINTS))
        if HINTS[fake] not in parts:
            parts.append(HINTS[fake])
    return ", ".join(parts) if parts else "Stille"
