// ==UserScript==
// @name         Höhlenspiel: YouNow-Mitschnitt
// @namespace    younow-hoehlenspiel
// @version      0.2
// @description  Schneidet die Live-Nachrichten von YouNow mit (WebSocket und PubNub) und schickt sie an den Spielserver. Nur zum Herausfinden des Formats von Chat, Likes und Geschenken.
// @match        https://www.younow.com/*
// @run-at       document-start
// @sandbox      JavaScript
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      127.0.0.1
// @connect      localhost
// ==/UserScript==

(function () {
  "use strict";

  const SERVER = "http://127.0.0.1:8000/api/younow/raw";
  const MAX_TEXT = 20000;            // längere Nachrichten werden gekürzt
  // alle Anfragen an YouNow und die Dienste dahinter, die JSON zurückgeben (Geschenkliste, Chatverlauf, Likes ...)
  const URL_FILTER = /younow|propsproject|agora|easemob|pubnub|pndsn/i;
  const isJson = (type, txt) => /json/i.test(type || "") || /^\s*[\[{]/.test(txt || "");

  const w = unsafeWindow;
  let queue = [];
  let sent = 0;
  let failed = false;

  function push(kind, url, data) {
    queue.push({ t: Date.now(), kind, url: String(url || "").slice(0, 300), page: location.pathname, data });
  }

  function flush() {
    if (!queue.length) return;
    const batch = queue;
    queue = [];
    GM_xmlhttpRequest({
      method: "POST",
      url: SERVER,
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify({ items: batch }),
      timeout: 5000,
      onload: (r) => {
        if (r.status === 200) { sent += batch.length; failed = false; }
        else report("Server antwortet mit " + r.status);
        badge();
      },
      onerror: () => report("Spielserver nicht erreichbar (läuft start.bat?)"),
      ontimeout: () => report("Spielserver antwortet nicht"),
    });
  }
  setInterval(flush, 1000);

  function report(text) {
    if (!failed) console.warn("[Mitschnitt]", text);
    failed = true;
    badge(text);
  }

  // Inhalt einer WebSocket-Nachricht als Text: Text bleibt Text, Binärdaten als Base64
  function asText(data, cb) {
    if (typeof data === "string") return cb(data.slice(0, MAX_TEXT));
    const toB64 = (buf) => {
      const bytes = new Uint8Array(buf).slice(0, MAX_TEXT);
      let s = "";
      for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      cb("base64:" + btoa(s));
    };
    if (data instanceof w.ArrayBuffer || data instanceof ArrayBuffer) return toB64(data);
    if (data && typeof data.arrayBuffer === "function") return data.arrayBuffer().then(toB64);
    cb(String(data).slice(0, MAX_TEXT));
  }

  // 1. WebSocket: jede ankommende Nachricht mitschneiden
  const NativeWS = w.WebSocket;
  if (NativeWS) {
    const Hooked = function (url, protocols) {
      const ws = protocols === undefined ? new NativeWS(url) : new NativeWS(url, protocols);
      push("ws_open", url, "");
      ws.addEventListener("message", (ev) => asText(ev.data, (txt) => push("ws", url, txt)));
      ws.addEventListener("close", (ev) => push("ws_close", url, String(ev.code)));
      return ws;
    };
    Hooked.prototype = NativeWS.prototype;
    ["CONNECTING", "OPEN", "CLOSING", "CLOSED"].forEach((k) => { Hooked[k] = NativeWS[k]; });
    w.WebSocket = Hooked;
  }

  // 2. fetch und XMLHttpRequest: nur Antworten, deren Adresse nach Live-Daten aussieht (PubNub, Chat, Geschenke)
  const nativeFetch = w.fetch;
  if (nativeFetch) {
    w.fetch = function (input, init) {
      const url = typeof input === "string" ? input : (input && input.url) || "";
      const p = nativeFetch.apply(this, arguments);
      if (URL_FILTER.test(url)) {
        p.then((resp) => {
          const type = resp.headers.get("content-type");
          if (/image|video|audio|font|css|javascript/i.test(type || "")) return;
          resp.clone().text().then((txt) => { if (isJson(type, txt)) push("fetch", url, txt.slice(0, MAX_TEXT)); });
        }).catch(() => {});
      }
      return p;
    };
  }
  const XHR = w.XMLHttpRequest;
  if (XHR) {
    const open = XHR.prototype.open;
    XHR.prototype.open = function (method, url) {
      this.__mitschnittUrl = String(url || "");
      return open.apply(this, arguments);
    };
    const send = XHR.prototype.send;
    XHR.prototype.send = function () {
      const url = this.__mitschnittUrl || "";
      if (URL_FILTER.test(url)) {
        this.addEventListener("load", () => {
          try {
            const type = this.getResponseHeader("content-type");
            const txt = typeof this.response === "string" ? this.response : this.responseText;
            if (isJson(type, txt)) push("xhr", url, String(txt || "").slice(0, MAX_TEXT));
          } catch (e) { /* Antwort nicht lesbar */ }
        });
      }
      return send.apply(this, arguments);
    };
  }

  // kleines Abzeichen unten links: zeigt, dass mitgeschnitten wird
  let el = null;
  function badge(errorText) {
    if (!document.body) return;
    if (!el) {
      el = document.createElement("div");
      el.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:2147483647;padding:4px 8px;" +
        "font:12px sans-serif;color:#fff;background:rgba(80,60,20,.85);border-radius:4px;pointer-events:none";
      document.body.appendChild(el);
    }
    el.textContent = errorText ? "Mitschnitt: " + errorText : "Mitschnitt läuft: " + sent + " Nachrichten";
    el.style.background = errorText ? "rgba(140,30,30,.9)" : "rgba(80,60,20,.85)";
  }
  setInterval(() => badge(failed ? "Spielserver nicht erreichbar" : null), 3000);
})();
