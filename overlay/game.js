// Höhlenspiel Overlay (Etappe 1, Platzhaltergrafik)
// Stellt nur dar, was der Server schickt. Die Logik liegt komplett in Python.

const TILE = 32;
const ZOOM = Number(new URLSearchParams(location.search).get("zoom")) || 2;   // Pixelgrafik doppelt groß
const params = new URLSearchParams(location.search);
const TESTCHAT = params.has("testchat");

const LABELS = { links: "Links", geradeaus: "Geradeaus", rechts: "Rechts", zurueck: "Zurück" };
const COMMAND = { links: "!links", geradeaus: "!geradeaus", rechts: "!rechts", zurueck: "!zurueck" };
const FACING_ANGLE = { N: 0, E: 90, S: 180, W: 270 };

// Mage City Arcanos (Hyptosis, CC0): 8 Kacheln pro Zeile, Bildnummer = Zeile * 8 + Spalte
const F = (row, col) => row * 8 + col;
const THEMES = [
  {   // ungerade Ebenen: Sandstein und Kopfsteinpflaster mit Rand
    floor: (n, e, s, w) => F(n && !s ? 9 : s && !n ? 11 : 10, w && !e ? 0 : e && !w ? 2 : 1),
    faces: [F(5, 1), F(5, 2), F(5, 1), F(5, 2), F(5, 4), F(5, 6)],
    top: 0x2a2119, rim: 0x8c7452,
  },
  {   // gerade Ebenen: graue Ziegel und heller Plattenweg
    floor: () => F(0, 1),
    floorAlt: F(1, 1),
    faces: [F(37, 0), F(37, 1), F(37, 0), F(37, 1), F(36, 0)],
    top: 0x1c1b20, rim: 0x6b6875,
  },
];
// Gegenstände: Bildnummer, bei zwei Kacheln Höhe die obere zuerst
const ENTITY_FRAMES = {
  spring: [F(13, 1)],          // Wasserbecken
  shrine: [F(12, 2), F(13, 2)], // Statue auf Sockel
  chest: [F(9, 7)],            // Vorratssack
  mushroom: [F(32, 6)],        // Kürbis
};
const DECOR = [F(0, 2), F(0, 3), F(1, 2), F(1, 3), F(1, 4), F(41, 5), F(0, 4)];

// LPC-Spritesheet: 64x64 je Bild, 13 Bilder pro Zeile, Richtungen je Animation in der Reihenfolge N, W, S, O
const DIR_ROW = { N: 0, W: 1, S: 2, E: 3 };

function makeHeroAnims(sc) {
  const mk = (key, base, from, to, rate, repeat) => {
    for (const [d, r] of Object.entries(DIR_ROW)) {
      const frames = [];
      for (let c = from; c <= to; c++) frames.push({ key: "herosheet", frame: (base + r) * 13 + c });
      sc.anims.create({ key: key + "_" + d, frames, frameRate: rate, repeat });
    }
  };
  mk("walk", 8, 1, 8, 12, -1);
  mk("idle", 22, 0, 1, 2, -1);
  mk("slash", 12, 0, 5, 14, 0);
  mk("cast", 0, 0, 6, 12, 0);
  mk("emote", 34, 0, 2, 5, 0);
  mk("sit", 30, 0, 0, 1, 0);
  const hurt = [];
  for (let c = 0; c < 6; c++) hurt.push({ key: "herosheet", frame: 20 * 13 + c });
  sc.anims.create({ key: "hurt", frames: hurt, frameRate: 8, repeat: 0 });
}

function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

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

  // Mauerkronen: Rand an den Seiten, an die Boden grenzt (N=1, E=2, W=8), je Thema
  THEMES.forEach((t, ti) => {
    for (let m = 0; m < 16; m++) {
      g.clear();
      g.fillStyle(t.top);
      g.fillRect(0, 0, TILE, TILE);
      g.fillStyle(t.rim);
      if (m & 1) g.fillRect(0, 0, TILE, 4);
      if (m & 2) g.fillRect(TILE - 4, 0, 4, TILE);
      if (m & 8) g.fillRect(0, 0, 4, TILE);
      g.generateTexture("top" + ti + "_" + m, TILE, TILE);
    }
  });

  // Platzhalter-Wände (falls die Kacheldatei fehlt)
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
    this.sayText = null;
    this.sayTimer = null;
  }

  preload() {
    this.load.spritesheet("city", "assets/tiles/magecity.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("herosheet", "assets/characters/hero.png", { frameWidth: 64, frameHeight: 64 });
  }

  create() {
    makeTextures(this);
    this.useSheet = this.textures.exists("herosheet");
    if (this.useSheet) makeHeroAnims(this);
    this.facing = "S";
    this.camping = false;
    this.dead = false;
    this.idleTimer = null;
    this.actText = this.add.text(0, 0, "", {
      fontFamily: "Trebuchet MS, Verdana, sans-serif",
      fontSize: "15px",
      color: "#f3e7c8",
      backgroundColor: "rgba(15,12,20,0.75)",
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5, 1).setDepth(20).setVisible(false).setResolution(ZOOM).setScale(1 / ZOOM);
    this.campfire = this.add.image(0, 0, "campfire").setDepth(9).setVisible(false);
    this.sayText = this.add.text(0, 0, "", {
      fontFamily: "Trebuchet MS, Verdana, sans-serif",
      fontSize: "17px",
      color: "#1a1620",
      backgroundColor: "#f3e7c8",
      padding: { x: 9, y: 6 },
      wordWrap: { width: 340 },
      align: "center",
    }).setOrigin(0.5, 1).setDepth(21).setVisible(false).setResolution(ZOOM).setScale(1 / ZOOM);
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
    const hasCity = this.textures.exists("city");
    const ti = (s.depth + 1) % 2;
    const theme = THEMES[ti];
    if (this.decor) this.decor.forEach((d) => d.img.destroy());
    this.decor = [];

    for (let y = 0; y < s.th; y++) {
      const row = [];
      for (let x = 0; x < s.tw; x++) {
        let img;
        const n = !isFloor(x, y - 1), e = !isFloor(x + 1, y), so = !isFloor(x, y + 1), w = !isFloor(x - 1, y);
        if (isFloor(x, y)) {
          if (hasCity) {
            let frame = theme.floor(n, e, so, w);
            if (theme.floorAlt && hash(x, y) < 0.15) frame = theme.floorAlt;
            img = this.add.image(x * TILE, y * TILE, "city", frame);
            // Deko nur auf Platzkacheln (gerade Koordinaten liegen nie auf dem Weg der Figur)
            if (x % 2 === 0 && y % 2 === 0 && hash(y, x) < 0.55) {
              const d = this.add.image(x * TILE, y * TILE, "city", DECOR[Math.floor(hash(x + 7, y) * DECOR.length)])
                .setOrigin(0).setDepth(2).setVisible(false);
              this.decor.push({ img: d, x, y });
            }
          } else {
            img = this.add.image(x * TILE, y * TILE, "floor" + ((x * 7 + y * 13) % 2));
          }
        } else if (hasCity && !so) {
          // Boden darunter: Mauerfront
          const faces = theme.faces;
          img = this.add.image(x * TILE, y * TILE, "city", faces[Math.floor(hash(x, y) * faces.length)]);
        } else {
          let m = 0;
          if (!n) m |= 1;
          if (!e) m |= 2;
          if (!so) m |= 4;
          if (!w) m |= 8;
          img = this.add.image(x * TILE, y * TILE, hasCity ? "top" + ti + "_" + (m & 11) : "wall" + m);
        }
        img.setOrigin(0).setVisible(false);
        this.layer.add(img);
        row.push(img);
      }
      this.tileImgs.push(row);
    }

    this.stairsPos = s.stairs;
    this.stairsImg = this.add.image(s.stairs[0] * TILE, s.stairs[1] * TILE, "stairs")
      .setOrigin(0).setDepth(1).setVisible(false);

    for (const e of this.entities.values()) e.imgs.forEach((i) => i.destroy());
    this.entities.clear();
    for (const e of s.entities || []) this.addEntity(e);

    if (!this.figure) {
      if (this.useSheet) {
        this.figure = this.add.sprite(0, 0, "herosheet", 22 * 13).setOrigin(0.5, 0.97).setDepth(10);
      } else {
        this.figure = this.add.image(0, 0, "hero").setDepth(10);
      }
      this.pointer = this.add.image(0, 0, "pointer").setDepth(11).setVisible(!this.useSheet);
    }
    this.dead = false;

    this.step = s.step || 0.25;
    this.reveal(s.revealed, true);
    // keine Kamera-Grenzen: die Figur bleibt immer im oberen Bildteil,
    // damit Abstimmung und Chat unten sie nie verdecken
    this.cameras.main.removeBounds();
    this.moveFigure(s.pos, s.facing, true);
    this.cameras.main.startFollow(this.figure, true, 0.12, 0.12);
    this.cameras.main.setZoom(ZOOM);
    this.cameras.main.setFollowOffset(0, -90 / ZOOM);
  }

  addEntity(e) {
    const tile = this.tileImgs[e.y] && this.tileImgs[e.y][e.x];
    const visible = !!(tile && tile.visible);
    const frames = this.textures.exists("city") ? ENTITY_FRAMES[e.kind] : null;
    const imgs = [];
    if (frames) {
      frames.forEach((f, i) => {
        const dy = i - (frames.length - 1);   // obere Kachel eine Reihe höher
        imgs.push(this.add.image(e.x * TILE, (e.y + dy) * TILE, "city", f).setOrigin(0).setDepth(3));
      });
    } else {
      imgs.push(this.add.image(e.x * TILE, e.y * TILE, "ent_" + e.kind).setOrigin(0).setDepth(3));
    }
    imgs.forEach((img) => img.setVisible(visible));
    this.entities.set(e.id, { imgs, x: e.x, y: e.y });
  }

  removeEntity(id) {
    const e = this.entities.get(id);
    if (!e) return;
    this.tweens.add({ targets: e.imgs, alpha: 0, duration: 400, onComplete: () => e.imgs.forEach((i) => i.destroy()) });
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
      if (shown.has(e.x + "," + e.y)) e.imgs.forEach((i) => i.setVisible(true));
    }
    for (const d of this.decor || []) {
      if (shown.has(d.x + "," + d.y)) d.img.setVisible(true);
    }
  }

  setCamp(info) {
    this.camping = !!(info && info.active);
    this.playIdle();
    if (info && info.active) {
      const [x, y] = info.pos;
      this.campfire.setPosition(x * TILE + TILE / 2 + 22, y * TILE + TILE / 2 + 4).setVisible(true);
      this.actText.setText(heroName + " " + info.text).setVisible(true);
    } else {
      this.campfire.setVisible(false);
      this.actText.setVisible(false);
    }
  }

  say(text, to) {
    if (!text) return;
    this.sayText.setText((to ? "@" + to + " " : "") + text).setVisible(true).setAlpha(1);
    if (this.sayTimer) this.sayTimer.remove();
    const ms = Math.max(4500, Math.min(11000, text.length * 75));
    this.sayTimer = this.time.delayedCall(ms, () => {
      this.tweens.add({ targets: this.sayText, alpha: 0, duration: 400, onComplete: () => this.sayText.setVisible(false) });
    });
  }

  update() {
    if (!this.figure) return;
    let top = this.figure.y - (this.useSheet ? 50 : 18);
    if (this.actText.visible) {
      this.actText.setPosition(this.figure.x, top);
      top -= this.actText.displayHeight + 3;
    }
    if (this.sayText.visible) {
      // im sichtbaren Bereich halten
      const view = this.cameras.main.worldView;
      const half = this.sayText.displayWidth / 2;
      const x = Math.max(view.x + half + 4, Math.min(view.right - half - 4, this.figure.x));
      const y = Math.max(view.y + this.sayText.displayHeight + 4, top);
      this.sayText.setPosition(x, y);
    }
  }

  moveFigure(pos, facing, instant) {
    const px = pos[0] * TILE + TILE / 2;
    const py = this.useSheet ? pos[1] * TILE + TILE - 3 : pos[1] * TILE + TILE / 2;
    const moved = Math.abs(this.figure.x - px) > 1 || Math.abs(this.figure.y - py) > 1;
    this.facing = facing || this.facing;
    this.pointer.setAngle(FACING_ANGLE[this.facing] || 0);
    if (instant) {
      this.figure.setPosition(px, py);
      this.pointer.setPosition(px, py);
      this.playIdle();
      return;
    }
    const duration = this.step * 1000 * 0.95;
    this.tweens.add({ targets: [this.figure, this.pointer], x: px, y: py, duration, ease: "Linear" });
    if (this.useSheet && !this.dead) {
      if (moved) this.figure.play("walk_" + this.facing, true);
      if (this.idleTimer) this.idleTimer.remove();
      this.idleTimer = this.time.delayedCall(this.step * 1000 * 1.8, () => this.playIdle());
    }
  }

  playIdle() {
    if (!this.useSheet || this.dead) return;
    if (this.camping) this.figure.play("sit_S", true);
    else this.figure.play("idle_" + this.facing, true);
  }

  action(name) {
    if (!this.useSheet || this.dead) return;
    if (this.idleTimer) this.idleTimer.remove();
    this.figure.play(name + "_" + this.facing);
    this.figure.once("animationcomplete", () => this.playIdle());
  }

  die() {
    this.dead = true;
    if (this.useSheet) this.figure.play("hurt");
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
  scene.die();
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
      scene.action(msg.label.startsWith("Kampf") ? "slash" : "emote");
      break;
    case "anim":
      scene.action(msg.name);
      break;
    case "camp":
      scene.setCamp(msg);
      break;
    case "say":
      scene.say(msg.text, msg.to);
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
