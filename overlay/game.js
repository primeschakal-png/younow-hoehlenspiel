// Höhlenspiel Overlay (Etappe 1, Platzhaltergrafik)
// Stellt nur dar, was der Server schickt. Die Logik liegt komplett in Python.

const TILE = 32;
const params = new URLSearchParams(location.search);
const TESTCHAT = params.has("testchat");

const LABELS = { links: "Links", geradeaus: "Geradeaus", rechts: "Rechts", zurueck: "Zurück" };
const COMMAND = { links: "!links", geradeaus: "!geradeaus", rechts: "!rechts", zurueck: "!zurueck" };
const FACING_ANGLE = { N: 0, E: 90, S: 180, W: 270 };

let ws = null;
let scene = null;
let pending = [];
let voteEndsAt = 0;
let voteTimer = null;
let voteHideTimer = null;
let logTimer = null;
let diceTimer = null;
let heroName = "";
let currentHints = {};

// ---------------- Phaser ----------------

function rand(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

function makeTextures(sc) {
  const g = sc.make.graphics({ x: 0, y: 0, add: false });

  for (let v = 0; v < 2; v++) {
    g.clear();
    g.fillStyle(v ? 0x3a3226 : 0x352e23);
    g.fillRect(0, 0, TILE, TILE);
    g.fillStyle(0x2a241b);
    for (let i = 0; i < 6; i++) g.fillRect(rand(1, TILE - 4), rand(1, TILE - 4), 2, 2);
    g.generateTexture("floor" + v, TILE, TILE);
  }

  // Wand-Autotiling: Bit gesetzt, wenn der Nachbar Boden ist (N=1, E=2, S=4, W=8)
  for (let m = 0; m < 16; m++) {
    g.clear();
    g.fillStyle(m ? 0x2b2632 : 0x15131a);
    g.fillRect(0, 0, TILE, TILE);
    g.fillStyle(0x4d4457);
    if (m & 1) g.fillRect(0, 0, TILE, 7);
    if (m & 2) g.fillRect(TILE - 7, 0, 7, TILE);
    if (m & 4) g.fillRect(0, TILE - 5, TILE, 5);
    if (m & 8) g.fillRect(0, 0, 7, TILE);
    g.fillStyle(0x1f1b25);
    for (let i = 0; i < 3; i++) g.fillRect(rand(8, TILE - 10), rand(8, TILE - 10), 3, 3);
    g.generateTexture("wall" + m, TILE, TILE);
  }

  g.clear();
  g.fillStyle(0x6b5b3e);
  g.fillRect(0, 0, TILE, TILE);
  g.fillStyle(0x2a2418);
  for (let i = 0; i < 4; i++) g.fillRect(4 + i * 3, 4 + i * 7, TILE - 8 - i * 6, 4);
  g.generateTexture("stairs", TILE, TILE);

  g.clear();
  g.fillStyle(0x000000, 0.35);
  g.fillEllipse(TILE / 2, TILE / 2 + 9, 20, 8);
  g.fillStyle(0xe8c170);
  g.fillCircle(TILE / 2, TILE / 2, 10);
  g.lineStyle(2, 0x7a3b1d);
  g.strokeCircle(TILE / 2, TILE / 2, 10);
  g.generateTexture("hero", TILE, TILE);

  g.clear();
  g.fillStyle(0x7a3b1d);
  g.fillTriangle(TILE / 2, 2, TILE / 2 - 5, 9, TILE / 2 + 5, 9);
  g.generateTexture("pointer", TILE, TILE);

  // Truhe
  g.clear();
  g.fillStyle(0x7a4e22); g.fillRect(7, 11, 18, 13);
  g.fillStyle(0x9a6a33); g.fillRect(7, 9, 18, 6);
  g.fillStyle(0xe0b84a); g.fillRect(15, 14, 3, 4);
  g.generateTexture("ent_chest", TILE, TILE);

  // Quelle
  g.clear();
  g.fillStyle(0x1d4a6e); g.fillEllipse(16, 18, 22, 12);
  g.fillStyle(0x4fa3d9); g.fillEllipse(16, 17, 16, 8);
  g.fillStyle(0xbfe6ff); g.fillRect(14, 15, 3, 2);
  g.generateTexture("ent_spring", TILE, TILE);

  // Monster
  g.clear();
  g.fillStyle(0x000000, 0.35); g.fillEllipse(16, 26, 20, 6);
  g.fillStyle(0x8f2b2b); g.fillCircle(16, 17, 9);
  g.fillStyle(0xffe14d); g.fillRect(11, 14, 3, 3); g.fillRect(18, 14, 3, 3);
  g.generateTexture("ent_monster", TILE, TILE);

  // Schrein
  g.clear();
  g.fillStyle(0x5a5470); g.fillRect(11, 12, 10, 14);
  g.fillStyle(0xb08cff); g.fillCircle(16, 9, 5);
  g.generateTexture("ent_shrine", TILE, TILE);

  // Pilze
  g.clear();
  g.fillStyle(0xd8d0b8); g.fillRect(10, 18, 3, 6); g.fillRect(19, 16, 3, 8);
  g.fillStyle(0x7fa34a); g.fillEllipse(11, 17, 10, 6); g.fillEllipse(20, 15, 12, 7);
  g.generateTexture("ent_mushroom", TILE, TILE);

  // Lagerfeuer
  g.clear();
  g.fillStyle(0x5a3a1e); g.fillRect(8, 22, 16, 4);
  g.fillStyle(0xff7a1a); g.fillTriangle(16, 8, 9, 23, 23, 23);
  g.fillStyle(0xffd34d); g.fillTriangle(16, 14, 12, 23, 20, 23);
  g.generateTexture("campfire", TILE, TILE);

  g.destroy();
}

class CaveScene extends Phaser.Scene {
  constructor() {
    super("cave");
    this.layer = null;
    this.tileImgs = [];
    this.figure = null;
    this.pointer = null;
    this.stairsImg = null;
    this.stairsPos = null;
    this.step = 0.25;
    this.entities = new Map();   // id -> { img, x, y }
    this.campfire = null;
    this.actText = null;
  }

  create() {
    makeTextures(this);
    this.actText = this.add.text(0, 0, "", {
      fontFamily: "Trebuchet MS, Verdana, sans-serif",
      fontSize: "15px",
      color: "#f3e7c8",
      backgroundColor: "rgba(15,12,20,0.75)",
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5, 1).setDepth(20).setVisible(false);
    this.campfire = this.add.image(0, 0, "campfire").setDepth(9).setVisible(false);
    scene = this;
    const queued = pending;
    pending = [];
    queued.forEach(handle);
  }

  buildLevel(s) {
    if (this.layer) this.layer.destroy(true);
    if (this.stairsImg) this.stairsImg.destroy();
    this.layer = this.add.container(0, 0).setDepth(0);
    this.tileImgs = [];
    const rows = s.tiles;
    const isFloor = (x, y) => x >= 0 && y >= 0 && x < s.tw && y < s.th && rows[y][x] === ".";

    for (let y = 0; y < s.th; y++) {
      const row = [];
      for (let x = 0; x < s.tw; x++) {
        let key;
        if (isFloor(x, y)) {
          key = "floor" + ((x * 7 + y * 13) % 2);
        } else {
          let m = 0;
          if (isFloor(x, y - 1)) m |= 1;
          if (isFloor(x + 1, y)) m |= 2;
          if (isFloor(x, y + 1)) m |= 4;
          if (isFloor(x - 1, y)) m |= 8;
          key = "wall" + m;
        }
        const img = this.add.image(x * TILE, y * TILE, key).setOrigin(0).setVisible(false);
        this.layer.add(img);
        row.push(img);
      }
      this.tileImgs.push(row);
    }

    this.stairsPos = s.stairs;
    this.stairsImg = this.add.image(s.stairs[0] * TILE, s.stairs[1] * TILE, "stairs")
      .setOrigin(0).setDepth(1).setVisible(false);

    for (const e of this.entities.values()) e.img.destroy();
    this.entities.clear();
    for (const e of s.entities || []) this.addEntity(e);

    if (!this.figure) {
      this.figure = this.add.image(0, 0, "hero").setDepth(10);
      this.pointer = this.add.image(0, 0, "pointer").setDepth(11);
    }

    this.step = s.step || 0.25;
    this.reveal(s.revealed, true);
    this.cameras.main.setBounds(0, 0, s.tw * TILE, s.th * TILE);
    this.moveFigure(s.pos, s.facing, true);
    this.cameras.main.startFollow(this.figure, true, 0.12, 0.12);
  }

  addEntity(e) {
    const img = this.add.image(e.x * TILE, e.y * TILE, "ent_" + e.kind).setOrigin(0).setDepth(2);
    const tile = this.tileImgs[e.y] && this.tileImgs[e.y][e.x];
    img.setVisible(!!(tile && tile.visible));
    this.entities.set(e.id, { img, x: e.x, y: e.y });
  }

  removeEntity(id) {
    const e = this.entities.get(id);
    if (!e) return;
    this.tweens.add({ targets: e.img, alpha: 0, duration: 400, onComplete: () => e.img.destroy() });
    this.entities.delete(id);
  }

  reveal(list, instant) {
    const shown = new Set();
    for (const [x, y] of list) {
      const img = this.tileImgs[y] && this.tileImgs[y][x];
      if (!img || img.visible) continue;
      img.setVisible(true);
      shown.add(x + "," + y);
      if (!instant) {
        img.setAlpha(0);
        this.tweens.add({ targets: img, alpha: 1, duration: 350 });
      }
      if (this.stairsPos && x === this.stairsPos[0] && y === this.stairsPos[1]) {
        this.stairsImg.setVisible(true);
      }
    }
    for (const e of this.entities.values()) {
      if (shown.has(e.x + "," + e.y)) e.img.setVisible(true);
    }
  }

  setCamp(info) {
    if (info && info.active) {
      const [x, y] = info.pos;
      this.campfire.setPosition(x * TILE + TILE / 2 + 22, y * TILE + TILE / 2 + 4).setVisible(true);
      this.actText.setText(heroName + " " + info.text).setVisible(true);
    } else {
      this.campfire.setVisible(false);
      this.actText.setVisible(false);
    }
  }

  update() {
    if (this.figure && this.actText.visible) {
      this.actText.setPosition(this.figure.x, this.figure.y - 20);
    }
  }

  moveFigure(pos, facing, instant) {
    const px = pos[0] * TILE + TILE / 2;
    const py = pos[1] * TILE + TILE / 2;
    this.pointer.setAngle(FACING_ANGLE[facing] || 0);
    if (instant) {
      this.figure.setPosition(px, py);
      this.pointer.setPosition(px, py);
      return;
    }
    const duration = this.step * 1000 * 0.95;
    this.tweens.add({ targets: [this.figure, this.pointer], x: px, y: py, duration, ease: "Linear" });
  }
}

// ---------------- HUD ----------------

function el(id) { return document.getElementById(id); }

function setStatus(text) { el("status").textContent = text; }

function showLog(text) {
  const box = el("log");
  box.textContent = text;
  box.classList.add("show");
  clearTimeout(logTimer);
  logTimer = setTimeout(() => box.classList.remove("show"), 4000);
}

function addChat(user, text) {
  const lines = el("chat-lines");
  const div = document.createElement("div");
  div.className = "chat-line";
  const b = document.createElement("b");
  b.textContent = user + ": ";
  div.appendChild(b);
  div.appendChild(document.createTextNode(text));
  lines.appendChild(div);
  while (lines.children.length > 8) lines.removeChild(lines.firstChild);
}

function renderVote(options, counts, winner) {
  const bars = el("vote-bars");
  bars.innerHTML = "";
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  for (const opt of options) {
    const c = counts[opt] || 0;
    const row = document.createElement("div");
    row.className = "vote-row" + (opt === winner ? " win" : "");
    row.innerHTML =
      '<div class="vote-label">' + LABELS[opt] + " <small>" + COMMAND[opt] + "</small></div>" +
      '<div class="vote-bar"><div class="vote-fill"></div></div>' +
      '<div class="vote-count">' + c + "</div>";
    bars.appendChild(row);
    if (currentHints[opt]) {
      const hint = document.createElement("div");
      hint.className = "vote-hint";
      hint.textContent = currentHints[opt];
      bars.appendChild(hint);
    }
    const fill = row.querySelector(".vote-fill");
    requestAnimationFrame(() => { fill.style.width = (total ? (c / total) * 100 : 0) + "%"; });
  }
}

let currentOptions = [];

function startVote(options, seconds, counts, hints) {
  currentOptions = options;
  currentHints = hints || {};
  clearTimeout(voteHideTimer);
  el("vote-title").textContent = "Wohin soll ich gehen?";
  renderVote(options, counts || {}, null);
  el("vote").classList.remove("hidden");
  voteEndsAt = Date.now() + seconds * 1000;
  clearInterval(voteTimer);
  const tickTimer = () => {
    const left = Math.max(0, Math.ceil((voteEndsAt - Date.now()) / 1000));
    el("vote-timer").textContent = "Noch " + left + " Sekunden";
  };
  tickTimer();
  voteTimer = setInterval(tickTimer, 250);
}

function endVote(choice, reason, counts) {
  clearInterval(voteTimer);
  renderVote(currentOptions, counts, choice);
  el("vote-title").textContent = LABELS[choice] + "!";
  el("vote-timer").textContent = reason;
  clearTimeout(voteHideTimer);
  voteHideTimer = setTimeout(() => el("vote").classList.add("hidden"), 3500);
}

function bar(label, value, max, cls) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return '<div class="stat"><span class="stat-label">' + label + '</span>' +
    '<span class="stat-bar"><span class="stat-fill ' + cls + '" style="width:' + pct + '%"></span></span>' +
    '<span class="stat-val">' + Math.round(value) + "</span></div>";
}

function renderStats(h) {
  heroName = h.name;
  el("hero-name").textContent = h.name;
  el("hero-bars").innerHTML =
    bar("Leben", h.hp, h.max_hp, "hp") +
    bar("Satt", h.hunger, 100, "food") +
    bar("Durst", h.thirst, 100, "water");
  el("hero-inv").textContent =
    "Proviant " + h.food + "   Wasser " + h.water + "   Tränke " + h.potions + "   Gold " + h.gold;
}

function showDice(m) {
  const box = el("dice");
  const sign = m.bonus >= 0 ? " + " : " - ";
  box.innerHTML =
    '<div class="dice-label"></div>' +
    '<div class="dice-roll">W20: ' + m.roll + sign + Math.abs(m.bonus) + " = " + (m.roll + m.bonus) + "</div>" +
    '<div class="dice-target">nötig: ' + m.target + "</div>" +
    '<div class="dice-result ' + (m.success ? "ok" : "fail") + '">' + (m.success ? "Geschafft!" : "Misslungen!") + "</div>";
  box.querySelector(".dice-label").textContent = m.label;
  box.classList.remove("hidden");
  clearTimeout(diceTimer);
  diceTimer = setTimeout(() => box.classList.add("hidden"), 3000);
}

function renderHall(hall) {
  const list = el("hall-list");
  list.innerHTML = "";
  for (const h of (hall || []).slice().reverse()) {
    const li = document.createElement("li");
    li.textContent = h.name + (h.archetype ? " (" + h.archetype + ")" : "") + ", Ebene " + h.depth + ", " + h.cause +
      (h.gold ? ", " + h.gold + " Gold" : "");
    list.appendChild(li);
  }
}

function showDeath(m) {
  el("death-title").textContent = m.name + " ist tot";
  el("death-cause").textContent = m.cause[0].toUpperCase() + m.cause.slice(1) + " auf Ebene " + m.depth + ".";
  renderHall(m.hall);
  el("death").classList.remove("hidden");
  el("vote").classList.add("hidden");
  scene.setCamp(null);
}

let lastArchetype = null;

function trustWord(v) {
  if (v > 0.5) return "hoch";
  if (v > 0.15) return "gut";
  if (v < -0.5) return "kaum";
  if (v < -0.15) return "gering";
  return "neutral";
}

function renderCharacter(c) {
  if (!c) return;
  const dot = el("char-dot");
  dot.style.left = (50 + c.audience * 45) + "%";
  dot.style.top = (50 - c.courage * 45) + "%";
  const map = { held: "q-held", entertainer: "q-ent", feigling: "q-feig", schmeichler: "q-schm" };
  document.querySelectorAll("#char-grid .q").forEach((q) => q.classList.remove("active"));
  if (map[c.archetype]) document.querySelector("#char-grid ." + map[c.archetype]).classList.add("active");
  el("char-label").textContent = c.label;
  el("char-trust").textContent = "Vertrauen in den Chat: " + trustWord(c.trust_chat) +
    ", in sich: " + trustWord(c.self_trust);
  el("hero-persona").textContent = c.persona + ", " + c.traits.join(" und ");
  if (lastArchetype !== null && lastArchetype !== c.archetype) {
    const box = el("char");
    box.classList.remove("flash");
    void box.offsetWidth;
    box.classList.add("flash");
  }
  lastArchetype = c.archetype;
}

// ---------------- Nachrichten ----------------

function handle(msg) {
  if (!scene && msg.type !== "chat" && msg.type !== "log") {
    pending.push(msg);
    return;
  }
  switch (msg.type) {
    case "state":
      el("depth").textContent = "Ebene " + msg.depth;
      renderStats(msg.hero);
      lastArchetype = null;
      renderCharacter(msg.character);
      scene.buildLevel(msg);
      scene.setCamp(msg.camp);
      if (msg.vote) startVote(msg.vote.options, msg.vote.remaining, msg.vote.counts, msg.vote.hints);
      else el("vote").classList.add("hidden");
      if (msg.dead) showDeath({ name: msg.hero.name, cause: "gefallen", depth: msg.depth, hall: msg.hall });
      else el("death").classList.add("hidden");
      break;
    case "stats":
      renderStats(msg.hero);
      break;
    case "character":
      renderCharacter(msg);
      break;
    case "entity_remove":
      scene.removeEntity(msg.id);
      break;
    case "dice":
      showDice(msg);
      break;
    case "camp":
      scene.setCamp(msg);
      break;
    case "death":
      showDeath(msg);
      break;
    case "reveal":
      scene.reveal(msg.tiles, false);
      break;
    case "pos":
      scene.moveFigure(msg.pos, msg.facing, false);
      break;
    case "vote_start":
      startVote(msg.options, msg.seconds, {}, msg.hints);
      break;
    case "vote_update":
      renderVote(currentOptions, msg.counts, null);
      break;
    case "vote_end":
      endVote(msg.choice, msg.reason, msg.counts);
      break;
    case "log":
      showLog(msg.text);
      break;
    case "chat":
      addChat(msg.user, msg.text);
      break;
  }
}

function connect() {
  const proto = location.protocol === "https:" ? "wss://" : "ws://";
  ws = new WebSocket(proto + location.host + "/ws");
  ws.onopen = () => setStatus("");
  ws.onmessage = (e) => {
    try { handle(JSON.parse(e.data)); } catch (err) { console.error(err); }
  };
  ws.onclose = () => {
    setStatus("Verbindung getrennt, neuer Versuch läuft");
    setTimeout(connect, 2000);
  };
}

// ---------------- Test-Chat ----------------

if (TESTCHAT) {
  const form = el("testchat");
  form.classList.remove("hidden");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = el("tc-text").value.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "chat", user: el("tc-user").value.trim() || "Tester", text }));
    el("tc-text").value = "";
  });
}

// ---------------- Start ----------------

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 1280,
  height: 720,
  backgroundColor: "#0b0b10",
  pixelArt: true,
  scene: CaveScene,
});

connect();
