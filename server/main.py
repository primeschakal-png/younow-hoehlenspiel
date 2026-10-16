"""Python-Server: liefert das Overlay aus, hält die WebSocket-Verbindungen
und lässt die Spielschleife laufen.

Start: python server/main.py   (oder start.bat)
Overlay: http://localhost:8000/            (für OBS)
Test:    http://localhost:8000/?testchat=1 (mit Eingabefeld)
"""

import asyncio
import json
import sys
from pathlib import Path

from aiohttp import WSMsgType, web

sys.path.insert(0, str(Path(__file__).resolve().parent))
from game import Game  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OVERLAY = ROOT / "overlay"


def load_env(path):
    env = {}
    if not path.exists():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip()
    return env


ENV = load_env(ROOT / ".env") or load_env(ROOT / ".env.example")
HOST = ENV.get("HOST", "127.0.0.1")
PORT = int(ENV.get("PORT", "8000"))
VOTE_SECONDS = float(ENV.get("VOTE_SECONDS", "28"))
STEP_SECONDS = float(ENV.get("STEP_SECONDS", "0.25"))
IDLE_MINUTES = float(ENV.get("IDLE_MINUTES", "5"))
IDLE_VOTE_SECONDS = float(ENV.get("IDLE_VOTE_SECONDS", "10"))

clients = set()


async def broadcast(msgs):
    if not msgs:
        return
    dead = []
    for ws in list(clients):
        try:
            for m in msgs:
                await ws.send_str(json.dumps(m))
        except Exception:
            dead.append(ws)
    for ws in dead:
        clients.discard(ws)


async def index(request):
    return web.FileResponse(OVERLAY / "index.html")


async def ws_handler(request):
    game = request.app["game"]
    ws = web.WebSocketResponse(heartbeat=20)
    await ws.prepare(request)
    clients.add(ws)
    await ws.send_str(json.dumps(game.full_state()))
    try:
        async for msg in ws:
            if msg.type != WSMsgType.TEXT:
                continue
            try:
                data = json.loads(msg.data)
            except ValueError:
                continue
            if data.get("type") == "chat":
                game.on_chat(str(data.get("user", "")), str(data.get("text", "")))
                await broadcast(game.flush())
    finally:
        clients.discard(ws)
    return ws


async def game_loop(app):
    game = app["game"]
    while True:
        try:
            game.tick()
            await broadcast(game.flush())
        except Exception as exc:  # Spielschleife darf nie sterben
            print("Fehler in der Spielschleife:", repr(exc))
        await asyncio.sleep(STEP_SECONDS)


async def on_startup(app):
    app["loop_task"] = asyncio.create_task(game_loop(app))


async def on_cleanup(app):
    app["loop_task"].cancel()
    for ws in list(clients):
        await ws.close()


def make_app():
    app = web.Application()
    app["game"] = Game(
        vote_seconds=VOTE_SECONDS,
        step_seconds=STEP_SECONDS,
        idle_minutes=IDLE_MINUTES,
        idle_vote_seconds=IDLE_VOTE_SECONDS,
    )
    app.router.add_get("/", index)
    app.router.add_get("/ws", ws_handler)
    app.router.add_static("/static/", OVERLAY)
    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)
    return app


if __name__ == "__main__":
    print(f"Höhlenspiel läuft auf http://{HOST}:{PORT}/  (Test-Chat: http://{HOST}:{PORT}/?testchat=1)")
    web.run_app(make_app(), host=HOST, port=PORT, print=None)
