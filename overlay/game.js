// Höhlenspiel Overlay (Etappe 1, Platzhaltergrafik)
// Stellt nur dar, was der Server schickt. Die Logik liegt komplett in Python.

const TILE = 32;
const ZOOM = Number(new URLSearchParams(location.search).get("zoom")) || 2;   // Pixelgrafik doppelt groß
const params = new URLSearchParams(location.search);
const TESTCHAT = params.has("testchat");

const LABELS = { links: "Links", geradeaus: "Geradeaus", rechts: "Rechts", zurueck: "Zurück" };
const COMMAND = { links: "!links", geradeaus: "!geradeaus", rechts: "!rechts", zurueck: "!zurueck" };
const FACING_ANGLE = { N: 0, E: 90, S: 180, W: 270 };

// Mage City Arcanos (Hyptosis, CC0): 8 Kacheln pro Zeile, Bildnummer = Zeile * 8 + Spalte.
// Alle Nummern laut assets/tiles/magecity.json
const F = (row, col) => row * 8 + col;

// Viertel je Ebene: ungerade = Marktviertel (Sandstein), gerade = verfallenes Viertel (grau, Moos)
const THEMES = [
  {
    floor: (x, y) => { const r = hash(x, y); return r < 0.2 ? 75 : r < 0.35 ? 76 : 81; },
    facade: { upper: { l: 32, m: 33, r: 34 }, lower: { l: 40, m: 41, r: 42 } },
    roofs: ["brown", "brown", "brown", "moss"],
  },
  {
    floor: (x, y) => { const r = hash(x, y); return r < 0.04 ? 328 : r < 0.12 ? 9 : r < 0.5 ? 330 : 1; },
    facade: { upper: { l: 221, m: 221, r: 221 }, lower: { l: 229, m: 229, r: 229 } },
    roofs: ["moss", "moss", "brown"],
  },
];

// Dächer: je Zeile links, mitte, rechts
const ROOFS = {
  brown: { top: [184, 185, 186], mid: [192, 193, 194], eave: [200, 201, 202], midAlt: [187, 193, 193] },
  moss: { top: [189, 190, 191], mid: [197, 198, 199], eave: [205, 206, 207], midAlt: [198, 198, 198] },
};
// Fenster: [obere Hälfte, untere Hälfte], liegen transparent auf der Fassade
const WINDOWS = [[155, 163], [154, 162], [153, 161], [171, 179], [174, 182], [175, 183], [170, 178]];
const DOORWAY = 326;   // dunkle Kachel als offener Hauseingang

// Gegenstände: Bildnummern von oben nach unten (eine Spalte)
const ENTITY_FRAMES = {
  shrine: [98, 106, 114],      // statue_antik, 1x3
  chest: [79],                 // Jutesack
  mushroom: [262],             // Kürbis
};
const SPRING_FRAMES = [[22, 23], [30, 31]];   // Brunnen 2x2
const PLAZA_PLANTS = [16, 2, 3, 10, 11, 12];  // Ecken eines Platzes

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

  // Schatten auf dem Boden direkt unter einer Mauer, überall gleich
  g.clear();
  for (let i = 0; i < 8; i++) {
    g.fillStyle(0x000000, 0.32 * (1 - i / 8));
    g.fillRect(0, i, TILE, 1);
  }
  g.generateTexture("wallshade", TILE, TILE);

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
    const overlays = [];

    // Häuser: jede senkrechte Mauerfolge ist unten Fassade (2 Reihen), darüber Dach.
    // Nebeneinanderliegende Spalten mit gleicher Ober- und Unterkante bilden eine Häuserzeile,
    // die in Häuser von meist 3 Kacheln Breite geteilt wird.
    const role = [];
    for (let y = 0; y < s.th; y++) role.push(new Array(s.tw).fill(null));
    const runAt = [];
    for (let x = 0; x < s.tw; x++) {
      let y = 0;
      while (y < s.th) {
        if (isFloor(x, y)) { y++; continue; }
        const y0 = y;
        while (y < s.th && !isFloor(x, y)) y++;
        const y1 = y - 1;
        const len = y1 - y0 + 1;
        const facadeRows = isFloor(x, y1 + 1) ? Math.min(2, len) : 0;
        const roofRows = len - facadeRows;
        for (let yy = y0; yy <= y1; yy++) {
          const k = yy - y0;
          let r;
          if (k >= roofRows) r = { kind: "facade", row: (k - roofRows === facadeRows - 1) ? "lower" : "upper" };
          else if (k === 0) r = { kind: "roof", row: roofRows === 1 && facadeRows ? "eave" : "top" };
          else if (k === roofRows - 1 && facadeRows) r = { kind: "roof", row: "eave" };
          else r = { kind: "roof", row: "mid" };
          r.key = y0 + ":" + y1;
          role[yy][x] = r;
        }
      }
    }
    // Häuser waagerecht zuschneiden
    const houseOf = [];
    for (let y = 0; y < s.th; y++) houseOf.push(new Array(s.tw).fill(null));
    for (let y = 0; y < s.th; y++) {
      let x = 0;
      while (x < s.tw) {
        const r = role[y][x];
        if (!r || r.done) { x++; continue; }
        // Zeile nur einmal pro Häuserzeile bearbeiten (an der Oberkante)
        const y0 = Number(r.key.split(":")[0]);
        if (y !== y0) { x++; continue; }
        let x1 = x;
        while (x1 + 1 < s.tw && role[y][x1 + 1] && role[y][x1 + 1].key === r.key) x1++;
        let rem = x1 - x + 1, hx = x;
        while (rem > 0) {
          const w = rem === 4 ? 4 : rem === 2 ? 2 : rem === 1 ? 1 : 3;
          const id = hash(hx * 3 + 1, y0 * 7 + 2);
          const house = {
            x0: hx, w,
            roof: theme.roofs[Math.floor(hash(hx, y0 + 99) * theme.roofs.length)],
            windows: [],
            door: -1,
          };
          // Fenster und Tür für die Mittelspalten
          for (let c = 0; c < w; c++) {
            const edge = w >= 3 && (c === 0 || c === w - 1);
            house.windows.push(edge ? null : WINDOWS[Math.floor(hash(hx + c, y0 + 5) * WINDOWS.length)]);
          }
          if (w >= 3 && id < 0.3) house.door = 1 + Math.floor(hash(hx, y0 + 11) * (w - 2));
          const y1 = Number(r.key.split(":")[1]);
          for (let c = 0; c < w; c++) {
            for (let yy = y0; yy <= y1; yy++) houseOf[yy][hx + c] = { house, col: c };
          }
          hx += w;
          rem -= w;
        }
        x = x1 + 1;
      }
    }

    const colRole = (h, c) => (h.w === 1 ? 1 : c === 0 ? 0 : c === h.w - 1 ? 2 : 1);
    const LMR = ["l", "m", "r"];

    for (let y = 0; y < s.th; y++) {
      const row = [];
      for (let x = 0; x < s.tw; x++) {
        let img;
        const extras = [];
        const add = (frame, depth) => {
          const o = this.add.image(x * TILE, y * TILE, "city", frame).setOrigin(0).setVisible(false);
          if (depth) o.setDepth(depth);
          extras.push(o);
          overlays.push(o);
          return o;
        };
        if (!hasCity) {
          img = this.add.image(x * TILE, y * TILE, isFloor(x, y) ? "floor" + ((x * 7 + y * 13) % 2) : "wall0");
        } else if (isFloor(x, y)) {
          img = this.add.image(x * TILE, y * TILE, "city", theme.floor(x, y));
          if (!isFloor(x, y - 1)) {
            const shade = this.add.image(x * TILE, y * TILE, "wallshade").setOrigin(0).setVisible(false);
            extras.push(shade);
            overlays.push(shade);
          }
        } else {
          const r = role[y][x];
          const ho = houseOf[y][x];
          const h = ho ? ho.house : { w: 1, roof: "brown", windows: [null], door: -1 };
          const c = ho ? ho.col : 0;
          const cr = colRole(h, c);
          if (r.kind === "roof") {
            const set = ROOFS[h.roof];
            let frame = set[r.row][cr];
            if (r.row === "mid" && cr === 1 && hash(x, y + 3) < 0.3) frame = set.midAlt[Math.floor(hash(y, x) * 3)];
            if (r.row === "top" && cr !== 1) {
              // Giebelecken sind oben durchsichtig: Boden dahinter
              img = this.add.image(x * TILE, y * TILE, "city", theme.floor(x, y));
              add(frame);
            } else {
              img = this.add.image(x * TILE, y * TILE, "city", frame);
            }
          } else {
            const f = theme.facade[r.row];
            img = this.add.image(x * TILE, y * TILE, "city", f[LMR[cr]]);
            const win = h.windows[c];
            if (r.row === "lower" && h.door === c) {
              add(DOORWAY);
            } else if (win && !(r.row === "upper" && h.door === c)) {
              add(r.row === "upper" ? win[0] : win[1]);
            }
          }
        }
        img.setOrigin(0).setVisible(false);
        img.extras = extras;
        this.layer.add(img);
        row.push(img);
      }
      this.tileImgs.push(row);
    }
    overlays.forEach((o) => this.layer.add(o));   // Fenster, Schatten und Giebelecken über den Grundkacheln

    // Plätze: Brunnen in der Mitte, Pflanzen in den Ecken
    for (const [px, py, pw, ph] of s.plazas || []) {
      if (!hasCity) break;
      const fx = px + pw / 2 - 1, fy = py + ph / 2 - 1;
      SPRING_FRAMES.forEach((r, ry) => r.forEach((f, rx) => {
        const d = this.add.image((fx + rx) * TILE, (fy + ry) * TILE, "city", f).setOrigin(0).setDepth(2).setVisible(false);
        this.decor.push({ img: d, x: fx + rx, y: fy + ry });
      }));
      [[px, py], [px + pw - 1, py], [px, py + ph - 1], [px + pw - 1, py + ph - 1]].forEach(([cx, cy], i) => {
        const f = PLAZA_PLANTS[Math.floor(hash(cx + i, cy) * PLAZA_PLANTS.length)];
        const d = this.add.image(cx * TILE, cy * TILE, "city", f).setOrigin(0).setDepth(2).setVisible(false);
        this.decor.push({ img: d, x: cx, y: cy });
      });
    }

    this.stairsPos = s.stairs;
    this.stairsImg = this.add.image(s.stairs[0] * TILE, s.stairs[1] * TILE, "stairs")
      .setOrigin(0.5).setDepth(1).setVisible(false);

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
    const tile = this.tileImgs[Math.floor(e.y)] && this.tileImgs[Math.floor(e.y)][Math.floor(e.x)];
    const bx = e.x * TILE - TILE / 2, by = e.y * TILE - TILE / 2;   // linke obere Ecke, mittig auf der Position
    const visible = !!(tile && tile.visible);
    const frames = this.textures.exists("city") ? ENTITY_FRAMES[e.kind] : null;
    const imgs = [];
    if (this.textures.exists("city") && e.kind === "spring") {
      SPRING_FRAMES.forEach((row, ry) => row.forEach((f, rx) => {
        imgs.push(this.add.image(bx + rx * 16, by + ry * 16, "city", f)
          .setOrigin(0).setScale(0.5).setDepth(3));
      }));
    } else if (frames) {
      frames.forEach((f, i) => {
        const dy = i - (frames.length - 1);   // obere Kacheln weiter oben
        imgs.push(this.add.image(bx, by + dy * TILE, "city", f).setOrigin(0).setDepth(3));
      });
    } else {
      imgs.push(this.add.image(bx, by, "ent_" + e.kind).setOrigin(0).setDepth(3));
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
      const targets = [img, ...(img.extras || [])];
      targets.forEach((t) => t.setVisible(true));
      shown.add(x + "," + y);
      if (!instant) {
        targets.forEach((t) => t.setAlpha(0));
        this.tweens.add({ targets, alpha: 1, duration: 350 });
      }
    }
    // Treppe und Gegenstände sitzen auf Kachelgrenzen: sichtbar, sobald die Kachel rechts unten davon sichtbar ist
    if (this.stairsPos && shown.has(Math.floor(this.stairsPos[0]) + "," + Math.floor(this.stairsPos[1]))) {
      this.stairsImg.setVisible(true);
    }
    for (const e of this.entities.values()) {
      if (shown.has(Math.floor(e.x) + "," + Math.floor(e.y))) e.imgs.forEach((i) => i.setVisible(true));
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
      this.campfire.setPosition(x * TILE + 24, y * TILE + 6).setVisible(true);
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
    // Positionen sind Kachelkoordinaten als Kommazahl (Mitte einer Gasse)
    const px = pos[0] * TILE;
    const py = this.useSheet ? pos[1] * TILE + 14 : pos[1] * TILE;
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
