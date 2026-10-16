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
from llm import LLMClient  # noqa: E402

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


ENV = {**load_env(ROOT / ".env.example"), **load_env(ROOT / ".env")}
HOST = ENV.get("HOST", "127.0.0.1")
PORT = int(ENV.get("PORT", "8000"))
VOTE_SECONDS = float(ENV.get("VOTE_SECONDS", "28"))
STEP_SECONDS = float(ENV.get("STEP_SECONDS", "0.25"))
IDLE_MINUTES = float(ENV.get("IDLE_MINUTES", "5"))
IDLE_VOTE_SECONDS = float(ENV.get("IDLE_VOTE_SECONDS", "10"))
LLM_ENABLED = ENV.get("LLM_ENABLED", "1") == "1"
LLM_BASE_URL = ENV.get("LLM_BASE_URL", "http://127.0.0.1:8080/v1")
LLM_MODEL = ENV.get("LLM_MODEL", "local")
LLM_API_KEY = ENV.get("LLM_API_KEY", "")
LLM_TIMEOUT = float(ENV.get("LLM_TIMEOUT", "25"))

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


async def llm_worker(app):
    game = app["game"]
    client = app["llm"]
    while True:
        req = game.next_llm_request()
        if req is None:
            await asyncio.sleep(0.2)
            continue
        try:
            data = await client.ask(req["messages"])
            game.on_llm_result(req, data)
            await broadcast(game.flush())
        except Exception as exc:  # Worker darf nie sterben
            print("Fehler im LLM-Worker:", repr(exc))
            await asyncio.sleep(1)


async def on_startup(app):
    await app["llm"].start()
    app["loop_task"] = asyncio.create_task(game_loop(app))
    app["llm_task"] = asyncio.create_task(llm_worker(app))


async def on_cleanup(app):
    app["loop_task"].cancel()
    app["llm_task"].cancel()
    await app["llm"].close()
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
    app["llm"] = LLMClient(LLM_BASE_URL, LLM_MODEL, LLM_API_KEY, LLM_TIMEOUT, LLM_ENABLED)
    app.router.add_get("/", index)
    app.router.add_get("/ws", ws_handler)
    app.router.add_static("/static/", OVERLAY)
    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)
    return app


if __name__ == "__main__":
    print(f"Höhlenspiel läuft auf http://{HOST}:{PORT}/  (Test-Chat: http://{HOST}:{PORT}/?testchat=1)")
    print(f"LLM: {'an, ' + LLM_BASE_URL if LLM_ENABLED else 'aus'}")
    web.run_app(make_app(), host=HOST, port=PORT, print=None)
