"""YouNow-Anbindung ohne Browser: fragt die öffentliche Broadcast-Info ab und gibt neue
Chatnachrichten und Geschenke an das Spiel weiter.

https://api.younow.com/php/api/broadcast/info/curId=0/user=<Name>
liefert unter "comments" die letzten Chatnachrichten mit Namen. Geschenke stehen dort als
Systemtext, z. B. "Gave the Pearl Tip gift and 2,500 likes to PixelElliott".
"""

import asyncio
import re
import time
from collections import deque

import aiohttp

API = "https://api.younow.com/php/api/broadcast/info/curId=0/user={user}"

GIFT_RE = re.compile(r"^Gave (?:the |a |an )?(?P<gift>.+?) gift(?: and (?P<likes>[\d.,]+) likes?)? to ", re.I)
LIKES_RE = re.compile(r"^Gave (?P<likes>[\d.,]+) likes? to ", re.I)


def parse_gift(text):
    """Gibt (Geschenkname, Likes-Wert) zurück oder None, wenn es kein Geschenk ist."""
    m = GIFT_RE.match(text or "")
    if m:
        likes = int(re.sub(r"[.,]", "", m.group("likes") or "0") or 0)
        return m.group("gift").strip(), likes
    m = LIKES_RE.match(text or "")
    if m:
        return "Likes", int(re.sub(r"[.,]", "", m.group("likes")))
    return None


class YouNowPoller:
    def __init__(self):
        self.enabled = False
        self.user = ""
        self.interval = 3.0
        self.session = None
        self.seen = deque(maxlen=2000)
        self.seen_set = set()
        self.primed_for = None      # für welchen Stream die alten Nachrichten schon übersprungen wurden
        self.status = {"state": "aus", "viewers": None, "likes": None, "comments": 0, "gifts": 0,
                       "last_ok": None, "error": None, "broadcast": None}

    async def start(self):
        self.session = aiohttp.ClientSession(headers={"User-Agent": "Mozilla/5.0 Hoehlenspiel"})

    async def close(self):
        if self.session:
            await self.session.close()

    def configure(self, enabled, user, interval):
        user = (user or "").strip().lstrip("@")
        if user != self.user:
            self.primed_for = None
        self.enabled = bool(enabled and user)
        self.user = user
        self.interval = max(1.5, float(interval or 3))
        if not self.enabled:
            self.status["state"] = "aus" if not enabled else "kein Name eingetragen"

    def _remember(self, key):
        if key in self.seen_set:
            return False
        if len(self.seen) == self.seen.maxlen:
            self.seen_set.discard(self.seen[0])
        self.seen.append(key)
        self.seen_set.add(key)
        return True

    def handle(self, data, on_chat, on_gift):
        """Verarbeitet eine Antwort der Broadcast-Info. Gibt die Zahl neuer Nachrichten zurück."""
        if not isinstance(data, dict) or data.get("errorCode", 0) != 0:
            self.status["state"] = "offline"
            self.status["error"] = (data or {}).get("errorMsg") if isinstance(data, dict) else "keine Antwort"
            return 0
        bid = str(data.get("broadcastId") or "")
        self.status.update(state="live" if data.get("state") == "onBroadcastPlay" else str(data.get("state")),
                           viewers=data.get("viewers"), likes=data.get("likes"), broadcast=bid,
                           last_ok=time.time(), error=None)
        comments = data.get("comments") or []
        comments = sorted(comments, key=lambda c: c.get("timestamp") or 0)
        first = self.primed_for != bid
        new = 0
        for c in comments:
            key = (c.get("userId"), c.get("timestamp"), c.get("comment"))
            if not self._remember(key) or first:
                continue      # beim ersten Abruf eines Streams alte Nachrichten nur merken
            name = c.get("name") or c.get("profileUrlString") or str(c.get("userId"))
            text = c.get("comment") or ""
            gift = parse_gift(text)
            if gift:
                self.status["gifts"] += 1
                on_gift(name, gift[0], gift[1])
            else:
                self.status["comments"] += 1
                on_chat(name, text)
            new += 1
        self.primed_for = bid
        return new

    async def poll_once(self, on_chat, on_gift):
        url = API.format(user=self.user)
        try:
            async with self.session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as r:
                data = await r.json(content_type=None)
        except (aiohttp.ClientError, asyncio.TimeoutError, ValueError) as exc:
            self.status["state"] = "Fehler"
            self.status["error"] = repr(exc)[:200]
            return 0
        return self.handle(data, on_chat, on_gift)
