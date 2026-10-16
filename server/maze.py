"""Labyrinth-Generator für die Stadt.

Gerüst ist ein Zellen-Labyrinth (Recursive Backtracker) mit zusätzlichen
Durchbrüchen für mehr Kreuzungen. Daraus entsteht eine Kachelkarte:
- jede Zelle ist ein Gassenstück von GASSE x GASSE Kacheln,
- zwischen den Zellen liegen Häuserblöcke von BLOCK Kacheln Dicke,
- eine offene Verbindung zwischen zwei Zellen ist ein Gassenstück durch den Block,
- Plätze entstehen, wo vier Zellen um einen Block herum verbunden werden und der
  Block dazwischen wegfällt.

Positionen der Figur und von Gegenständen sind Kachelkoordinaten als Kommazahl
(Mitte des Gassenstücks), der Client rechnet sie mal Kachelgröße.
"""

import random
from collections import deque

DIRS = {"N": (0, -1), "E": (1, 0), "S": (0, 1), "W": (-1, 0)}
LEFT = {"N": "W", "W": "S", "S": "E", "E": "N"}
RIGHT = {"N": "E", "E": "S", "S": "W", "W": "N"}
BACK = {"N": "S", "S": "N", "E": "W", "W": "E"}

GASSE = 2   # Breite einer Gasse in Kacheln
BLOCK = 4   # Dicke eines Häuserblocks in Kacheln (2 Reihen Dach, 2 Reihen Fassade)
STEP = GASSE + BLOCK


class Maze:
    def __init__(self, cells_w, cells_h, seed, plazas=3, loop_chance=0.10):
        self.cw = cells_w
        self.ch = cells_h
        self.tw = BLOCK + cells_w * STEP
        self.th = BLOCK + cells_h * STEP
        self.seed = seed
        self.rnd = random.Random(seed)
        self.links = set()          # (zelle, richtung) für jede offene Verbindung, beide Richtungen
        self.plazas = []            # (x, y, b, h) in Kacheln: freie Platzmitte für Brunnen und Deko
        self._carve()
        self._add_loops(loop_chance)
        self._add_plazas(plazas)
        self.tiles = self._build_tiles()
        self.start = (self.rnd.randrange(self.cw), self.rnd.randrange(self.ch))
        self.stairs = self._farthest(self.start)

    # ---------- Geometrie ----------

    @staticmethod
    def origin(cell):
        """Linke obere Kachel des Gassenstücks einer Zelle."""
        return (BLOCK + cell[0] * STEP, BLOCK + cell[1] * STEP)

    @staticmethod
    def center(cell):
        """Mitte des Gassenstücks in Kachelkoordinaten (Kommazahl)."""
        ox, oy = Maze.origin(cell)
        return (ox + GASSE / 2, oy + GASSE / 2)

    def in_cells(self, x, y):
        return 0 <= x < self.cw and 0 <= y < self.ch

    def neighbor(self, cell, d):
        dx, dy = DIRS[d]
        return (cell[0] + dx, cell[1] + dy)

    def _link(self, cell, d):
        n = self.neighbor(cell, d)
        self.links.add((cell, d))
        self.links.add((n, BACK[d]))

    def is_open(self, cell, d):
        return (cell, d) in self.links

    def exits(self, cell):
        return [d for d in DIRS if self.is_open(cell, d)]

    # ---------- Erzeugung ----------

    def _carve(self):
        rnd = self.rnd
        start = (rnd.randrange(self.cw), rnd.randrange(self.ch))
        visited = {start}
        stack = [start]
        while stack:
            x, y = stack[-1]
            nbrs = [(d, (x + dx, y + dy)) for d, (dx, dy) in DIRS.items()
                    if self.in_cells(x + dx, y + dy) and (x + dx, y + dy) not in visited]
            if not nbrs:
                stack.pop()
                continue
            d, nxt = rnd.choice(nbrs)
            self._link((x, y), d)
            visited.add(nxt)
            stack.append(nxt)

    def _add_loops(self, chance):
        for y in range(self.ch):
            for x in range(self.cw):
                for d in ("E", "S"):
                    n = self.neighbor((x, y), d)
                    if self.in_cells(*n) and not self.is_open((x, y), d) and self.rnd.random() < chance:
                        self._link((x, y), d)

    def _add_plazas(self, count):
        used = set()
        tries = 0
        while len(self.plazas) < count and tries < 200:
            tries += 1
            x, y = self.rnd.randrange(self.cw - 1), self.rnd.randrange(self.ch - 1)
            cells = {(x, y), (x + 1, y), (x, y + 1), (x + 1, y + 1)}
            if cells & used:
                continue
            used |= cells
            self._link((x, y), "E")
            self._link((x, y + 1), "E")
            self._link((x, y), "S")
            self._link((x + 1, y), "S")
            ox, oy = self.origin((x, y))
            self.plazas.append((ox + GASSE, oy + GASSE, BLOCK, BLOCK))

    def _build_tiles(self):
        tiles = [[1] * self.tw for _ in range(self.th)]

        def carve(x0, y0, w, h):
            for ty in range(y0, y0 + h):
                for tx in range(x0, x0 + w):
                    tiles[ty][tx] = 0

        for y in range(self.ch):
            for x in range(self.cw):
                ox, oy = self.origin((x, y))
                carve(ox, oy, GASSE, GASSE)
                if self.is_open((x, y), "E"):
                    carve(ox + GASSE, oy, BLOCK, GASSE)
                if self.is_open((x, y), "S"):
                    carve(ox, oy + GASSE, GASSE, BLOCK)
        for (px, py, w, h) in self.plazas:
            carve(px, py, w, h)
        return tiles

    def _farthest(self, start):
        dist = {start: 0}
        q = deque([start])
        far = start
        while q:
            c = q.popleft()
            if dist[c] > dist[far]:
                far = c
            for d in self.exits(c):
                n = self.neighbor(c, d)
                if n not in dist:
                    dist[n] = dist[c] + 1
                    q.append(n)
        return far

    def is_floor(self, tx, ty):
        return 0 <= tx < self.tw and 0 <= ty < self.th and self.tiles[ty][tx] == 0

    def rows(self):
        return ["".join("#" if t else "." for t in row) for row in self.tiles]
