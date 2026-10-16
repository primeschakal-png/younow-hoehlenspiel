"""Spielzustand: Figur, Bewegung, Nebel, Abstimmung, Überleben, Begegnungen, Lager.

Etappe 2: noch ohne Charakter-System und LLM. Bei fehlenden Stimmen
entscheidet vorerst der Zufall (in Etappe 5 das LLM).
"""

import random
import time
from datetime import datetime

import entities as ent_mod
from hero import Hero
from maze import BACK, LEFT, RIGHT, Maze

COMMANDS = {
    "!links": "links", "!l": "links",
    "!rechts": "rechts", "!r": "rechts",
    "!geradeaus": "geradeaus", "!g": "geradeaus",
    "!zurueck": "zurueck", "!zurück": "zurueck", "!z": "zurueck",
}

LABEL_ORDER = ["links", "geradeaus", "rechts", "zurueck"]

# Abstimmwerte, hier wird nachjustiert
BAL = {
    "thirst_per_tile": 0.2,
    "hunger_per_tile": 0.12,
    "camp_need_factor": 0.03,       # Verbrauch im Lager pro Tick relativ zu einem Schritt
    "starve_tiles_per_hp": 12,       # bei 0 Hunger oder Durst: 1 LP alle x Schritte
    "auto_eat_below": 35,
    "auto_drink_below": 35,
    "food_value": 45,
    "cooked_food_value": 65,
    "water_value": 50,
    "mushroom_value": 30,
    "potion_heal": 8,
    "camp_heal_every": 40,          # Ticks pro geheiltem LP im Lager
    "hero_bonus": 2,
    "event_pause": 3.0,             # Sekunden Pause nach einer Begegnung
    "death_pause": 8.0,
}

CAMP_ACTIVITIES = [
    ("ausruhen", "ruht sich am Feuer aus"),
    ("flicken", "flickt die Ausrüstung"),
    ("schaerfen", "schärft die Klinge"),
    ("tagebuch", "schreibt ins Tagebuch"),
    ("lauschen", "lauscht in die Dunkelheit"),
]


class Game:
    def __init__(self, vote_seconds=28, step_seconds=0.25, idle_minutes=5.0, idle_vote_seconds=10,
                 cells_w=25, cells_h=15, reveal_radius=2):
        self.vote_seconds = vote_seconds
        self.idle_vote_seconds = idle_vote_seconds
        self.step_seconds = step_seconds
        self.idle_seconds = idle_minutes * 60
        self.cells_w = cells_w
        self.cells_h = cells_h
        self.reveal_radius = reveal_radius
        self.rnd = random.Random()
        self.outbox = []
        self.hall = []
        self.last_chat = time.monotonic()
        self.hero = Hero()
        self.depth = 0
        self.new_level()

    # ---------- Nachrichten ----------

    def emit(self, msg):
        self.outbox.append(msg)

    def flush(self):
        out, self.outbox = self.outbox, []
        return out

    def log(self, text):
        self.emit({"type": "log", "text": text})

    def emit_stats(self):
        self.emit({"type": "stats", "hero": self.hero.stats()})

    # ---------- Ebenen und Helden ----------

    def new_level(self):
        self.depth += 1
        seed = self.rnd.randrange(1 << 30)
        self.maze = Maze(self.cells_w, self.cells_h, seed, grottos=3 + self.depth)
        self.entities = ent_mod.populate(self.maze, self.depth, random.Random(seed + 1))
        self.cell = self.maze.start
        self.pos = Maze.center(self.cell)
        self.facing = self.rnd.choice(self.maze.exits(self.cell) or ["S"])
        self.moved = False
        self.path = []
        self.vote = None
        self.camp = None
        self.state = "walking"
        self.resume_at = 0.0
        self.camp_left_at = 0.0
        self.revealed = set()
        self._reveal_around(self.pos, emit=False)
        self.emit(self.full_state())
        self.log(f"{self.hero.name} betritt Ebene {self.depth}.")

    def new_hero(self):
        self.hero = Hero()
        self.depth = 0
        self.new_level()
        self.log(f"Ein neuer Abenteurer steigt hinab: {self.hero.name}.")

    def die(self, cause):
        self.hero.hp = 0
        entry = {"name": self.hero.name, "depth": self.depth, "cause": cause, "gold": self.hero.gold}
        self.hall.append(entry)
        self.hall = self.hall[-20:]
        self.state = "dead"
        self.vote = None
        self.camp = None
        self.path = []
        self.resume_at = time.monotonic() + BAL["death_pause"]
        self.emit_stats()
        self.emit({"type": "death", **entry, "hall": self.hall[-5:]})

    # ---------- Zustand ----------

    def visible_entities(self):
        out = []
        for e in self.entities.values():
            if e["kind"] == "trap":
                continue
            x, y = Maze.center(e["cell"])
            out.append({"id": e["id"], "kind": e["kind"], "x": x, "y": y, "name": e.get("name")})
        return out

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
            "hero": self.hero.stats(),
            "entities": self.visible_entities(),
            "camp": self._camp_info(),
            "dead": self.state == "dead",
            "hall": self.hall[-5:],
        }

    def _vote_info(self):
        if not self.vote:
            return None
        return {
            "options": self.vote["labels"],
            "counts": self._counts(),
            "hints": self.vote["hints"],
            "remaining": max(0.0, self.vote["ends"] - time.monotonic()),
        }

    def _camp_info(self):
        if not self.camp:
            return {"active": False}
        return {"active": True, "text": self.camp["text"], "pos": list(self.pos)}

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

    # ---------- Hilfen ----------

    def idle(self):
        return time.monotonic() - self.last_chat > self.idle_seconds

    def pause(self, seconds):
        self.state = "event"
        self.resume_at = time.monotonic() + seconds

    def dice(self, label, target, bonus=None):
        bonus = BAL["hero_bonus"] if bonus is None else bonus
        roll = self.rnd.randint(1, 20)
        total = roll + bonus
        success = roll == 20 or (roll != 1 and total >= target)
        self.emit({"type": "dice", "label": label, "roll": roll, "bonus": bonus,
                   "target": target, "success": success})
        return success

    def damage(self, amount, cause):
        self.hero.hp -= amount
        if self.hero.hp <= 0:
            self.die(cause)
        else:
            self.emit_stats()

    def remove_entity(self, cell):
        e = self.entities.pop(cell, None)
        if e:
            self.emit({"type": "entity_remove", "id": e["id"]})

    # ---------- Bedürfnisse ----------

    def _needs(self, factor=1.0):
        h = self.hero
        h.thirst = max(0.0, h.thirst - BAL["thirst_per_tile"] * factor)
        h.hunger = max(0.0, h.hunger - BAL["hunger_per_tile"] * factor)
        self._auto_consume()
        if h.thirst <= 0 or h.hunger <= 0:
            h.starve_steps += factor
            if h.starve_steps >= BAL["starve_tiles_per_hp"]:
                h.starve_steps = 0
                cause = "verdurstet" if h.thirst <= 0 else "verhungert"
                self.damage(1, cause)

    def _auto_consume(self):
        h = self.hero
        if h.thirst < BAL["auto_drink_below"] and h.water > 0:
            h.water -= 1
            h.thirst = min(100.0, h.thirst + BAL["water_value"])
            self.log(f"{h.name} trinkt aus der Flasche.")
        if h.hunger < BAL["auto_eat_below"] and h.food > 0:
            h.food -= 1
            h.hunger = min(100.0, h.hunger + BAL["food_value"])
            self.log(f"{h.name} isst etwas Proviant.")
        if h.hp <= 6 and h.potions > 0:
            h.potions -= 1
            h.heal(BAL["potion_heal"])
            self.log(f"{h.name} trinkt einen Heiltrank.")

    # ---------- Ablauf ----------

    def tick(self):
        now = time.monotonic()
        if self.state == "dead":
            if now >= self.resume_at:
                self.new_hero()
            return
        if self.state == "event":
            if now >= self.resume_at:
                self.state = "walking"
                self._decide()
            return
        if self.state == "voting":
            if now >= self.vote["ends"]:
                self._end_vote()
            return
        if self.state == "camp":
            self._camp_tick(now)
            return
        if self.path:
            self.pos = self.path.pop(0)
            self._reveal_around(self.pos)
            self.emit({"type": "pos", "pos": list(self.pos), "facing": self.facing})
            self._needs()
            self.emit_stats()
            if self.state == "dead":
                return
            if not self.path:
                self._arrive()
            return
        self._decide()

    def _arrive(self):
        e = self.entities.get(self.cell)
        if e:
            self._encounter(e)
            if self.state != "walking":
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
        if self.idle() and self._can_camp():
            self._start_camp()
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

    # ---------- Begegnungen ----------

    def _encounter(self, e):
        h = self.hero
        kind = e["kind"]
        cell = e["cell"]
        if kind == "spring":
            h.thirst = 100.0
            h.water = h.max_water
            self.log(f"Eine Quelle! {h.name} trinkt und füllt die Flaschen.")
            self.emit_stats()
            return  # Quellen bleiben, kein Halt nötig

        if kind == "chest":
            self.remove_entity(cell)
            loot = self._chest_loot()
            self.log(f"{h.name} öffnet eine Truhe: {loot}.")
            self.emit_stats()
            self.pause(BAL["event_pause"])
            return

        if kind == "mushroom":
            self.remove_entity(cell)
            if self.rnd.random() < 0.7:
                h.hunger = min(100.0, h.hunger + BAL["mushroom_value"])
                self.log(f"{h.name} isst ein paar Pilze. Nicht schlecht.")
                self.emit_stats()
            else:
                self.log("Die Pilze waren giftig!")
                self.damage(2, "an giftigen Pilzen gestorben")
            if self.state != "dead":
                self.pause(BAL["event_pause"])
            return

        if kind == "shrine":
            self.remove_entity(cell)
            h.hp = h.max_hp
            self.log(f"Ein alter Schrein. {h.name} fühlt sich wie neu geboren.")
            self.emit_stats()
            self.pause(BAL["event_pause"])
            return

        if kind == "trap":
            self.remove_entity(cell)
            target = 10 + self.depth // 2
            if self.dice("Falle! Ausweichen", target):
                self.log(f"Eine Falle schnappt zu, aber {h.name} springt rechtzeitig weg.")
            else:
                dmg = self.rnd.randint(1, 4) + self.depth // 2
                self.log(f"Eine Falle! {h.name} verliert {dmg} Lebenspunkte.")
                self.damage(dmg, "in eine Falle gelaufen")
            if self.state != "dead":
                self.pause(BAL["event_pause"])
            return

        if kind == "monster":
            self.remove_entity(cell)
            name = e["name"]
            target = 8 + e["level"] + self.depth
            if self.dice(f"Kampf gegen {name}", target):
                loot = ""
                if self.rnd.random() < 0.5 and h.food < h.max_food:
                    h.food += 1
                    loot = " und findet etwas Essbares"
                gold = self.rnd.randint(0, 3 + self.depth)
                h.gold += gold
                if gold:
                    loot += f", dazu {gold} Gold"
                self.log(f"{h.name} besiegt {name}{loot}.")
                self.emit_stats()
            else:
                dmg = self.rnd.randint(1, 4) + e["level"] // 2 + self.depth // 2
                self.log(f"{name} erwischt {h.name}: {dmg} Schaden. Das Biest flieht.")
                self.damage(dmg, f"von {name} getötet")
            if self.state != "dead":
                self.pause(BAL["event_pause"])
            return

    def _chest_loot(self):
        h = self.hero
        rich = max(0.3, 1.0 - self.depth * 0.08)  # tiefer = karger
        found = []
        if self.rnd.random() < 0.6 * rich and h.food < h.max_food:
            n = min(h.max_food - h.food, self.rnd.randint(1, 2))
            h.food += n
            found.append(f"{n}x Proviant")
        if self.rnd.random() < 0.5 * rich and h.water < h.max_water:
            n = min(h.max_water - h.water, self.rnd.randint(1, 2))
            h.water += n
            found.append(f"{n}x Wasser")
        if self.rnd.random() < 0.25 and h.potions < h.max_potions:
            h.potions += 1
            found.append("einen Heiltrank")
        gold = self.rnd.randint(1, 5 + self.depth * 2)
        h.gold += gold
        found.append(f"{gold} Gold")
        return ", ".join(found)

    # ---------- Lager ----------

    def _can_camp(self):
        h = self.hero
        if self.time_since_camp() < 60:
            return False
        thirsty = h.thirst < 70 and h.water == 0
        hungry = h.hunger < 60 and h.food == 0
        return not thirsty and not hungry

    def time_since_camp(self):
        return time.monotonic() - self.camp_left_at

    def _night(self):
        hour = datetime.now().hour
        return hour >= 23 or hour < 6

    def _start_camp(self):
        self.state = "camp"
        self.camp = {"text": "macht ein Feuer", "next": time.monotonic() + 8, "ticks": 0}
        self.log(f"Niemand da. {self.hero.name} schlägt ein Lager auf.")
        self.emit({"type": "camp", **self._camp_info()})

    def _leave_camp(self, reason):
        self.camp = None
        self.state = "walking"
        self.camp_left_at = time.monotonic()
        self.log(reason)
        self.emit({"type": "camp", "active": False})

    def _camp_tick(self, now):
        h = self.hero
        self.camp["ticks"] += 1
        self._needs(BAL["camp_need_factor"])
        if self.state == "dead":
            return
        if self.camp["ticks"] % BAL["camp_heal_every"] == 0 and h.hp < h.max_hp:
            h.heal(1)
        if self.camp["ticks"] % 8 == 0:
            self.emit_stats()

        if (h.thirst < 60 and h.water == 0) or (h.hunger < 50 and h.food == 0):
            self._leave_camp(f"{h.name} packt zusammen. Die Vorräte gehen aus, es muss weitergehen.")
            return

        if now < self.camp["next"]:
            return

        # neue Tätigkeit
        if self._night():
            text = "schläft am Feuer"
        elif h.hunger < 70 and h.food > 0 and self.rnd.random() < 0.6:
            h.food -= 1
            h.hunger = min(100.0, h.hunger + BAL["cooked_food_value"])
            text = "kocht sich etwas über dem Feuer"
            self.emit_stats()
        elif h.hp < h.max_hp * 0.5:
            text = "schläft, um Kräfte zu sammeln"
        else:
            text = self.rnd.choice(CAMP_ACTIVITIES)[1]
        self.camp["text"] = text
        self.camp["next"] = now + self.rnd.uniform(15, 25)
        self.emit({"type": "camp", **self._camp_info()})

        # kleine Störungen
        r = self.rnd.random()
        if r < 0.05 and h.food > 0:
            h.food -= 1
            self.log("Eine Ratte huscht mit etwas Proviant davon!")
            self.emit_stats()
        elif r < 0.15:
            self.log(self.rnd.choice([
                "Ein Geräusch in der Dunkelheit.",
                "Irgendwo tropft Wasser.",
                "Das Feuer knistert.",
                "Ein kalter Luftzug lässt die Flammen flackern.",
            ]))

    # ---------- Abstimmung ----------

    def _start_vote(self, exits):
        options = {self._relative(d): d for d in exits}
        labels = [l for l in LABEL_ORDER if l in options]
        hints = {}
        for label, d in options.items():
            kinds = ent_mod.look_ahead(self.maze, self.cell, d, self.entities)
            if self.maze.neighbor(self.cell, d) == self.maze.stairs and "stairs" not in kinds:
                kinds.append("stairs")
            hints[label] = ent_mod.hint_text(kinds, self.rnd)
        seconds = self.idle_vote_seconds if self.idle() else self.vote_seconds
        self.vote = {
            "options": options,
            "labels": labels,
            "hints": hints,
            "votes": {},
            "ends": time.monotonic() + seconds,
        }
        self.state = "voting"
        self.emit({"type": "vote_start", "options": labels, "hints": hints, "seconds": seconds})

    def _own_choice(self):
        """Eigene Entscheidung ohne Stimmen, bis das LLM das übernimmt (Etappe 5).
        Folgt dem Überlebenswillen: Hinweise werden nach aktueller Not gewichtet."""
        h = self.hero
        thirst_need = (100 - h.thirst) / 100 + (0.5 if h.water == 0 else 0)
        hunger_need = (100 - h.hunger) / 100 + (0.5 if h.food == 0 else 0)
        hurt = 1 - h.hp / h.max_hp
        best, best_score = None, None
        for label in self.vote["labels"]:
            hint = self.vote["hints"][label]
            score = self.rnd.uniform(0, 0.6)
            if "Wasser" in hint:
                score += 1.5 * thirst_need
            if "modrig" in hint:
                score += 0.8 * hunger_need
            if "glitzert" in hint:
                score += 0.4 + 0.6 * max(thirst_need, hunger_need)
            if "Leuchten" in hint:
                score += 1.5 * hurt
            if "Knurren" in hint:
                score -= 1.2 * hurt
            if "stimmt hier nicht" in hint:
                score -= 0.5 + hurt
            if "Luftzug" in hint:
                score += 0.3 if h.hp > h.max_hp * 0.5 else -0.2
            if label == "zurueck":
                score -= 0.5
            if best_score is None or score > best_score:
                best, best_score = label, score
        return best

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
            choice = self.rnd.choice(top)
            reason = "Mehrheit" if len(top) == 1 else "Gleichstand, Zufall entscheidet"
        else:
            choice = self._own_choice()
            reason = "Keine Stimmen, die Figur folgt ihrem Gespür"
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
        self.last_chat = time.monotonic()
        self.emit({"type": "chat", "user": user, "text": text})
        if self.state == "camp":
            self._leave_camp(f"Besuch! {self.hero.name} packt das Lager zusammen.")
            return
        if self.state != "voting":
            return
        word = text.split()[0].lower()
        label = COMMANDS.get(word)
        if label and label in self.vote["options"]:
            self.vote["votes"][user] = label
            self.emit({"type": "vote_update", "counts": self._counts()})
