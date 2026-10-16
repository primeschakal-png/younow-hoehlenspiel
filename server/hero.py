"""Die Figur: Lebenspunkte, Hunger, Durst, Vorräte.

Hunger und Durst laufen von 100 (satt) bis 0 (verhungert/verdurstet).
"""

import random

# Die Spielfigur ist ein bärtiger Mann, deshalb nur männliche Namen
NAMES = [
    "Borin", "Kael", "Torvik", "Garm", "Dorn", "Brann", "Rurik", "Odo",
    "Haldor", "Fenwick", "Grim", "Tobias", "Ansgar", "Merek", "Ulf", "Jorund",
]


class Hero:
    def __init__(self, name=None):
        self.name = name or random.choice(NAMES)
        self.max_hp = 20
        self.hp = 20
        self.hunger = 100.0
        self.thirst = 100.0
        self.food = 2
        self.water = 2
        self.potions = 0
        self.gold = 0
        self.max_food = 4
        self.max_water = 3
        self.max_potions = 2
        self.starve_steps = 0

    def alive(self):
        return self.hp > 0

    def heal(self, amount):
        self.hp = min(self.max_hp, self.hp + amount)

    def stats(self):
        return {
            "name": self.name,
            "hp": self.hp,
            "max_hp": self.max_hp,
            "hunger": round(self.hunger),
            "thirst": round(self.thirst),
            "food": self.food,
            "water": self.water,
            "potions": self.potions,
            "gold": self.gold,
        }
