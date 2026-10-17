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

// Viertel der Stadt: Marktviertel (Sandstein) oder verfallenes Viertel (grau, Moos)
const THEMES = [
  {
    floor: (x, y) => { const r = hash(x, y); return r < 0.2 ? 75 : r < 0.35 ? 76 : 81; },
    facade: { upper: { l: 32, m: 33, r: 34 }, lower: { l: 40, m: 41, r: 42 } },
    roofs: ["brown", "brown", "brown", "moss"],
    outdoor: 0.25,
  },
  {
    floor: (x, y) => { const r = hash(x, y); return r < 0.04 ? 328 : r < 0.12 ? 9 : r < 0.5 ? 330 : 1; },
    facade: { upper: { l: 221, m: 221, r: 221 }, lower: { l: 229, m: 229, r: 229 } },
    roofs: ["moss", "moss", "brown"],
    outdoor: 0.3,
  },
  // Gartenviertel am Stadtrand: viel Grün, Parks und Gärten zwischen wenigen Häusern
  {
    floor: (x, y) => { const r = hash(x, y); return r < 0.2 ? 75 : r < 0.35 ? 76 : 81; },
    facade: { upper: { l: 32, m: 33, r: 34 }, lower: { l: 40, m: 41, r: 42 } },
    roofs: ["brown", "moss"],
    outdoor: 0.65,
    tufts: 0.08,
  },
];

// Parks: Baumkronen 3x3 (Herbstlaub), knorriger Baum 2x4, kleine Bäume im Fass 1x2, Büsche
const CROWNS = [
  [[240, 241, 242], [248, 249, 250], [256, 257, 258]],
  [[243, 244, 245], [251, 252, 253], [null, 260, 261]],
];
const GNARLED = [[122, 123], [130, 131], [138, 139], [146, 147]];
const BARREL_TREES = [[19, 27], [17, 25]];
const BUSHES = [10, 10, 2, 3];

// Dächer: je Zeile links, mitte, rechts
const ROOFS = {
  brown: { top: [184, 185, 186], mid: [192, 193, 194], eave: [200, 201, 202], midAlt: [187, 193, 193] },
  moss: { top: [189, 190, 191], mid: [197, 198, 199], eave: [205, 206, 207], midAlt: [198, 198, 198] },
};
// Fenster: [obere Hälfte, untere Hälfte], liegen transparent auf der Fassade
const WINDOWS = [[155, 163], [154, 162], [153, 161], [171, 179], [174, 182], [175, 183], [170, 178]];
WINDOWS.push([153, 160]);   // großes Fenster mit Ladenschild
const DOORWAY = 326;   // dunkle Kachel als offener Hauseingang
const WOOD_FACADE = { upper: [298, 299], lower: [306, 307] };   // Holzhaus
const IVY = [[300, 301], [308, 309]];                           // Kletterranke 2x2
const LEAVES = [263, 269, 271, 278, 279, 302, 310];
const GRASS = [0, 282, 283, 290, 291];
const FLOWERS = [292, 293];
const BEDS = [337, 339, 331];
const HEDGE = 223;
const FENCE = { top: [314, 315], bottom: [322, 323] };

// Plätze: Inhalt der freien 4x4-Mitte, Raster [zeile][spalte], null = frei
const PLAZA_LAYOUTS = {
  markt: [
    [null, null, 77, 12],
    [5, 6, null, 7],
    [13, 14, 343, 15],
    [79, 78, 351, null],
  ],
  park: [
    [19, null, 17, 18],
    [27, null, 25, 26],
    [null, 120, 121, 16],
    [null, 128, 129, 24],
  ],
  statuen: [
    [null, 98, 97, null],
    [null, 106, 105, null],
    [21, 114, 113, 21],
    [29, null, null, 29],
  ],
};

// Gegenstände: Bildnummern von oben nach unten (eine Spalte)
const ENTITY_FRAMES = {
  shrine: [98, 106, 114],      // statue_antik, 1x3
  mushroom: [262],             // Kürbis
};
const SPRING_FRAMES = [[22, 23], [30, 31]];   // Brunnen 2x2

// Dungeon Crawl Stone Soup (CC0): Monster und Gegenstände, je 32x32
const MONSTER_KEYS = {
  "Ratte": "ratte", "Fledermaus": "fledermaus", "Riesenspinne": "riesenspinne", "Goblin": "goblin",
  "Streunender Wolf": "wolf", "Skelett": "skelett", "Steingolem": "steingolem", "Oger": "oger",
};
const FLYING = new Set(["Fledermaus"]);
// Unterwelt: Gruppen aus assets/dcss/unterwelt.json
const UNDER = {
  keller: { floor: "keller_floor", wall: "keller_wall", deco: "keller_deco", decoChance: 0.05, hall: "keller_deco", dark: 0.55 },
  katakomben: { floor: "kata_floor", wall: "kata_wall", wallAlt: "kata_wall_alt", deco: "kata_deco", decoChance: 0.06,
    hall: "kata_deco", dark: 0.72 },
  hoehle: { floor: "hoehle_floor", wall: "hoehle_wall", deco: "hoehle_deco", decoChance: 0.07, hall: "hoehle_deco", dark: 0.8 },
};
// Tageszeit nach der Uhr des PCs (in der Stadt). Zum Testen: ?stunde=22
const HOUR_OVERRIDE = params.has("stunde") ? Number(params.get("stunde")) : null;
// Stützpunkte: Stunde, Farbton (wird mit dem Bild multipliziert), Stärke des Farbtons, Dunkelheit
const DAYTIME = [
  [0, 0x2a3a7a, 0.8, 0.7],
  [5, 0x2a3a7a, 0.8, 0.7],
  [6.5, 0xff9070, 0.4, 0.2],
  [8, 0xffffff, 0, 0],
  [17, 0xffffff, 0, 0],
  [19, 0xff8a40, 0.45, 0],
  [20.5, 0x5a4a9a, 0.6, 0.35],
  [22, 0x2a3a7a, 0.8, 0.7],
  [24, 0x2a3a7a, 0.8, 0.7],
];

function daytime(hour) {
  for (let i = 0; i < DAYTIME.length - 1; i++) {
    const [h0, c0, t0, d0] = DAYTIME[i];
    const [h1, c1, t1, d1] = DAYTIME[i + 1];
    if (hour >= h0 && hour <= h1) {
      const f = h1 > h0 ? (hour - h0) / (h1 - h0) : 0;
      const a = Phaser.Display.Color.IntegerToColor(c0);
      const b = Phaser.Display.Color.IntegerToColor(c1);
      const mix = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 100, Math.round(f * 100));
      return {
        color: Phaser.Display.Color.GetColor(mix.r, mix.g, mix.b),
        tint: t0 + (t1 - t0) * f,
        dark: d0 + (d1 - d0) * f,
      };
    }
  }
  return { color: 0xffffff, tint: 0, dark: 0 };
}

function currentHour() {
  if (HOUR_OVERRIDE !== null && !Number.isNaN(HOUR_OVERRIDE)) return HOUR_OVERRIDE % 24;
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}

const LIGHT_SIZE = 2000;   // Durchmesser des Dunkelheitsbilds in Weltpixeln
const ITEM_KEYS = ["chest_closed", "chest_open", "trap", "food", "water", "potion", "gold"];
const PLAZA_PLANTS = [16, 2, 3, 10, 11, 12];  // Ecken eines Platzes

// LPC-Spritesheet: 64x64 je Bild, 13 Bilder pro Zeile, Richtungen je Animation in der Reihenfolge N, W, S, O
const DIR_ROW = { N: 0, W: 1, S: 2, E: 3 };

function makeHeroAnims(sc, sheet = "herosheet", prefix = "") {
  const mk = (key, base, from, to, rate, repeat) => {
    for (const [d, r] of Object.entries(DIR_ROW)) {
      const frames = [];
      for (let c = from; c <= to; c++) frames.push({ key: sheet, frame: (base + r) * 13 + c });
      if (!sc.anims.exists(prefix + key + "_" + d)) sc.anims.create({ key: prefix + key + "_" + d, frames, frameRate: rate, repeat });
    }
  };
  if (prefix) {     // Bewohner brauchen nur Gehen und Stehen
    mk("walk", 8, 1, 8, 10, -1);
    mk("idle", 22, 0, 1, 2, -1);
    return;
  }
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
let lastDepth = null;
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

  // dasselbe für eine Mauer links daneben, schwächer
  g.clear();
  for (let i = 0; i < 6; i++) {
    g.fillStyle(0x000000, 0.22 * (1 - i / 6));
    g.fillRect(i, 0, 1, TILE);
  }
  g.generateTexture("wallshade_side", TILE, TILE);

  // unter Tage: Mauerkante oben deutlicher
  g.clear();
  for (let i = 0; i < 12; i++) {
    g.fillStyle(0x000000, 0.55 * (1 - i / 12));
    g.fillRect(0, i, TILE, 1);
  }
  g.generateTexture("wallshade_u", TILE, TILE);

  // Dunkelheit: innen durchsichtig, außen schwarz. Wird groß skaliert und folgt der Figur.
  if (!sc.textures.exists("darkness")) {
    const size = 512;
    const tex = sc.textures.createCanvas("darkness", size, size);
    const ctx = tex.getContext();
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.05, "rgba(0,0,0,0)");
    grad.addColorStop(0.12, "rgba(0,0,0,0.6)");
    grad.addColorStop(0.21, "rgba(0,0,0,1)");
    grad.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    tex.refresh();
  }

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

// ---------- Ton: Musik je Gebiet, Geräusche zu Ereignissen ----------
// Kenney RPG Sounds (CC0), Monster SFX Pack von Ogrebane (CC0),
// Musik: "The Old Tower Inn" von RandomMind (CC0), "Loopable dungeon ambience" von JaggedStone (CC0)
const SFX = {
  step: ["footstep00", "footstep01", "footstep02", "footstep03", "footstep04"],
  voteStart: ["bookFlip1"],
  voteEnd: ["bookClose"],
  draw: ["drawKnife1", "drawKnife2"],
  hit: ["knifeSlice", "knifeSlice2", "chop"],
  growl: ["monster1", "monster6", "monster8", "monster10"],
  pain: ["monster2", "monster3", "monster4", "monster7", "monster9"],
  chest: ["creak1", "creak2"],
  coins: ["handleCoins", "handleCoins2"],
  bag: ["handleSmallLeather"],
  trap: ["metalClick"],
  trapSnap: ["metalLatch"],
  camp: ["cloth1"],
  cook: ["metalPot1"],
  stairs: ["doorOpen_2"],
  death: ["dropLeather"],
};
// Lautstärke je Geräuschart (zusätzlich zum Regler)
const SFX_GAIN = { step: 0.25, voteStart: 0.5, voteEnd: 0.4, growl: 0.55, pain: 0.5, coins: 0.7, bag: 0.6 };
// Fehlt Musik für eine Stimmung, wird die nächstpassende genommen
const MUSIC_FALLBACK = {
  stadt: ["stadt", "nacht"],
  nacht: ["nacht", "stadt"],
  keller: ["keller", "katakomben", "hoehle"],
  katakomben: ["katakomben", "hoehle", "keller"],
  hoehle: ["hoehle", "katakomben", "keller"],
};

const audio = {
  scene: null,
  enabled: true,
  music: 0.35,        // 0 bis 1
  sfx: 0.7,
  current: null,      // laufende Musik
  currentKey: null,
  quiet: false,       // Lager oder Nacht: Musik leiser
  stepCount: 0,

  init(scene) {
    this.scene = scene;
    const hint = document.getElementById("sound-hint");
    const update = () => hint && hint.classList.toggle("hidden", !(this.enabled && scene.sound.locked));
    update();
    scene.sound.on("unlocked", () => { update(); this.playMusic(this.wantMood, true); });
    document.addEventListener("pointerdown", update);
  },

  configure(cfg) {
    if (!cfg) return;
    this.enabled = cfg.enabled !== false;
    if (typeof cfg.music === "number") this.music = cfg.music;
    if (typeof cfg.sfx === "number") this.sfx = cfg.sfx;
    if (!this.enabled) this.stopMusic();
    else this.playMusic(this.wantMood, true);
    const hint = document.getElementById("sound-hint");
    if (hint && this.scene) hint.classList.toggle("hidden", !(this.enabled && this.scene.sound.locked));
  },

  play(kind, delay = 0) {
    if (!this.enabled || !this.scene || this.sfx <= 0) return;
    const list = SFX[kind];
    if (!list) return;
    const key = "sfx_" + list[Math.floor(Math.random() * list.length)];
    if (!this.scene.cache.audio.exists(key)) return;
    const go = () => this.scene.sound.play(key, {
      volume: this.sfx * (SFX_GAIN[kind] || 0.8),
      rate: 0.94 + Math.random() * 0.12,   // etwas Abwechslung
    });
    if (delay) setTimeout(go, delay);   // nicht an die Spielzeit gebunden, läuft auch im Hintergrund-Tab
    else go();
  },

  step() {
    // jeder zweite Schritt, sonst klappert es zu sehr
    this.stepCount++;
    if (this.stepCount % 2 === 0) this.play("step");
  },

  musicVolume() {
    return this.music * (this.quiet ? 0.45 : 1);
  },

  // Musik: je Stimmung ein Ordner unter assets/audio/music/, Stücke in zufälliger Reihenfolge
  async loadTracks() {
    try {
      this.tracks = await (await fetch("/api/music", { cache: "no-store" })).json();
    } catch (e) { /* Server weg, alte Liste behalten */ }
  },

  tracksFor(mood) {
    const t = this.tracks || {};
    for (const m of MUSIC_FALLBACK[mood] || [mood]) if (t[m] && t[m].length) return t[m];
    for (const list of Object.values(t)) if (list.length) return list;
    return [];
  },

  playMusic(mood, force) {
    this.wantMood = mood;
    if (!mood || !this.enabled || !this.scene || this.music <= 0) {
      this.stopMusic();
      return;
    }
    if (this.currentMood === mood && this.current && !force) return;
    if (this.currentMood === mood && this.current && this.current.isPlaying) {
      this.scene.tweens.add({ targets: this.current, volume: this.musicVolume(), duration: 1500 });
      return;
    }
    const list = this.tracksFor(mood);
    if (!list.length) return;
    let url = list[Math.floor(Math.random() * list.length)];
    if (list.length > 1 && url === this.lastUrl) url = list[(list.indexOf(url) + 1) % list.length];
    this.currentMood = mood;
    const key = "m:" + url;
    const go = () => {
      if (this.wantMood !== mood || !this.enabled) return;
      this.stopMusic();
      this.currentMood = mood;
      const snd = this.scene.sound.add(key, { volume: 0 });
      snd.once("complete", () => {          // Stück zu Ende: nächstes aus derselben Stimmung
        if (this.current !== snd) return;
        this.current = null;
        this.scene.tweens.killTweensOf(snd);
        snd.destroy();
        this.playMusic(this.wantMood, true);
      });
      snd.play();
      this.scene.tweens.add({ targets: snd, volume: this.musicVolume(), duration: 3000 });
      this.current = snd;
      this.lastUrl = url;
    };
    if (this.scene.cache.audio.exists(key)) go();
    else {
      this.scene.load.audio(key, url);
      this.scene.load.once("filecomplete-audio-" + key, go);
      this.scene.load.start();
    }
  },

  stopMusic() {
    if (!this.current) return;
    const old = this.current;
    this.current = null;
    this.currentMood = null;
    this.scene.tweens.killTweensOf(old);
    this.scene.tweens.add({ targets: old, volume: 0, duration: 2000, onComplete: () => old.destroy() });
  },

  setQuiet(q) {
    if (this.quiet === q) return;
    this.quiet = q;
    if (this.current) this.scene.tweens.add({ targets: this.current, volume: this.musicVolume(), duration: 2000 });
  },
};

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
    this.entities = new Map();   // id -> { imgs, x, y, kind }
    this.fight = null;
    this.campfire = null;
    this.actText = null;
    this.sayText = null;
    this.sayTimer = null;
  }

  preload() {
    this.load.spritesheet("city", "assets/tiles/magecity.png", { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet("herosheet", "assets/characters/hero.png", { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet("unter", "assets/dcss/unterwelt.png", { frameWidth: 32, frameHeight: 32 });
    this.load.json("unterwelt", "assets/dcss/unterwelt.json");
    for (const list of Object.values(SFX)) {
      for (const name of list) {
        if (!this.cache.audio.exists("sfx_" + name)) this.load.audio("sfx_" + name, "assets/audio/sfx/" + name + ".ogg");
      }
    }
    for (const key of new Set(Object.values(MONSTER_KEYS))) this.load.image("mon_" + key, "assets/dcss/monster/" + key + ".png");
    for (const key of ITEM_KEYS) this.load.image("item_" + key, "assets/dcss/item/" + key + ".png");
  }

  create() {
    makeTextures(this);
    audio.init(this);
    // Farbton der Tageszeit: großes Rechteck, das der Figur folgt und das Bild darunter einfärbt
    this.ambient = this.add.rectangle(0, 0, 8000, 8000, 0xffffff, 0).setDepth(14)
      .setBlendMode(Phaser.BlendModes.MULTIPLY).setVisible(false);
    this.time.addEvent({ delay: 20000, loop: true, callback: () => this.applyAmbient() });
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
    if (this.decor) this.decor.forEach((d) => d.img.destroy());
    this.decor = [];
    (this.levelTimers || []).forEach((t) => t.remove());
    this.levelTimers = [];
    this.layer = this.add.container(0, 0).setDepth(0);
    this.tileImgs = [];
    this.revealedSet = new Set();
    this.overview = false;
    this.ovShown = [];
    const areaKey = (s.area && s.area.key) || "stadt";
    const under = UNDER[areaKey] && this.textures.exists("unter") && this.cache.json.get("unterwelt") ? UNDER[areaKey] : null;
    this.under = under;
    this.areaKey = areaKey;
    if (under) this.buildUnderground(s, under);
    else this.buildCity(s);
    this.stairsPos = s.stairs;
    if (this.textures.exists("unter") && this.cache.json.get("unterwelt")) {
      const frame = this.uFrames("stairs_down")[0];
      this.stairsImg = this.add.image(s.stairs[0] * TILE, s.stairs[1] * TILE, "unter", frame);
    } else {
      this.stairsImg = this.add.image(s.stairs[0] * TILE, s.stairs[1] * TILE, "stairs");
    }
    this.stairsImg.setOrigin(0.5).setDepth(1).setVisible(false);

    for (const e of this.entities.values()) e.imgs.forEach((i) => { this.tweens.killTweensOf(i); i.destroy(); });
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
    this.mapSize = [s.tw * TILE, s.th * TILE];
    this.setNpcs(s.npcs || [], s.npc_sprites || 0);
    if (s.overview) this.setOverview(true, true);
    this.applyAmbient();
  }

  // Stadt: Häuserzeilen mit Dächern und Fassaden, Gärten, Plätze
  buildCity(s) {
    const rows = s.tiles;
    const isFloor = (x, y) => x >= 0 && y >= 0 && x < s.tw && y < s.th && rows[y][x] === ".";
    const hasCity = this.textures.exists("city");
    // Viertel je Karte zufällig, aber für dieselbe Karte immer gleich
    const forced = Number(params.get("viertel"));   // zum Testen: ?viertel=0, 1 oder 2
    const ti = params.has("viertel") && THEMES[forced] ? forced
      : Math.floor(hash(s.stairs[0] * 3 + s.tw, s.stairs[1] * 5 + s.depth) * THEMES.length);
    const theme = THEMES[ti];
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
        const runLen = Number(r.key.split(":")[1]) - y0 + 1;
        // Grünflächen statt Häusern: im Gartenviertel oft, sonst gelegentlich, in langen Blöcken häufiger
        const outdoor = theme.outdoor || 0.25;
        const greenChance = runLen >= 8 ? Math.min(0.85, outdoor + 0.35) : outdoor;
        if (x1 - x + 1 >= 2 && hash(x * 5 + 3, y0 * 11 + 7) < greenChance) {
          const y1g = Number(r.key.split(":")[1]);
          const park = x1 - x + 1 >= 3 && runLen >= 3 && hash(x * 7 + 5, y0 * 3 + 1) < 0.55;
          const garden = { garden: true, park, x0: x, x1, y0, y1: y1g, fence: isFloor(x, y1g + 1) };
          if (park) garden.trees = this.planPark(x, x1, y0, y1g);
          for (let gx = x; gx <= x1; gx++) for (let yy = y0; yy <= y1g; yy++) houseOf[yy][gx] = { house: garden, col: gx - x };
          x = x1 + 1;
          continue;
        }
        let rem = x1 - x + 1, hx = x;
        while (rem > 0) {
          const w = rem === 4 ? 4 : rem === 2 ? 2 : rem === 1 ? 1 : 3;
          const id = hash(hx * 3 + 1, y0 * 7 + 2);
          const house = {
            x0: hx, w,
            roof: theme.roofs[Math.floor(hash(hx, y0 + 99) * theme.roofs.length)],
            windows: [],
            door: -1,
            wood: hash(hx + 17, y0) < 0.1,
            ivy: w >= 2 && hash(hx + 9, y0 + 4) < (ti === 1 ? 0.35 : 0.08) ? Math.floor(hash(hx, y0 + 8) * (w - 1)) : -1,
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
    const PLAZA_TYPES = ["brunnen", "markt", "park", "park", "statuen"];
    const plazaType = (px, py) => PLAZA_TYPES[Math.floor(hash(px * 13, py * 17) * PLAZA_TYPES.length)];
    const grassTiles = new Set();
    for (const [px, py, pw, ph] of s.plazas || []) {
      if (plazaType(px, py) === "park") {
        for (let yy = py; yy < py + ph; yy++) for (let xx = px; xx < px + pw; xx++) grassTiles.add(xx + "," + yy);
      }
    }
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
          img = this.add.image(x * TILE, y * TILE, "city", grassTiles.has(x + "," + y) ? GRASS[Math.floor(hash(x, y) * GRASS.length)] : theme.floor(x, y));
          if (hash(x + 31, y + 17) < (ti === 1 ? 0.1 : 0.02)) add(LEAVES[Math.floor(hash(y, x + 3) * LEAVES.length)]);
          else if (theme.tufts && hash(x + 13, y + 41) < theme.tufts) add([2, 3, 53][Math.floor(hash(x, y + 7) * 3)]);
          if (!isFloor(x, y - 1)) {
            const shade = this.add.image(x * TILE, y * TILE, "wallshade").setOrigin(0).setVisible(false);
            extras.push(shade);
            overlays.push(shade);
          }
        } else {
          const r = role[y][x];
          const ho = houseOf[y][x];
          const h = ho ? ho.house : { w: 1, roof: "brown", windows: [null], door: -1, ivy: -1 };
          const c = ho ? ho.col : 0;
          const cr = colRole(h, c);
          if (h.park) {
            img = this.add.image(x * TILE, y * TILE, "city", GRASS[Math.floor(hash(x, y) * GRASS.length)]);
            const f = h.trees.get(x + "," + y);
            if (f !== undefined && f !== null) add(f);
          } else if (h.garden) {
            img = this.add.image(x * TILE, y * TILE, "city", this.gardenTile(h, x, y, add));
          } else if (r.kind === "roof") {
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
            const base = h.wood ? WOOD_FACADE[r.row][x % 2] : f[LMR[cr]];
            img = this.add.image(x * TILE, y * TILE, "city", base);
            if (h.ivy >= 0 && (c === h.ivy || c === h.ivy + 1)) add(IVY[r.row === "upper" ? 0 : 1][c - h.ivy]);
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

    // Plätze: Brunnen, Markt, Park oder Statuen
    for (const [px, py, pw, ph] of s.plazas || []) {
      if (!hasCity) break;
      const type = plazaType(px, py);
      if (type !== "brunnen") {
        PLAZA_LAYOUTS[type].forEach((row, ry) => row.forEach((f, rx) => {
          if (f === null) return;
          const d = this.add.image((px + rx) * TILE, (py + ry) * TILE, "city", f).setOrigin(0).setDepth(2).setVisible(false);
          this.decor.push({ img: d, x: px + rx, y: py + ry });
        }));
        continue;
      }
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

  }

  uFrames(group) {
    return (this.cache.json.get("unterwelt") || {})[group] || [0];
  }

  uPick(group, x, y, salt = 0) {
    const list = this.uFrames(group);
    return list[Math.floor(hash(x + salt * 17, y + salt * 31) * list.length)];
  }

  // Unterwelt: Draufsicht wie in Dungeon Crawl, Mauern als volle Kacheln,
  // auf dem Boden unter einer Mauer ein Schatten, damit die Mauer Höhe bekommt
  buildUnderground(s, u) {
    const rows = s.tiles;
    const isFloor = (x, y) => x >= 0 && y >= 0 && x < s.tw && y < s.th && rows[y][x] === ".";
    const overlays = [];
    for (let y = 0; y < s.th; y++) {
      const row = [];
      for (let x = 0; x < s.tw; x++) {
        const extras = [];
        let img;
        if (isFloor(x, y)) {
          img = this.add.image(x * TILE, y * TILE, "unter", this.uPick(u.floor, x, y));
          if (!isFloor(x, y - 1)) {
            const sh = this.add.image(x * TILE, y * TILE, "wallshade_u").setOrigin(0).setVisible(false);
            extras.push(sh); overlays.push(sh);
          }
          if (!isFloor(x - 1, y)) {
            const sh = this.add.image(x * TILE, y * TILE, "wallshade_side").setOrigin(0).setVisible(false);
            extras.push(sh); overlays.push(sh);
          }
        } else {
          const alt = u.wallAlt && hash(x + 5, y + 9) < 0.15;
          img = this.add.image(x * TILE, y * TILE, "unter", this.uPick(alt ? u.wallAlt : u.wall, x, y, 1));
        }
        img.setOrigin(0).setVisible(false);
        img.extras = extras;
        this.layer.add(img);
        row.push(img);
      }
      this.tileImgs.push(row);
    }
    overlays.forEach((o) => this.layer.add(o));

    // Kleinkram am Gassenrand: nur an Mauern, nie in der Mitte des Wegs
    for (let y = 0; y < s.th; y++) {
      for (let x = 0; x < s.tw; x++) {
        if (!isFloor(x, y) || hash(x * 3 + 7, y * 5 + 1) > u.decoChance) continue;
        const walls = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => !isFloor(x + dx, y + dy)).length;
        if (walls < 2) continue;
        const d = this.add.image(x * TILE, y * TILE, "unter", this.uPick(u.deco, x, y, 2))
          .setOrigin(0).setDepth(2).setVisible(false);
        this.decor.push({ img: d, x, y });
      }
    }
    // Hallen (in der Stadt Plätze): vier Säulen oder Statuen in den Ecken
    for (const [px, py, pw, ph] of s.plazas || []) {
      [[px, py], [px + pw - 1, py], [px, py + ph - 1], [px + pw - 1, py + ph - 1]].forEach(([cx, cy], i) => {
        const d = this.add.image(cx * TILE, cy * TILE, "unter", this.uPick(u.hall, cx, cy, i))
          .setOrigin(0).setDepth(2).setVisible(false);
        this.decor.push({ img: d, x: cx, y: cy });
      });
    }
  }

  // Dunkelheit mit Lichtkreis um die Figur (unter Tage)
  musicMood() {
    if (this.under) return this.areaKey || "hoehle";
    return this.night ? "nacht" : "stadt";
  }

  // unter Tage zählt nur das Gebiet, in der Stadt die Tageszeit
  applyAmbient() {
    if (this.under) {
      this.night = false;
      audio.setQuiet(this.camping);
      this.ambient.setVisible(false);
      this.setDarkness(this.under.dark);
      return;
    }
    const t = daytime(currentHour());
    const wasNight = this.night;
    this.night = t.dark > 0.3;
    audio.setQuiet(this.camping || this.night);
    if (wasNight !== undefined && wasNight !== this.night) audio.playMusic(this.musicMood());
    this.ambient.setFillStyle(t.color, t.tint).setVisible(t.tint > 0.01);
    // im Überblick kein Lichtkreis, sonst wäre nachts fast alles schwarz
    this.setDarkness(t.dark > 0.01 && !this.overview ? t.dark : 0);
  }

  // ---------- Stadtbewohner ----------

  setNpcs(list, spriteCount) {
    for (const n of (this.npcs || new Map()).values()) { n.sprite.destroy(); if (n.bubble) n.bubble.destroy(); }
    this.npcs = new Map();
    for (const n of list) this.addNpc(n, spriteCount);
  }

  addNpc(n, spriteCount) {
    const own = spriteCount > 0 && n.sprite >= 0;
    const key = own ? "bewohner" + (n.sprite + 1) : "herosheet";
    const make = () => {
      if (!this.textures.exists(key)) return;
      const prefix = own ? key + "_" : "";
      if (own) makeHeroAnims(this, key, prefix);
      const spr = this.add.sprite(n.x * TILE, n.y * TILE + 14, key, 22 * 13).setOrigin(0.5, 0.97).setDepth(9);
      if (!own) spr.setTint(n.tint);     // Platzhalter: eingefärbte Heldenfigur
      if (this.overview) spr.setScale(2.2);
      const npc = { id: n.id, name: n.name, sprite: spr, prefix, facing: n.facing || "S", bubble: null, x: n.x, y: n.y };
      this.npcs.set(n.id, npc);
      spr.play(prefix + "idle_" + npc.facing, true);
      this.updateNpcVisibility(npc);
    };
    if (own && !this.textures.exists(key)) {
      this.load.spritesheet(key, "assets/characters/" + key + ".png", { frameWidth: 64, frameHeight: 64 });
      this.load.once("complete", make);
      this.load.start();
    } else {
      make();
    }
  }

  updateNpcVisibility(npc) {
    const vis = this.overview || this.revealedSet.has(Math.floor(npc.x) + "," + Math.floor(npc.y));
    npc.sprite.setVisible(vis);
    if (npc.bubble && !vis) npc.bubble.setVisible(false);
  }

  npcPos(m) {
    const npc = this.npcs && this.npcs.get(m.id);
    if (!npc) return;
    npc.x = m.x; npc.y = m.y;
    npc.facing = m.facing || npc.facing;
    const duration = this.step * 2 * 1000 * 0.95;
    this.tweens.add({ targets: npc.sprite, x: m.x * TILE, y: m.y * TILE + 14, duration, ease: "Linear" });
    npc.sprite.play(npc.prefix + "walk_" + npc.facing, true);
    if (npc.idleTimer) npc.idleTimer.remove();
    npc.idleTimer = this.time.delayedCall(this.step * 2 * 1000 * 1.6, () => npc.sprite.active && npc.sprite.play(npc.prefix + "idle_" + npc.facing, true));
    this.updateNpcVisibility(npc);
  }

  npcSay(m) {
    const npc = this.npcs && this.npcs.get(m.id);
    if (!npc) return;
    if (!npc.bubble) {
      npc.bubble = this.add.text(0, 0, "", {
        fontFamily: "Trebuchet MS, Verdana, sans-serif",
        fontSize: "16px",
        color: "#1a1620",
        backgroundColor: "#d9e6f2",
        padding: { x: 8, y: 5 },
        wordWrap: { width: 300 },
        align: "center",
      }).setOrigin(0.5, 1).setDepth(21).setResolution(ZOOM);
    }
    // im Gespräch spricht immer nur einer: andere Blasen ausblenden
    this.sayText.setVisible(false);
    for (const other of this.npcs.values()) if (other !== npc && other.bubble) other.bubble.setVisible(false);
    npc.bubble.setText(m.name + ": " + m.text).setVisible(npc.sprite.visible).setAlpha(1);
    if (npc.bubbleTimer) npc.bubbleTimer.remove();
    const ms = Math.max(3500, Math.min(8000, m.text.length * 70));
    npc.bubbleTimer = this.time.delayedCall(ms, () => {
      this.tweens.add({ targets: npc.bubble, alpha: 0, duration: 400, onComplete: () => npc.bubble.setVisible(false) });
    });
    // Sprecher dreht sich zur Figur, wenn sie nah ist
    const dx = this.figure.x - npc.sprite.x, dy = this.figure.y - npc.sprite.y;
    if (Math.abs(dx) + Math.abs(dy) < 4 * TILE) {
      npc.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "E" : "W") : (dy > 0 ? "S" : "N");
      npc.sprite.play(npc.prefix + "idle_" + npc.facing, true);
    }
  }

  // ---------- Überblick im Leerlauf: ganze Stadt, ohne Gegenstände ----------

  setOverview(on, instant) {
    if (on === this.overview) return;
    this.overview = on;
    const cam = this.cameras.main;
    const things = [...this.entities.values()].flatMap((e) => e.imgs);
    if (this.stairsImg) things.push(this.stairsImg);
    if (on) {
      this.ovShown = [];
      for (const row of this.tileImgs) {
        for (const img of row) {
          if (img.visible) continue;
          for (const t of [img, ...(img.extras || [])]) { t.setVisible(true).setAlpha(1); this.ovShown.push(t); }
        }
      }
      for (const d of this.decor || []) if (!d.img.visible) { d.img.setVisible(true); this.ovShown.push(d.img); }
      things.forEach((t) => t.setVisible(false));
      const [w, h] = this.mapSize;
      const zoom = Math.min(1280 / w, 720 / h) * 0.96;
      cam.stopFollow();
      if (instant) { cam.setZoom(zoom); cam.centerOn(w / 2, h / 2); }
      else { cam.pan(w / 2, h / 2, 4000, "Sine.easeInOut"); cam.zoomTo(zoom, 4000, "Sine.easeInOut"); }
    } else {
      this.ovShown.forEach((t) => t.setVisible(false));
      this.ovShown = [];
      for (const e of this.entities.values()) {
        const vis = this.revealedSet.has(Math.floor(e.x) + "," + Math.floor(e.y));
        e.imgs.forEach((i) => i.setVisible(vis));
      }
      if (this.stairsImg && this.stairsPos) {
        this.stairsImg.setVisible(this.revealedSet.has(Math.floor(this.stairsPos[0]) + "," + Math.floor(this.stairsPos[1])));
      }
      // Folge-Versatz: die Figur steht etwas über der Bildmitte
      cam.pan(this.figure.x, this.figure.y + 90 / ZOOM, instant ? 0 : 2500, "Sine.easeInOut");
      cam.zoomTo(ZOOM, instant ? 0 : 2500, "Sine.easeInOut", false, (c, p) => {
        if (p === 1) c.startFollow(this.figure, true, 0.12, 0.12, 0, -90 / ZOOM);
      });
    }
    for (const npc of (this.npcs || new Map()).values()) this.updateNpcVisibility(npc);
    // herausgezoomt wären die Figuren winzig: etwas größer zeichnen
    const people = [this.figure, ...[...(this.npcs || new Map()).values()].map((n) => n.sprite)];
    this.tweens.add({ targets: people, scale: on ? 2.2 : 1, duration: instant ? 0 : 2500 });
    this.applyAmbient();
  }

  setDarkness(alpha) {
    if (!this.dark) {
      this.dark = this.add.image(0, 0, "darkness").setDepth(15).setDisplaySize(LIGHT_SIZE, LIGHT_SIZE);
    }
    this.dark.setVisible(alpha > 0).setAlpha(alpha);
  }

  // Park: Bäume so verteilen, dass sie in den Block passen. Liefert "x,y" -> Bildnummer
  planPark(x0, x1, y0, y1) {
    const trees = new Map();
    const h = y1 - y0 + 1;
    const put = (grid, gx, gy) => grid.forEach((row, ry) => row.forEach((f, rx) => {
      if (f !== null) trees.set((gx + rx) + "," + (gy + ry), f);
    }));
    let x = x0;
    while (x <= x1) {
      const room = x1 - x + 1;
      const r = hash(x * 11 + 3, y0 * 5 + 9);
      if (room >= 3 && h >= 3 && r < 0.55) {
        // Baumkrone, bei hohen Blöcken mehrere übereinander
        for (let y = y0; y + 2 <= y1; y += 3) {
          if (y > y0 && hash(x, y) < 0.3) continue;
          put(CROWNS[Math.floor(hash(x + 3, y) * CROWNS.length)], x, y);
        }
        x += 3 + (hash(x, y0 + 1) < 0.4 ? 1 : 0);
      } else if (room >= 2 && h >= 4 && r < 0.75) {
        put(GNARLED, x, y1 - 3);
        x += 3;
      } else if (h >= 2 && r < 0.88) {
        put(BARREL_TREES[Math.floor(hash(x, y0 + 4) * BARREL_TREES.length)].map((f) => [f]), x, y1 - 1);
        x += 2;
      } else {
        trees.set(x + "," + (y1 - Math.floor(hash(x, y1) * Math.min(h, 2))), BUSHES[Math.floor(hash(x + 1, y0) * BUSHES.length)]);
        x += 1;
      }
    }
    return trees;
  }

  // Garten: Hecke am Rand, Zaun zur Gasse hin, innen Gras mit Beeten, Blumen, Kürbissen und kleinen Bäumen
  gardenTile(gd, x, y, add) {
    const atBottom = gd.fence && y >= gd.y1 - 1;
    if (atBottom) {
      add(y === gd.y1 ? FENCE.bottom[x % 2] : FENCE.top[x % 2]);
      return GRASS[Math.floor(hash(x, y) * GRASS.length)];
    }
    const wide = gd.x1 - gd.x0 >= 2;
    if (y === gd.y0 || (wide && (x === gd.x0 || x === gd.x1))) return HEDGE;
    const r = hash(x * 7 + 1, y * 3 + 2);
    if (y === gd.y0 + 1 && gd.y1 - gd.y0 >= 5) return BEDS[Math.floor(hash(x, y) * BEDS.length)];
    if (r < 0.08) add(262);
    else if (r < 0.12) add(270);
    else if (r < 0.2) add([2, 3, 10, 11][Math.floor(hash(y, x) * 4)]);
    if (r > 0.9) return FLOWERS[x % 2];
    return GRASS[Math.floor(hash(x, y) * GRASS.length)];
  }

  addEntity(e) {
    const tile = this.tileImgs[Math.floor(e.y)] && this.tileImgs[Math.floor(e.y)][Math.floor(e.x)];
    const bx = e.x * TILE - TILE / 2, by = e.y * TILE - TILE / 2;   // linke obere Ecke, mittig auf der Position
    const visible = !!(tile && tile.visible);
    const frames = this.textures.exists("city") ? ENTITY_FRAMES[e.kind] : null;
    const imgs = [];
    const UNDER_ENT = { spring: "fountain", shrine: "altar", mushroom: "pilz" };
    if (this.under && UNDER_ENT[e.kind]) {
      imgs.push(this.add.image(bx, by, "unter", this.uFrames(UNDER_ENT[e.kind])[0]).setOrigin(0).setDepth(3));
      if (e.kind === "spring" && this.uFrames("fountain").length > 1) {
        // Wasser bewegt sich: zwei Bilder im Wechsel
        const [a, b] = this.uFrames("fountain");
        const img = imgs[0];
        this.levelTimers.push(this.time.addEvent({ delay: 450, loop: true, callback: () => img.active && img.setFrame(img.frame.name === a ? b : a) }));
      }
    } else if (this.textures.exists("city") && e.kind === "spring") {
      SPRING_FRAMES.forEach((row, ry) => row.forEach((f, rx) => {
        imgs.push(this.add.image(bx + rx * 16, by + ry * 16, "city", f)
          .setOrigin(0).setScale(0.5).setDepth(3));
      }));
    } else if (frames) {
      frames.forEach((f, i) => {
        const dy = i - (frames.length - 1);   // obere Kacheln weiter oben
        imgs.push(this.add.image(bx, by + dy * TILE, "city", f).setOrigin(0).setDepth(3));
      });
    } else if (e.kind === "monster" && this.textures.exists("mon_" + MONSTER_KEYS[e.name])) {
      const fx = e.x * TILE, fy = e.y * TILE + 14;
      const fly = FLYING.has(e.name);
      const shadow = this.add.ellipse(fx, fy - 2, 20, 6, 0x000000, 0.35).setDepth(3);
      const img = this.add.image(fx, fy - (fly ? 10 : 0), "mon_" + MONSTER_KEYS[e.name]).setOrigin(0.5, 1).setDepth(4);
      if (e.x < this.figureTileX()) img.setFlipX(true);
      // leichtes Wippen, versetzt, damit nicht alle im Gleichtakt hüpfen
      this.tweens.add({
        targets: img, y: img.y - (fly ? 5 : 2), duration: fly ? 380 : 650 + (e.id % 5) * 60,
        yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: (e.id % 7) * 90,
      });
      imgs.push(shadow, img);
    } else if (e.kind === "chest" && this.textures.exists("item_chest_closed")) {
      imgs.push(this.add.image(e.x * TILE, e.y * TILE + 14, "item_chest_closed").setOrigin(0.5, 1).setDepth(3));
    } else {
      imgs.push(this.add.image(bx, by, "ent_" + e.kind).setOrigin(0).setDepth(3));
    }
    imgs.forEach((img) => img.setVisible(visible));
    this.entities.set(e.id, { imgs, x: e.x, y: e.y, kind: e.kind });
  }

  // Kampfausgang: besiegt blinkt auf und verschwindet, sonst flieht der Gegner
  resolveFight(won) {
    const f = this.fight;
    if (!f) return;
    this.fight = null;
    const img = f.e.imgs[1];
    if (won) {
      this.time.delayedCall(700, () => img.active && img.setTintFill(0xffffff));
      this.time.delayedCall(820, () => img.active && img.clearTint());
      f.fade(1000);
    } else {
      img.setFlipX(f.dx < 0);
      this.tweens.add({ targets: f.e.imgs, x: `+=${f.dx * 70}`, y: `+=${f.dy * 70}`, delay: 900, duration: 700 });
      f.fade(1100);
    }
  }

  figureTileX() {
    return this.figure ? this.figure.x / TILE : 0;
  }

  // Falle schnappt zu: kurz sichtbar, dann weg
  showTrap(x, y) {
    if (!this.textures.exists("item_trap")) return;
    const img = this.add.image(x * TILE, y * TILE + 14, "item_trap").setOrigin(0.5, 1).setDepth(3).setAlpha(0);
    this.tweens.add({ targets: img, alpha: 1, duration: 150 });
    this.tweens.add({ targets: img, alpha: 0, delay: 2600, duration: 600, onComplete: () => img.destroy() });
  }

  // Beute steigt über dem Kopf auf
  showLoot(items) {
    if (!this.figure) return;
    const list = items.filter((k) => this.textures.exists("item_" + k)).slice(0, 6);
    const top = this.figure.y - (this.useSheet ? 46 : 18);
    list.forEach((k, i) => {
      const x = this.figure.x + (i - (list.length - 1) / 2) * 18;
      const img = this.add.image(x, top, "item_" + k).setScale(0.6).setDepth(21).setAlpha(0);
      this.tweens.add({ targets: img, alpha: 1, y: top - 14, duration: 350, delay: i * 120, ease: "Back.easeOut" });
      this.tweens.add({ targets: img, alpha: 0, y: top - 30, duration: 500, delay: 1500 + i * 120, onComplete: () => img.destroy() });
    });
  }

  removeEntity(id) {
    const e = this.entities.get(id);
    if (!e) return;
    this.entities.delete(id);
    const fade = (delay) => this.tweens.add({
      targets: e.imgs, alpha: 0, duration: 500, delay,
      onComplete: () => e.imgs.forEach((i) => { this.tweens.killTweensOf(i); i.destroy(); }),
    });
    // Die Figur steht jetzt auf dem Feld: Truhe und Gegner rücken ein Stück vor sie
    const [dx, dy] = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] }[this.facing] || [0, 1];
    const ahead = (dist) => this.tweens.add({ targets: e.imgs, x: `+=${dx * dist}`, y: `+=${dy * dist}`, duration: 180 });
    if (e.kind === "chest" && this.textures.exists("item_chest_open")) {
      e.imgs[0].setTexture("item_chest_open");
      ahead(22);
      fade(2200);
    } else if (e.kind === "monster" && e.imgs.length > 1) {
      ahead(26);
      e.imgs[1].setFlipX(dx > 0);   // schaut zur Figur
      const fight = { e, dx, dy, fade };
      this.fight = fight;
      this.time.delayedCall(4000, () => { if (this.fight === fight) this.resolveFight(true); });   // falls kein Würfel kommt
    } else {
      fade(0);
    }
  }

  reveal(list, instant) {
    const shown = new Set();
    for (const [x, y] of list) {
      this.revealedSet.add(x + "," + y);
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
    for (const npc of (this.npcs || new Map()).values()) if (npc.bubble) npc.bubble.setVisible(false);
    this.sayText.setText((to ? "@" + to + " " : "") + text).setVisible(true).setAlpha(1);
    if (this.sayTimer) this.sayTimer.remove();
    const ms = Math.max(4500, Math.min(11000, text.length * 75));
    this.sayTimer = this.time.delayedCall(ms, () => {
      this.tweens.add({ targets: this.sayText, alpha: 0, duration: 400, onComplete: () => this.sayText.setVisible(false) });
    });
  }

  update(time) {
    if (!this.figure) return;
    const ts = 1 / this.cameras.main.zoom;   // Texte bleiben auf dem Bildschirm gleich groß
    this.sayText.setScale(ts);
    this.actText.setScale(ts);
    for (const npc of (this.npcs || new Map()).values()) {
      if (npc.bubble && npc.bubble.visible) {
        npc.bubble.setScale(ts).setPosition(npc.sprite.x, npc.sprite.y - 50 * npc.sprite.scaleY);
      }
    }
    if (this.ambient.visible) this.ambient.setPosition(this.figure.x, this.figure.y);
    if (this.dark && this.dark.visible) {
      // am Lagerfeuer flackert das Licht etwas
      const flicker = this.camping ? 1.15 + Math.sin(time / 90) * 0.03 + Math.sin(time / 37) * 0.02 : 1;
      this.dark.setPosition(this.figure.x, this.figure.y - 20).setDisplaySize(LIGHT_SIZE * flicker, LIGHT_SIZE * flicker);
    }
    let top = this.figure.y - (this.useSheet ? 50 : 18) * this.figure.scaleY;
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
      '<div class="vote-count">' + String(c).replace(".", ",") + "</div>";
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

// Chat-Kasten: im Test immer, sonst nur wenn in den Einstellungen eingeschaltet
function setChatVisible(show) {
  el("chat-lines").classList.toggle("hidden", !(show || TESTCHAT));
}

function handle(msg) {
  if (!scene && msg.type !== "chat" && msg.type !== "log") {
    pending.push(msg);
    return;
  }
  switch (msg.type) {
    case "state":
      if (lastDepth !== null && msg.depth > lastDepth) audio.play("stairs");
      lastDepth = msg.depth;
      audio.configure(msg.audio);
      setChatVisible(msg.chat_overlay);
      audio.loadTracks().then(() => audio.playMusic(scene.musicMood()));
      el("depth").textContent = "Ebene " + msg.depth + (msg.area ? " · " + msg.area.name : "");
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
      if (scene.entities.has(msg.id) && scene.entities.get(msg.id).kind === "chest") audio.play("chest");
      scene.removeEntity(msg.id);
      break;
    case "sound_test":
      audio.play("coins");
      audio.play("growl", 500);
      showLog(audio.enabled ? (scene.sound.locked ? "Testton: Der Browser blockiert den Ton, einmal ins Bild klicken." : "Testton gespielt.") : "Testton: Ton ist in den Einstellungen aus.");
      break;
    case "gift":
      audio.play("coins");
      if (msg.gift !== "Likes") audio.play("coins", 300);
      break;
    case "chat_overlay":
      setChatVisible(msg.show);
      break;
    case "audio":
      audio.configure(msg);
      break;
    case "npc_pos":
      scene.npcPos(msg);
      break;
    case "npc_say":
      scene.npcSay(msg);
      break;
    case "overview":
      scene.setOverview(msg.on);
      break;
    case "step":
      scene.step = msg.step;
      break;
    case "trap":
      audio.play("trap");
      audio.play("trapSnap", 250);
      scene.showTrap(msg.x, msg.y);
      break;
    case "loot":
      msg.items.slice(0, 4).forEach((it, i) => audio.play(it === "gold" ? "coins" : "bag", 300 + i * 220));
      scene.showLoot(msg.items);
      break;
    case "dice":
      showDice(msg);
      if (msg.label.startsWith("Kampf")) {
        scene.resolveFight(msg.success);
        audio.play("growl");
        audio.play("draw", 250);
        audio.play("hit", 650);
        if (msg.success) audio.play("pain", 900);
      }
      scene.action(msg.label.startsWith("Kampf") ? "slash" : "emote");
      break;
    case "anim":
      scene.action(msg.name);
      break;
    case "camp":
      if (msg.active && !scene.camping) audio.play("camp");
      if (msg.active && msg.text && msg.text.startsWith("kocht")) audio.play("cook");
      scene.setCamp(msg);
      audio.setQuiet(scene.camping || scene.night);
      break;
    case "say":
      scene.say(msg.text, msg.to);
      break;
    case "death":
      audio.play("death");
      audio.play("pain", 200);
      showDeath(msg);
      break;
    case "reveal":
      scene.reveal(msg.tiles, false);
      break;
    case "pos":
      audio.step();
      scene.moveFigure(msg.pos, msg.facing, false);
      break;
    case "vote_start":
      audio.play("voteStart");
      startVote(msg.options, msg.seconds, {}, msg.hints);
      break;
    case "vote_update":
      renderVote(currentOptions, msg.counts, null);
      if (typeof msg.remaining === "number") voteEndsAt = Date.now() + msg.remaining * 1000;
      break;
    case "vote_end":
      audio.play("voteEnd");
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
