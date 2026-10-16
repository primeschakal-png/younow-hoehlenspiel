"""Spielzustand: Figur, Bewegung, Nebel, Abstimmung an Kreuzungen.

Etappe 1: noch ohne Überleben, Charakter und LLM. Bei fehlenden Stimmen
entscheidet vorerst der Zufall (in Etappe 5 das LLM).
"""

import random
import time

from maze import Maze

LEFT = {"N": "W", "W": "S", "S": "E", "E": "N"}
RIGHT = {"N": "E", "E": "S", "S": "W", "W": "N"}
BACK = {"N": "S", "S": "N", "E": "W", "W": "E"}

COMMANDS = {
    "!links": "links", "!l": "links",
    "!rechts": "rechts", "!r": "rechts",
    "!geradeaus": "geradeaus", "!g": "geradeaus",
    "!zurueck": "zurueck", "!zurück": "zurueck", "!z": "zurueck",
}

LABEL_ORDER = ["links", "geradeaus", "rechts", "zurueck"]


class Game:
    def __init__(self, vote_seconds=28, step_seconds=0.25, cells_w=25, cells_h=15, reveal_radius=2):
        self.vote_seconds = vote_seconds
        self.step_seconds = step_seconds
        self.cells_w = cells_w
        self.cells_h = cells_h
        self.reveal_radius = reveal_radius
        self.depth = 0
        self.outbox = []
        self.new_level()

    # ---------- Nachrichten ----------

    def emit(self, msg):
        self.outbox.append(msg)

    def flush(self):
        out, self.outbox = self.outbox, []
        return out

    def log(self, text):
        self.emit({"type": "log", "text": text})

    # ---------- Ebenen ----------

    def new_level(self):
        self.depth += 1
        seed = random.randrange(1 << 30)
        self.maze = Maze(self.cells_w, self.cells_h, seed, grottos=3 + self.depth)
        self.cell = self.maze.start
        self.pos = Maze.center(self.cell)
        self.facing = random.choice(self.maze.exits(self.cell) or ["S"])
        self.moved = False
        self.path = []
        self.vote = None
        self.state = "walking"
        self.revealed = set()
        self._reveal_around(self.pos, emit=False)
        self.emit(self.full_state())
        self.log(f"Ebene {self.depth} betreten.")

    # ---------- Zustand ----------

    def full_state(self):
        return {
            "type": "state",
            "depth": self.depth,
            "tw": self.maze.tw,
            "th": self.maze.th,
            "tiles": self.maze.rows(),
            "revealed": [list(t) for t in self.revealed],
            "pos": list(self.pos),
            "facing": self.facing,
            "stairs": list(Maze.center(self.maze.stairs)),
            "step": self.step_seconds,
            "vote": self._vote_info(),
        }

    def _vote_info(self):
        if not self.vote:
            return None
        return {
            "options": self.vote["labels"],
            "counts": self._counts(),
            "remaining": max(0.0, self.vote["ends"] - time.monotonic()),
        }

    # ---------- Nebel ----------

    def _reveal_around(self, pos, emit=True):
        r = self.reveal_radius
        new = []
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                tx, ty = pos[0] + dx, pos[1] + dy
                if 0 <= tx < self.maze.tw and 0 <= ty < self.maze.th and (tx, ty) not in self.revealed:
                    self.revealed.add((tx, ty))
                    new.append([tx, ty])
        if emit and new:
            self.emit({"type": "reveal", "tiles": new})

    # ---------- Ablauf ----------

    def tick(self):
        if self.state == "voting":
            if time.monotonic() >= self.vote["ends"]:
                self._end_vote()
            return
        if self.path:
            self.pos = self.path.pop(0)
            self._reveal_around(self.pos)
            self.emit({"type": "pos", "pos": list(self.pos), "facing": self.facing})
            if not self.path:
                self._decide()
            return
        self._decide()

    def _relative(self, d):
        if d == self.facing:
            return "geradeaus"
        if d == LEFT[self.facing]:
            return "links"
        if d == RIGHT[self.facing]:
            return "rechts"
        return "zurueck"

    def _decide(self):
        if self.cell == self.maze.stairs:
            self.log("Eine Treppe! Es geht tiefer hinab.")
            self.new_level()
            return
        exits = self.maze.exits(self.cell)
        back = BACK[self.facing] if self.moved else None
        forward = [d for d in exits if d != back]
        if not forward:
            self.log("Sackgasse. Zurück.")
            self._go(back)
        elif len(forward) == 1:
            self._go(forward[0])
        else:
            self._start_vote(exits)

    def _go(self, d):
        nxt = self.maze.neighbor(self.cell, d)
        cx, cy = Maze.center(self.cell)
        nx, ny = Maze.center(nxt)
        self.path = [((cx + nx) // 2, (cy + ny) // 2), (nx, ny)]
        self.facing = d
        self.cell = nxt
        self.moved = True
        self.emit({"type": "pos", "pos": list(self.pos), "facing": self.facing})

    # ---------- Abstimmung ----------

    def _start_vote(self, exits):
        options = {self._relative(d): d for d in exits}
        labels = [l for l in LABEL_ORDER if l in options]
        self.vote = {
            "options": options,
            "labels": labels,
            "votes": {},
            "ends": time.monotonic() + self.vote_seconds,
        }
        self.state = "voting"
        self.emit({"type": "vote_start", "options": labels, "seconds": self.vote_seconds})

    def _counts(self):
        counts = {l: 0 for l in self.vote["labels"]}
        for label in self.vote["votes"].values():
            counts[label] += 1
        return counts

    def _end_vote(self):
        counts = self._counts()
        total = sum(counts.values())
        if total:
            best = max(counts.values())
            top = [l for l, c in counts.items() if c == best]
            choice = random.choice(top)
            reason = "Mehrheit" if len(top) == 1 else "Gleichstand, Zufall entscheidet"
        else:
            choice = random.choice(self.vote["labels"])
            reason = "Keine Stimmen, die Figur entscheidet (vorerst Zufall)"
        d = self.vote["options"][choice]
        self.emit({"type": "vote_end", "choice": choice, "reason": reason, "counts": counts})
        self.vote = None
        self.state = "walking"
        self._go(d)

    # ---------- Chat ----------

    def on_chat(self, user, text):
        user = (user or "").strip()[:30] or "Gast"
        text = (text or "").strip()[:200]
        if not text:
            return
        self.emit({"type": "chat", "user": user, "text": text})
        if self.state != "voting":
            return
        word = text.split()[0].lower()
        label = COMMANDS.get(word)
        if label and label in self.vote["options"]:
            self.vote["votes"][user] = label
            self.emit({"type": "vote_update", "counts": self._counts()})
