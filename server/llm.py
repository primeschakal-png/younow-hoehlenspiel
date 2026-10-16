"""LLM-Anbindung über eine OpenAI-kompatible Schnittstelle (llama-server, später API).

Das Spiel legt Anfragen in eine Warteschlange, ein einzelner Worker arbeitet sie
nacheinander ab (llama-server läuft mit einem Slot). Fällt das LLM aus, liefert
der Worker None und das Spiel nutzt seine eigenen Regeln.
"""

import asyncio
import json
import re
import time

import aiohttp

THINK_RE = re.compile(r"<think>.*?</think>", re.S)


def parse_json(text):
    text = THINK_RE.sub("", text or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text[text.find("{"):] if "{" in text else text
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        data = json.loads(text[start:end + 1])
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


class LLMClient:
    def __init__(self, base_url, model, api_key="", timeout=25.0, enabled=True):
        self.url = base_url.rstrip("/") + "/chat/completions"
        self.model = model
        self.api_key = api_key
        self.timeout = timeout
        self.enabled = enabled
        self.session = None
        self.fail_until = 0.0
        self.warned = False

    async def start(self):
        self.session = aiohttp.ClientSession()

    async def close(self):
        if self.session:
            await self.session.close()

    async def ask(self, messages, max_tokens=180, temperature=0.8):
        """Gibt ein Dict zurück oder None bei Fehler."""
        if not self.enabled or time.monotonic() < self.fail_until:
            return None
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = "Bearer " + self.api_key
        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "response_format": {"type": "json_object"},
            # Qwen3: Denkmodus aus, sonst dauert jede Antwort sehr lange
            "chat_template_kwargs": {"enable_thinking": False},
        }
        try:
            async with self.session.post(self.url, json=payload, headers=headers,
                                         timeout=aiohttp.ClientTimeout(total=self.timeout)) as r:
                if r.status != 200:
                    raise RuntimeError(f"HTTP {r.status}: {(await r.text())[:200]}")
                data = await r.json()
            content = data["choices"][0]["message"].get("content") or ""
            result = parse_json(content)
            if result is None:
                print("LLM: Antwort war kein JSON:", content[:200])
            self.warned = False
            return result
        except (aiohttp.ClientError, asyncio.TimeoutError, RuntimeError, KeyError, ValueError) as exc:
            if not self.warned:
                print("LLM nicht erreichbar, die Figur entscheidet vorerst selbst:", repr(exc))
                self.warned = True
            self.fail_until = time.monotonic() + 30  # nicht im Sekundentakt neu versuchen
            return None
