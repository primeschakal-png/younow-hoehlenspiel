"""Charakter-System: Persona, zwei Achsen, Archetypen, Vertrauen.

Achse "courage":  -1 feige ... +1 mutig
Achse "audience": -1 eigensinnig ... +1 publikumsnah

Quadranten:  mutig + eigensinnig = Held,    mutig + publikumsnah = Entertainer
             feige + eigensinnig = Feigling, feige + publikumsnah = Schmeichler
Mitte: Abenteurer.

Alle Werte sind begrenzt und wandern langsam zur Grundhaltung zurück.
Der Überlebenswille liegt bewusst außerhalb dieses Systems.
"""

import math
import random

ORIGINS = [
    "aus den Nordmarken", "aus einem Fischerdorf an der Küste", "aus der Hauptstadt",
    "aus einem Bergwerksort", "von einem Bauernhof im Tal", "aus einem Kloster im Gebirge",
    "aus den Sümpfen im Süden", "von fahrendem Volk",
]

CLASSES = ["Kriegerin", "Krieger", "Waldläuferin", "Waldläufer", "Diebin", "Dieb",
           "Söldnerin", "Söldner", "Schatzsucherin", "Schatzsucher", "Gelehrte", "Gelehrter"]

# Eigenschaft: (Wirkung auf courage, Wirkung auf audience)
TRAITS = {
    "mutig": (0.25, 0.0),
    "vorsichtig": (-0.25, 0.0),
    "tollkühn": (0.35, 0.05),
    "ängstlich": (-0.35, 0.0),
    "eitel": (0.0, 0.25),
    "gesellig": (0.0, 0.2),
    "misstrauisch": (0.0, -0.25),
    "eigenbrötlerisch": (0.0, -0.3),
    "gierig": (0.1, 0.05),
    "abergläubisch": (-0.1, 0.0),
    "stolz": (0.1, -0.15),
    "neugierig": (0.1, 0.05),
}

SPEECH = ["knurrig und wortkarg", "geschwätzig", "poetisch und etwas schwülstig",
          "trocken und sarkastisch", "freundlich und naiv", "derb und laut"]

ARCHETYPES = {
    "abenteurer": "Abenteurer",
    "held": "Held",
    "entertainer": "Entertainer",
    "feigling": "Feigling",
    "schmeichler": "Schmeichler",
}

ARCHETYPE_TEXT = {
    "abenteurer": "Ausgeglichen. Geht Risiken ein, wenn sie sich lohnen, und hört auf den Chat, ohne ihm blind zu folgen.",
    "held": "Furchtlos, aber geht den eigenen Weg. Folgt dem Chat, erklärt aber gern, warum er es anders gemacht hätte.",
    "entertainer": "Riskiert etwas für die Show, liebt Publikum und Bestechungen, sucht den Kampf, weil der Chat jubelt.",
    "feigling": "Misstraut allen, schleicht, versteckt sich, will vor allem überleben.",
    "schmeichler": "Will gefallen, aber bloß nicht sterben. Bettelt um Stimmen für den sicheren Weg, bedankt sich überschwänglich.",
}

HALF_LIFE_SECONDS = 30 * 60   # Rückwanderung zur Grundhaltung


def clamp(v, lo=-1.0, hi=1.0):
    return max(lo, min(hi, v))


class Character:
    def __init__(self, name, rnd=None):
        rnd = rnd or random.Random()
        self.name = name
        self.origin = rnd.choice(ORIGINS)
        self.klass = rnd.choice(CLASSES)
        self.traits = rnd.sample(list(TRAITS), 2)
        self.speech = rnd.choice(SPEECH)
        bc = sum(TRAITS[t][0] for t in self.traits) + rnd.uniform(-0.1, 0.1)
        ba = sum(TRAITS[t][1] for t in self.traits) + rnd.uniform(-0.1, 0.1)
        self.base_courage = clamp(bc, -0.45, 0.45)
        self.base_audience = clamp(ba, -0.45, 0.45)
        self.courage = self.base_courage
        self.audience = self.base_audience
        self.trust_chat = 0.0
        self.self_trust = 0.0
        self.trust_users = {}
        self.archetype = "abenteurer"
        self.archetype = self._classify()
        self.near_death_noted = False
        self._last_sent = None

    # ---------- Archetyp ----------

    def _classify(self):
        x, y = self.audience, self.courage
        r = max(abs(x), abs(y))
        cur = self.archetype
        if cur == "abenteurer":
            if r <= 0.3:
                return "abenteurer"
        elif r < 0.15:
            return "abenteurer"

        # Hysterese: ein Vorzeichen kippt erst, wenn die Achse 0.1 ins andere Feld reicht
        brave_now = cur in ("held", "entertainer")
        social_now = cur in ("entertainer", "schmeichler")
        if cur == "abenteurer":
            brave, social = y >= 0, x >= 0
        else:
            brave = y > 0.1 if not brave_now else y > -0.1
            social = x > 0.1 if not social_now else x > -0.1
        if brave and not social:
            return "held"
        if brave and social:
            return "entertainer"
        if not brave and not social:
            return "feigling"
        return "schmeichler"

    def intensity(self):
        r = max(abs(self.audience), abs(self.courage))
        if self.archetype == "abenteurer":
            return ""
        if r < 0.45:
            return "leicht"
        if r < 0.75:
            return "deutlich"
        return "extrem"

    def label(self):
        base = ARCHETYPES[self.archetype]
        inten = self.intensity()
        if inten == "leicht":
            return "leichter " + base
        if inten == "extrem":
            return "extremer " + base
        return base

    def _update_archetype(self):
        new = self._classify()
        if new != self.archetype:
            self.archetype = new
            return True
        return False

    # ---------- Veränderungen ----------

    def courage_event(self, delta):
        self.courage = clamp(self.courage + delta)
        return self._update_archetype()

    def outcome(self, value, decision):
        """value > 0 gut, < 0 schlecht. decision: wer hat den Weg gewählt."""
        if not decision:
            return False
        if decision["source"] == "chat":
            self.trust_chat = clamp(self.trust_chat + 0.12 * value)
            self.audience = clamp(self.audience + 0.07 * value)
            for user in decision.get("voters", []):
                self.trust_users[user] = clamp(self.trust_users.get(user, 0.0) + 0.18 * value)
        else:
            self.self_trust = clamp(self.self_trust + 0.12 * value)
            self.audience = clamp(self.audience - 0.04 * value)
        return self._update_archetype()

    def on_chat(self, user):
        self.audience = clamp(self.audience + 0.003)
        self.trust_users.setdefault(user, 0.0)
        return self._update_archetype()

    def near_death(self):
        if self.near_death_noted:
            return False
        self.near_death_noted = True
        return self.courage_event(-0.15)

    def drift(self, seconds):
        f = math.exp(-math.log(2) * seconds / HALF_LIFE_SECONDS)
        self.courage = self.base_courage + (self.courage - self.base_courage) * f
        self.audience = self.base_audience + (self.audience - self.base_audience) * f
        self.trust_chat *= f
        self.self_trust *= f
        for u in list(self.trust_users):
            self.trust_users[u] *= f
        return self._update_archetype()

    def recovered(self):
        """Nach Erholung darf ein neuer Beinahe-Tod wieder zählen."""
        self.near_death_noted = False

    # ---------- Ausgabe ----------

    def info(self):
        top_friends = sorted(self.trust_users.items(), key=lambda kv: kv[1], reverse=True)
        return {
            "type": "character",
            "courage": round(self.courage, 3),
            "audience": round(self.audience, 3),
            "archetype": self.archetype,
            "label": self.label(),
            "trust_chat": round(self.trust_chat, 2),
            "self_trust": round(self.self_trust, 2),
            "persona": f"{self.klass} {self.origin}",
            "traits": self.traits,
            "friends": [u for u, v in top_friends if v > 0.2][:3],
            "foes": [u for u, v in reversed(top_friends) if v < -0.2][:3],
        }

    def changed_enough(self):
        cur = (round(self.courage, 2), round(self.audience, 2), round(self.trust_chat, 1), round(self.self_trust, 1))
        if cur != self._last_sent:
            self._last_sent = cur
            return True
        return False

    def describe(self):
        """Persona und Lage als Sätze, für das LLM in Etappe 5."""
        lines = [
            f"Du bist {self.name}, {self.klass} {self.origin}.",
            f"Du bist {self.traits[0]} und {self.traits[1]}, deine Sprechweise ist {self.speech}.",
            f"Gerade bist du ein {self.label()}: {ARCHETYPE_TEXT[self.archetype]}",
            "Du weißt, dass du in einem Livestream bist und Zuschauer dir zusehen.",
        ]
        if self.trust_chat > 0.3:
            lines.append("Der Chat hat dir oft gut geraten, du vertraust ihm.")
        elif self.trust_chat < -0.3:
            lines.append("Der Chat hat dich mehrfach in Gefahr geschickt, du traust ihm kaum noch.")
        if self.self_trust > 0.3:
            lines.append("Deine eigenen Entscheidungen haben sich bewährt.")
        elif self.self_trust < -0.3:
            lines.append("Deine eigenen Entscheidungen gingen zuletzt oft schief.")
        info = self.info()
        if info["friends"]:
            lines.append("Diese Zuschauer magst du, weil sie dir geholfen haben: " + ", ".join(info["friends"]) + ".")
        if info["foes"]:
            lines.append("Diesen Zuschauern misstraust du: " + ", ".join(info["foes"]) + ".")
        return " ".join(lines)
