"""Python-Server: liefert das Overlay aus, hält die WebSocket-Verbindungen
und lässt die Spielschleife laufen.

Start: python server/main.py   (oder start.bat)
Overlay: http://localhost:8000/            (für OBS)
Test:    http://localhost:8000/?testchat=1 (mit Eingabefeld)
Einstellungen: http://localhost:8000/einstellungen
"""

import asyncio
import json
import sys
import time
from pathlib import Path

from aiohttp import WSMsgType, web

sys.path.insert(0, str(Path(__file__).resolve().parent))
from game import Game  # noqa: E402
from llm import LLMClient  # noqa: E402
import settings  # noqa: E402
from younow import YouNowPoller  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OVERLAY = ROOT / "overlay"


VALUES = settings.current()
HOST = VALUES.get("HOST", "127.0.0.1")
PORT = int(VALUES.get("PORT", "8000"))

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
        await asyncio.sleep(game.step_seconds)


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


async def younow_loop(app):
    game = app["game"]
    poller = app["younow"]
    while True:
        try:
            if poller.enabled:
                await poller.poll_once(game.on_chat, game.on_gift, game.on_likes)
                await broadcast(game.flush())
        except Exception as exc:  # darf nie sterben
            print("Fehler bei der YouNow-Abfrage:", repr(exc))
        await asyncio.sleep(poller.interval if poller.enabled else 2)


async def younow_status(request):
    local_only(request)
    st = dict(request.app["younow"].status)
    st["ago"] = round(time.time() - st["last_ok"]) if st.get("last_ok") else None
    st["user"] = request.app["younow"].user
    return web.json_response(st)


def count_npc_sprites():
    """Eigene Bewohner-Sprites: assets/characters/bewohner1.png, bewohner2.png ... ohne Lücke."""
    n = 0
    while (ROOT / "assets" / "characters" / f"bewohner{n + 1}.png").exists():
        n += 1
    return n


def apply_all(app, values):
    settings.apply(values, app["game"], app["llm"])
    app["game"].npc_sprite_count = count_npc_sprites()
    app["younow"].configure(values.get("YOUNOW_ENABLED", "0") == "1", values.get("YOUNOW_USER", ""),
                            settings.num(values, "YOUNOW_POLL_SECONDS", 3))


async def on_startup(app):
    await app["llm"].start()
    await app["younow"].start()
    app["younow_task"] = asyncio.create_task(younow_loop(app))
    app["loop_task"] = asyncio.create_task(game_loop(app))
    app["llm_task"] = asyncio.create_task(llm_worker(app))


async def on_cleanup(app):
    app["loop_task"].cancel()
    app["llm_task"].cancel()
    app["younow_task"].cancel()
    await app["llm"].close()
    await app["younow"].close()
    for ws in list(clients):
        await ws.close()


# ---------- Einstellungsseite ----------

def local_only(request):
    """Einstellungen nur vom eigenen PC aus, auch wenn HOST=0.0.0.0 gesetzt ist."""
    if request.remote not in ("127.0.0.1", "::1", "localhost"):
        raise web.HTTPForbidden(text="Einstellungen nur auf diesem PC.")


async def settings_page(request):
    local_only(request)
    return web.FileResponse(OVERLAY / "einstellungen.html")


async def settings_get(request):
    local_only(request)
    return web.json_response({"groups": settings.describe(settings.current())})


async def settings_post(request):
    local_only(request)
    data = await request.json()
    before = settings.current()
    values, errors = settings.save(data.get("values", {}))
    if errors:
        return web.json_response({"ok": False, "errors": errors}, status=400)
    game = request.app["game"]
    old_step = game.step_seconds
    apply_all(request.app, values)
    restart = [k for k, f in settings.FIELD.items() if not f[5] and values.get(k) != before.get(k)]
    game.emit({"type": "audio", **game.audio})
    game.emit({"type": "chat_overlay", "show": game.chat_overlay})
    if game.step_seconds != old_step:
        game.emit({"type": "step", "step": game.step_seconds})
    await broadcast(game.flush())
    return web.json_response({"ok": True, "restart": restart, "groups": settings.describe(values)})


async def settings_action(request):
    local_only(request)
    data = await request.json()
    game = request.app["game"]
    action = data.get("action")
    if action == "new_level":
        game.new_level()
    elif action == "new_hero":
        game.new_hero()
    elif action == "sound_test":
        game.emit({"type": "sound_test"})
        await broadcast(game.flush())
        return web.json_response({"ok": True, "text": f"Testton an {len(clients)} offene(s) Overlay(s) geschickt." if clients else "Kein Overlay offen. Erst http://localhost:8000/ im Browser oder in OBS öffnen."})
    elif action == "llm_test":
        t0 = time.monotonic()
        request.app["llm"].fail_until = 0.0   # Test immer wirklich senden
        answer = await request.app["llm"].ask([
            {"role": "system", "content": "Antworte ausschließlich mit einem JSON-Objekt."},
            {"role": "user", "content": 'Sag kurz Hallo auf Deutsch. Antworte als JSON: {"satz": "..."}'},
        ], max_tokens=60)
        secs = round(time.monotonic() - t0, 1)
        if answer is None:
            return web.json_response({"ok": False, "text": f"Keine brauchbare Antwort nach {secs} s. "
                                      "Läuft llama-server, stimmt die Adresse?"})
        return web.json_response({"ok": True, "text": f"Antwort nach {secs} s: {answer.get('satz', answer)}"})
    else:
        return web.json_response({"ok": False, "text": "unbekannte Aktion"}, status=400)
    await broadcast(game.flush())
    return web.json_response({"ok": True})


@web.middleware
async def no_cache(request, handler):
    """Overlay-Dateien nie aus dem Browser-Zwischenspeicher nehmen, sonst läuft nach
    einem Update im Browser oder in OBS noch der alte Stand."""
    resp = await handler(request)
    if request.path == "/" or request.path.startswith("/static/") or request.path == "/einstellungen":
        resp.headers["Cache-Control"] = "no-cache, must-revalidate"
    return resp


# ---------- YouNow-Mitschnitt (Userscript schickt Rohdaten) ----------

RAW_LOG = ROOT / "logs" / "younow_raw.jsonl"
RAW_MAX = 30 * 1024 * 1024
raw_stats = {"count": 0, "last": 0.0}


async def younow_raw(request):
    local_only(request)
    data = await request.json()
    items = data.get("items") or []
    RAW_LOG.parent.mkdir(exist_ok=True)
    if RAW_LOG.exists() and RAW_LOG.stat().st_size > RAW_MAX:
        RAW_LOG.replace(RAW_LOG.with_suffix(".old.jsonl"))   # alte Datei behalten, neu anfangen
    with RAW_LOG.open("a", encoding="utf-8") as fh:
        for it in items:
            fh.write(json.dumps(it, ensure_ascii=False) + "\n")
    raw_stats["count"] += len(items)
    raw_stats["last"] = time.time()
    return web.json_response({"ok": True})


async def younow_raw_info(request):
    local_only(request)
    size = RAW_LOG.stat().st_size if RAW_LOG.exists() else 0
    ago = round(time.time() - raw_stats["last"]) if raw_stats["last"] else None
    return web.json_response({"count": raw_stats["count"], "size": size, "ago": ago})


async def younow_raw_download(request):
    local_only(request)
    if not RAW_LOG.exists():
        raise web.HTTPNotFound(text="Noch kein Mitschnitt.")
    return web.FileResponse(RAW_LOG, headers={"Content-Disposition": "attachment; filename=younow_raw.jsonl"})


def make_app():
    app = web.Application(middlewares=[no_cache])
    app["game"] = Game()
    app["llm"] = LLMClient("http://127.0.0.1:8080/v1", "local")
    app["younow"] = YouNowPoller()
    apply_all(app, VALUES)
    # erste Karte neu, damit Kartengröße und Sichtweite aus den Einstellungen gelten
    app["game"].depth = 0
    app["game"].outbox.clear()
    app["game"].new_level()
    app.router.add_get("/", index)
    app.router.add_get("/einstellungen", settings_page)
    app.router.add_get("/api/settings", settings_get)
    app.router.add_post("/api/settings", settings_post)
    app.router.add_post("/api/action", settings_action)
    app.router.add_post("/api/younow/raw", younow_raw)
    app.router.add_get("/api/younow/raw", younow_raw_info)
    app.router.add_get("/api/younow/status", younow_status)
    app.router.add_get("/api/younow/raw.jsonl", younow_raw_download)
    app.router.add_get("/ws", ws_handler)
    app.router.add_static("/static/", OVERLAY)
    app.router.add_static("/assets/", ROOT / "assets")
    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)
    return app


if __name__ == "__main__":
    print(f"Höhlenspiel läuft auf http://{HOST}:{PORT}/  (Test-Chat: http://{HOST}:{PORT}/?testchat=1)")
    print(f"Einstellungen: http://127.0.0.1:{PORT}/einstellungen")
    print(f"LLM: {'an, ' + VALUES.get('LLM_BASE_URL', '') if VALUES.get('LLM_ENABLED', '1') == '1' else 'aus'}")
    web.run_app(make_app(), host=HOST, port=PORT, print=None)
