"""Labyrinth-Generator.

Gerüst ist ein Zellen-Labyrinth (Recursive Backtracker). Daraus entsteht ein
Kachelraster mit Wänden (1) und Boden (0). Zusätzliche Durchbrüche erzeugen
Schleifen und damit mehr Kreuzungen, Grotten geben Höhlenoptik.
Die Verbindungen zwischen Zellen werden immer aus dem Kachelraster gelesen,
damit Grotten und Durchbrüche automatisch berücksichtigt werden.
"""

import random
from collections import deque

DIRS = {"N": (0, -1), "E": (1, 0), "S": (0, 1), "W": (-1, 0)}


class Maze:
    def __init__(self, cells_w, cells_h, seed, grottos=4, loop_chance=0.10):
        self.cw = cells_w
        self.ch = cells_h
        self.tw = cells_w * 2 + 1
        self.th = cells_h * 2 + 1
        self.seed = seed
        self.rnd = random.Random(seed)
        self.tiles = [[1] * self.tw for _ in range(self.th)]
        self._carve()
        self._add_loops(loop_chance)
        self._add_grottos(grottos)
        self.start = (self.rnd.randrange(self.cw), self.rnd.randrange(self.ch))
        self.stairs = self._farthest(self.start)

    @staticmethod
    def center(cell):
        return (cell[0] * 2 + 1, cell[1] * 2 + 1)

    def in_cells(self, x, y):
        return 0 <= x < self.cw and 0 <= y < self.ch

    def is_floor(self, tx, ty):
        return 0 <= tx < self.tw and 0 <= ty < self.th and self.tiles[ty][tx] == 0

    def _carve(self):
        rnd = self.rnd
        start = (rnd.randrange(self.cw), rnd.randrange(self.ch))
        visited = {start}
        stack = [start]
        sx, sy = self.center(start)
        self.tiles[sy][sx] = 0
        while stack:
            x, y = stack[-1]
            nbrs = []
            for d, (dx, dy) in DIRS.items():
                nx, ny = x + dx, y + dy
                if self.in_cells(nx, ny) and (nx, ny) not in visited:
                    nbrs.append((d, (nx, ny)))
            if not nbrs:
                stack.pop()
                continue
            d, nxt = rnd.choice(nbrs)
            dx, dy = DIRS[d]
            tx, ty = self.center((x, y))
            self.tiles[ty + dy][tx + dx] = 0
            self.tiles[ty + 2 * dy][tx + 2 * dx] = 0
            visited.add(nxt)
            stack.append(nxt)

    def _add_loops(self, chance):
        for y in range(self.ch):
            for x in range(self.cw):
                tx, ty = self.center((x, y))
                if x + 1 < self.cw and self.tiles[ty][tx + 1] == 1 and self.rnd.random() < chance:
                    self.tiles[ty][tx + 1] = 0
                if y + 1 < self.ch and self.tiles[ty + 1][tx] == 1 and self.rnd.random() < chance:
                    self.tiles[ty + 1][tx] = 0

    def _add_grottos(self, count):
        for _ in range(count):
            cx, cy = self.center((self.rnd.randrange(self.cw), self.rnd.randrange(self.ch)))
            for ty in range(cy - 1, cy + 2):
                for tx in range(cx - 1, cx + 2):
                    if 1 <= tx < self.tw - 1 and 1 <= ty < self.th - 1:
                        self.tiles[ty][tx] = 0

    def is_open(self, cell, d):
        dx, dy = DIRS[d]
        nx, ny = cell[0] + dx, cell[1] + dy
        if not self.in_cells(nx, ny):
            return False
        tx, ty = self.center(cell)
        return self.tiles[ty + dy][tx + dx] == 0

    def exits(self, cell):
        return [d for d in DIRS if self.is_open(cell, d)]

    def neighbor(self, cell, d):
        dx, dy = DIRS[d]
        return (cell[0] + dx, cell[1] + dy)

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

    def rows(self):
        return ["".join("#" if t else "." for t in row) for row in self.tiles]
