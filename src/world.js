// Builds the 3D house in a Murakami x Sanrio inspired style: rooms, furniture, garden,
// lights, shop decor and the AI helper mascots.
import * as THREE from '../vendor/three.module.min.js';
import {
  toon, noOutline, roundedBox, facePlane, makeFlower, patternTexture, checkerTexture, woodTexture,
  RAINBOW, INK, FONT,
} from './style.js';

// Floor plan (meters). The camera looks from the garden side (+z) toward the back wall (-z).
export const ROOMS = {
  bedroom:  { name: 'Bedroom',     emoji: '🛏️', x0: -10, x1: -3, z0: -7, z1: 0 },
  bathroom: { name: 'Bathroom',    emoji: '🛁', x0: -3,  x1: 1,  z0: -7, z1: 0 },
  study:    { name: 'Study',       emoji: '📚', x0: 1,   x1: 10, z0: -7, z1: 0 },
  music:    { name: 'Music Room',  emoji: '🎵', x0: 10,  x1: 16, z0: -7, z1: 0 },
  kitchen:  { name: 'Kitchen',     emoji: '🍳', x0: -10, x1: -3, z0: 0,  z1: 7 },
  living:   { name: 'Living Room', emoji: '🛋️', x0: -3,  x1: 4,  z0: 0,  z1: 7 },
  gym:      { name: 'Home Gym',    emoji: '🏋️', x0: 4,   x1: 10, z0: 0,  z1: 7 },
  game:     { name: 'Game Room',   emoji: '🎮', x0: 10,  x1: 16, z0: 0,  z1: 7 },
  garden:   { name: 'Garden',      emoji: '🌸', x0: -14, x1: 20, z0: 7,  z1: 17, outdoor: true },
};

// Doorways. dir 'h' = in a wall running along x (at z), 'v' = in a wall running along z (at x).
export const DOORS = [
  { a: 'bedroom',  b: 'kitchen',  x: -6.5, z: 0,    dir: 'h' },
  { a: 'bedroom',  b: 'bathroom', x: -3,   z: -3.5, dir: 'v' },
  { a: 'bathroom', b: 'living',   x: -1,   z: 0,    dir: 'h' },
  { a: 'study',    b: 'living',   x: 2.5,  z: 0,    dir: 'h' },
  { a: 'study',    b: 'gym',      x: 7,    z: 0,    dir: 'h' },
  { a: 'study',    b: 'music',    x: 10,   z: -3.5, dir: 'v' },
  { a: 'music',    b: 'game',     x: 13,   z: 0,    dir: 'h' },
  { a: 'kitchen',  b: 'living',   x: -3,   z: 3.5,  dir: 'v' },
  { a: 'living',   b: 'gym',      x: 4,    z: 3.5,  dir: 'v' },
  { a: 'gym',      b: 'game',     x: 10,   z: 3.5,  dir: 'v' },
  { a: 'living',   b: 'garden',   x: 0.5,  z: 7,    dir: 'h' },
];

const WALL_H = 2.6, WALL_T = 0.16, DOOR_W = 1.4;

export const SHOP_ITEMS = [
  { id: 'plant',     name: 'Smiling flower pot', emoji: '🌼', price: 20,  room: 'Living Room' },
  { id: 'painting',  name: 'Rainbow painting',   emoji: '🖼️', price: 35,  room: 'Living Room' },
  { id: 'beanbag',   name: 'Squishy bean bag',   emoji: '🫘', price: 45,  room: 'Study' },
  { id: 'floorlamp', name: 'Cloud lamp',         emoji: '☁️', price: 50,  room: 'Living Room' },
  { id: 'guitar',    name: 'Pink guitar',        emoji: '🎸', price: 60,  room: 'Bedroom' },
  { id: 'lights',    name: 'Fairy lights',       emoji: '✨', price: 70,  room: 'Garden' },
  { id: 'aquarium',  name: 'Aquarium',           emoji: '🐠', price: 100, room: 'Living Room' },
  { id: 'console',   name: 'Game console',       emoji: '🎮', price: 120, room: 'Living Room' },
  { id: 'fountain',  name: 'Flower fountain',    emoji: '⛲', price: 150, room: 'Garden' },
  { id: 'cat',       name: 'A pet cat',          emoji: '🐈', price: 250, room: 'Living Room' },
];

// Where each helper floats.
const BOT_SPOTS = {
  luna: [-5.4, -2.3], mo: [-2.2, -1.2], owl: [3.0, -3.2], basil: [-6.0, 1.8],
  sunny: [-1.9, 1.6], rex: [5.4, 1.5], sage: [-2.6, 11.6], mochi: [11.3, -1.4],
};
const ROOM_OF_BOT = { luna: 'bedroom', mo: 'bathroom', owl: 'study', basil: 'kitchen', sunny: 'living', rex: 'gym', sage: 'garden', mochi: 'music' };

// ---------- primitive helpers ----------

function addMesh(parent, geo, material, x, y, z, shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
// y is the bottom of the box; boxes are softly rounded for the squishy look
export const box = (p, w, h, d, color, x = 0, y = 0, z = 0, o = {}) =>
  addMesh(p, roundedBox(w, h, d, o.round ?? 0.06), o.material ?? toon(color, o), x, y + h / 2, z, o.shadow !== false);
export const cyl = (p, rt, rb, h, color, x = 0, y = 0, z = 0, o = {}) =>
  addMesh(p, new THREE.CylinderGeometry(rt, rb, h, o.seg ?? 24), o.material ?? toon(color, o), x, y + h / 2, z, o.shadow !== false);
export const ball = (p, r, color, x = 0, y = 0, z = 0, o = {}) =>
  addMesh(p, new THREE.SphereGeometry(r, o.seg ?? 20, o.seg ? Math.round(o.seg * 0.75) : 14), o.material ?? toon(color, o), x, y, z, o.shadow !== false);

function group(parent, x = 0, z = 0, ry = 0, y = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  parent.add(g);
  return g;
}

function face(parent, size, x, y, z, opts, ry = 0) {
  const f = facePlane(size, opts);
  f.position.set(x, y, z);
  f.rotation.y = ry;
  parent.add(f);
  return f;
}

export function labelSprite(text, { bg = '#ffffff', fg = INK, border = INK, scale = 1 } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const font = `600 44px ${FONT}`;
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 56;
  c.width = w; c.height = 84;
  g.font = font;
  g.fillStyle = border;
  g.beginPath(); g.roundRect(2, 8, w - 4, 72, 36); g.fill();
  g.fillStyle = bg;
  g.beginPath(); g.roundRect(6, 4, w - 12, 70, 34); g.fill();
  g.fillStyle = fg;
  g.textBaseline = 'middle';
  g.fillText(text, 28, 41);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, fog: false }));
  s.scale.set((w / 84) * 0.34 * scale, 0.34 * scale, 1);
  s.renderOrder = 10;
  return s;
}

// ---------- world ----------

export function buildWorld(scene, bots) {
  const world = { interactables: [], bots: {}, decor: {}, lamps: [], cutWalls: [], animated: [], windowMats: [], bulbMats: [] };

  function interact(obj, def) {
    const item = { ...def, object: obj };
    obj.traverse(o => { o.userData.interact = item; });
    world.interactables.push(item);
    return item;
  }

  const flower = (x, z, opts = {}) => {
    const f = makeFlower(opts);
    f.group.position.set(x, opts.y ?? 0, z);
    if (opts.ry) f.group.rotation.y = opts.ry;
    scene.add(f.group);
    const phase = Math.random() * 6;
    world.animated.push(t => { f.head.rotation.z = Math.sin(t * 1.3 + phase) * 0.08; });
    return f;
  };

  // ----- ground -----
  const grass = patternTexture({ bg: '#8fdc6e', flowers: ['#a3e686', '#9ae27c'], dots: '#86d466', size: 26, rx: 30, ry: 30, faces: false });
  const ground = addMesh(scene, new THREE.PlaneGeometry(140, 140), toon('#ffffff', { map: grass, outline: false }), 3, 0, 0, false);
  ground.rotation.x = -Math.PI / 2;
  ground.userData.ground = true;

  // ----- floors -----
  const floors = {
    bedroom: woodTexture('#f6cfa8', 2.4, 2.4),
    bathroom: checkerTexture('#ffffff', '#ffc9df', 4, 7),
    study: woodTexture('#e9bf92', 3, 2.4),
    music: patternTexture({ bg: '#cdb8ff', flowers: ['#fff1a8', '#ffffff'], stars: true, size: 26, rx: 2, ry: 2.3 }),
    kitchen: checkerTexture('#ffffff', '#bff0de', 7, 7),
    living: woodTexture('#f3c99c', 2.4, 2.4),
    gym: patternTexture({ bg: '#c9c3ec', flowers: ['#b5aee0'], dots: '#b9b2e4', size: 30, rx: 2, ry: 2.3 }),
    game: checkerTexture('#fff1a8', '#ffc2dc', 6, 7),
  };
  for (const [id, r] of Object.entries(ROOMS)) {
    if (r.outdoor) continue;
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    const f = addMesh(scene, new THREE.PlaneGeometry(w, d), toon('#ffffff', { map: floors[id], outline: false }), (r.x0 + r.x1) / 2, 0.012, (r.z0 + r.z1) / 2, false);
    f.rotation.x = -Math.PI / 2;
    f.userData.ground = true;
  }
  box(scene, 26.4, 0.12, 14.4, '#ffe0ec', 3, -0.15, 0, { shadow: false, round: 0.05 });

  // ----- walls -----
  const wallMat = toon('#fff4f8');
  const extMat = toon('#ffe7a8');
  const lines = [
    { dir: 'h', at: -7, from: -10, to: 16, back: true },
    { dir: 'h', at: 0, from: -10, to: 16 },
    { dir: 'h', at: 7, from: -10, to: 16, ext: true },
    { dir: 'v', at: -10, from: -7, to: 7, ext: true },
    { dir: 'v', at: 16, from: -7, to: 7, ext: true },
    { dir: 'v', at: -3, from: -7, to: 7 },
    { dir: 'v', at: 1, from: -7, to: 0 },
    { dir: 'v', at: 4, from: 0, to: 7 },
    { dir: 'v', at: 10, from: -7, to: 7 },
  ];
  for (const L of lines) {
    const doorsHere = DOORS
      .filter(d => d.dir === L.dir && (L.dir === 'h' ? d.z === L.at : d.x === L.at))
      .map(d => (L.dir === 'h' ? d.x : d.z))
      .filter(p => p > L.from && p < L.to)
      .sort((a, b) => a - b);
    const segs = [];
    let cur = L.from;
    for (const p of doorsHere) {
      segs.push([cur, p - DOOR_W / 2]);
      cur = p + DOOR_W / 2;
      const lin = L.dir === 'h'
        ? box(scene, DOOR_W + 0.1, WALL_H - 2.15, WALL_T, null, p, 2.15, L.at, { material: L.ext ? extMat : wallMat, round: 0.04 })
        : box(scene, WALL_T, WALL_H - 2.15, DOOR_W + 0.1, null, L.at, 2.15, p, { material: wallMat, round: 0.04 });
      world.cutWalls.push({ mesh: lin, lintel: true });
    }
    segs.push([cur, L.to]);
    for (const [a, b] of segs) {
      const len = b - a + (a === L.from || b === L.to ? WALL_T : 0);
      const c = (a + b) / 2;
      const m = L.dir === 'h'
        ? box(scene, len, WALL_H, WALL_T, null, c, 0, L.at, { material: L.ext || L.back ? extMat : wallMat, round: 0.05 })
        : box(scene, WALL_T, WALL_H, len, null, L.at, 0, c, { material: L.ext ? extMat : wallMat, round: 0.05 });
      if (!L.back) world.cutWalls.push({ mesh: m });
    }
  }

  world.cutWalls.forEach(w => { w.mesh.userData.dynamic = true; });

  // wallpaper on the back wall, one pattern per room
  const papers = [
    [-10, -3, { bg: '#e8ddff', flowers: ['#ff9fc8', '#ffffff', '#ffd93d'] }],
    [-3, 1, { bg: '#d4f7ea', flowers: ['#ffffff', '#ffb3d1'] }],
    [1, 10, { bg: '#d6efff', flowers: ['#ffffff', '#ffd93d', '#ff9fc8'] }],
    [10, 16, { bg: '#ff9fcf', flowers: ['#fff1a8', '#ffffff'], stars: true }],
  ];
  for (const [a, b, pat] of papers) {
    const w = b - a - 0.18;
    const tex = patternTexture({ ...pat, size: 34, rx: w / 2.2, ry: 1.2 });
    addMesh(scene, new THREE.PlaneGeometry(w, WALL_H - 0.05), toon('#ffffff', { map: tex, outline: false }), (a + b) / 2, WALL_H / 2, -7 + WALL_T / 2 + 0.005, false);
    box(scene, w, 0.12, 0.04, '#ffffff', (a + b) / 2, 0, -6.9, { round: 0.02 });
  }

  // windows on the back wall
  for (const [x, w] of [[-6.2, 1.4], [-1, 0.8], [3.4, 1.4], [7.6, 1.4], [14.6, 0.9]]) {
    const glassMat = noOutline(new THREE.MeshBasicMaterial({ color: '#a9e4ff' }));
    world.windowMats.push(glassMat);
    box(scene, w + 0.18, 1.28, 0.08, '#ffffff', x, 1.02, -6.88, { round: 0.04 });
    addMesh(scene, new THREE.PlaneGeometry(w, 1.1), glassMat, x, 1.66, -6.835, false);
    box(scene, 0.05, 1.1, 0.03, '#ffffff', x, 1.1, -6.82, { shadow: false, round: 0.01 });
    box(scene, w + 0.36, 0.07, 0.2, '#ffffff', x, 1.0, -6.8, { round: 0.03 });
    for (const s of [-1, 1]) box(scene, 0.2, 1.3, 0.05, '#ffb3d1', x + s * (w / 2 + 0.12), 1.0, -6.78, { round: 0.03 });
  }

  // ----- room lamps (switch on at night) -----
  for (const [x, z] of [[-6.5, -3.5], [-1, -3.5], [5.5, -3.5], [13, -3.5], [-6.5, 3.5], [0.5, 3.5], [7, 3.5], [13, 3.5]]) {
    const light = new THREE.PointLight('#ffd9b0', 0, 11, 1.6);
    light.position.set(x, 2.35, z);
    scene.add(light);
    world.lamps.push(light);
  }

  // ===== BEDROOM =====
  {
    const bed = group(scene, -8.2, -5.4);
    box(bed, 1.8, 0.38, 2.25, '#ffb3d1', 0, 0, 0, { round: 0.12 });
    box(bed, 1.66, 0.24, 2.12, '#ffffff', 0, 0.34, 0, { round: 0.1 });
    box(bed, 1.72, 0.1, 1.4, null, 0, 0.53, 0.38, { round: 0.05, material: toon('#ffffff', { map: patternTexture({ bg: '#a98bff', flowers: ['#ffd93d', '#ffffff', '#ff9fc8'], size: 30, rx: 1.4, ry: 1 }) }) });
    box(bed, 0.62, 0.18, 0.4, '#fff1a8', -0.4, 0.55, -0.76, { round: 0.08 });
    box(bed, 0.62, 0.18, 0.4, '#bff0de', 0.4, 0.55, -0.76, { round: 0.08 });
    box(bed, 1.86, 1.15, 0.16, '#ff8fbf', 0, 0, -1.12, { round: 0.08 });
    ball(bed, 0.28, '#ffd93d', 0, 1.18, -1.12).scale.set(1, 1, 0.4);
    face(bed, 0.42, 0, 1.18, -1.0, { eyes: 'sleepy', mouth: 'smile' });
    interact(bed, { id: 'bed', name: 'Bed', emoji: '🛏️', room: 'bedroom', panel: 'bed',
      approach: [-6.9, -5.0], pose: 'lie', seat: { x: -8.2, y: 0.6, z: -4.5, ry: 0 } });

    const ns = group(scene, -9.5, -6.5);
    ns.userData.flatten = true;
    box(ns, 0.52, 0.56, 0.46, '#ffffff', 0, 0, 0, { round: 0.08 });
    cyl(ns, 0.06, 0.09, 0.16, '#ffd93d', 0, 0.56, 0);
    const shade = ball(ns, 0.18, '#fff1a8', 0, 0.86, 0, { emissive: '#ffe48a', ei: 0.35 });
    shade.scale.set(1, 0.85, 1);
    face(ns, 0.2, 0, 0.86, 0.17, { eyes: 'happy', mouth: 'smile' });

    const desk = group(scene, -4.3, -6.5);
    box(desk, 1.45, 0.08, 0.7, '#ffffff', 0, 0.7, 0, { round: 0.03 });
    for (const [lx, lz] of [[-0.64, -0.28], [0.64, -0.28], [-0.64, 0.28], [0.64, 0.28]]) cyl(desk, 0.035, 0.035, 0.7, '#ff9fc8', lx, 0, lz);
    box(desk, 0.38, 0.05, 0.28, '#ff5fa2', -0.1, 0.78, 0.08, { round: 0.02 });
    box(desk, 0.35, 0.02, 0.25, '#fffaf0', -0.1, 0.83, 0.08, { round: 0.005, shadow: false });
    cyl(desk, 0.07, 0.06, 0.12, '#a98bff', 0.55, 0.78, -0.15);
    flower(-3.75, -6.65, { size: 0.26, stem: 1.0, y: 0.84 });
    const chair = group(scene, -4.3, -5.8);
    chair.userData.flatten = true;
    box(chair, 0.5, 0.08, 0.48, '#a98bff', 0, 0.42, 0, { round: 0.04 });
    box(chair, 0.5, 0.55, 0.08, '#a98bff', 0, 0.46, 0.21, { round: 0.04 });
    for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) cyl(chair, 0.03, 0.03, 0.42, '#ffffff', lx, 0, lz);
    interact(desk, { id: 'journal', name: 'Journal desk', emoji: '📓', room: 'bedroom', panel: 'journal',
      approach: [-4.3, -5.15], pose: 'sit', seat: { x: -4.3, y: 0.47, z: -5.75, ry: Math.PI } });

    const wr = group(scene, -9.6, -1.7, Math.PI / 2);
    box(wr, 1.35, 2.05, 0.62, '#bfe8ff', 0, 0, 0, { round: 0.1 });
    box(wr, 0.02, 1.85, 0.02, INK, 0, 0.1, 0.31, { round: 0.005 });
    ball(wr, 0.045, '#ffd93d', -0.09, 1.05, 0.32);
    ball(wr, 0.045, '#ffd93d', 0.09, 1.05, 0.32);
    face(wr, 0.5, 0, 1.6, 0.32, { eyes: 'oval', mouth: 'smile' });
    interact(wr, { id: 'wardrobe', name: 'Wardrobe', emoji: '👕', room: 'bedroom', panel: 'wardrobe',
      approach: [-8.65, -1.7], face: [-9.6, -1.7] });

    const rug = addMesh(scene, new THREE.CircleGeometry(1.2, 40), toon('#ffffff', { outline: false, map: patternTexture({ bg: '#ffc2dc', flowers: RAINBOW, size: 30 }) }), -6.6, 0.02, -3, false);
    rug.rotation.x = -Math.PI / 2;
  }

  // ===== BATHROOM =====
  {
    const sh = group(scene, 0.25, -6.25);
    box(sh, 1.3, 0.1, 1.3, '#ffffff', 0, 0, 0, { round: 0.04 });
    box(sh, 0.04, 2.0, 1.3, '#bfe8ff', -0.65, 0.1, 0, { opacity: 0.3, round: 0.01 });
    box(sh, 0.62, 2.0, 0.04, '#bfe8ff', -0.32, 0.1, 0.65, { opacity: 0.3, round: 0.01 });
    cyl(sh, 0.025, 0.025, 0.4, '#d9d9e8', 0, 1.95, -0.55).rotation.x = Math.PI / 2;
    cyl(sh, 0.13, 0.09, 0.06, '#ffd93d', 0, 2.05, -0.38);
    interact(sh, { id: 'shower', name: 'Shower', emoji: '🚿', room: 'bathroom', panel: 'shower',
      approach: [-0.2, -5.0], pose: 'stand', seat: { x: 0.3, y: 0.1, z: -6.2, ry: 0 } });

    const v = group(scene, -1.6, -6.66);
    box(v, 1.2, 0.8, 0.52, '#6fdcb9', 0, 0, 0, { round: 0.08 });
    box(v, 1.26, 0.08, 0.56, '#ffffff', 0, 0.8, 0, { round: 0.03 });
    cyl(v, 0.2, 0.15, 0.06, '#e8f6ff', 0, 0.86, 0.02, { shadow: false });
    cyl(v, 0.02, 0.02, 0.2, '#d9d9e8', 0, 0.86, -0.18);
    ball(v, 0.46, '#ffb3d1', 0, 1.55, -0.23).scale.set(1, 1.15, 0.06);
    ball(v, 0.42, '#d6f2ff', 0, 1.55, -0.2, { emissive: '#bfe8ff', ei: 0.25 }).scale.set(1, 1.15, 0.08);
    face(v, 0.3, 0, 1.6, -0.16, { eyes: 'happy', mouth: 'smile' });
    interact(v, { id: 'mirror', name: 'Mirror & sink', emoji: '🪞', room: 'bathroom', panel: 'mirror',
      approach: [-1.6, -5.9], face: [-1.6, -6.7] });

    const t = group(scene, 0.55, -2.2, -Math.PI / 2);
    cyl(t, 0.21, 0.17, 0.4, '#ffffff');
    cyl(t, 0.25, 0.25, 0.05, '#ffc2dc', 0, 0.4, 0);
    box(t, 0.5, 0.45, 0.22, '#ffffff', 0, 0.4, -0.28, { round: 0.06 });
    face(t, 0.22, 0, 0.66, -0.165, { eyes: 'oval', mouth: 'o' });
    interact(t, { id: 'toilet', name: 'Toilet', emoji: '🚽', room: 'bathroom', panel: 'toilet',
      approach: [-0.3, -2.2], face: [0.55, -2.2] });

    const mat = addMesh(scene, new THREE.CircleGeometry(0.42, 30), toon('#ffb3d1', { outline: false }), -1.6, 0.02, -5.8, false);
    mat.rotation.x = -Math.PI / 2;
    mat.scale.x = 1.4;
    box(scene, 0.06, 0.65, 0.5, '#ffd93d', -2.88, 0.6, -5.2, { round: 0.03 });
  }

  // ===== STUDY =====
  {
    const d = group(scene, 5, -6.48);
    box(d, 1.9, 0.08, 0.78, '#ffffff', 0, 0.7, 0, { round: 0.03 });
    box(d, 0.08, 0.7, 0.72, '#4fc3ff', -0.86, 0, 0, { round: 0.03 });
    box(d, 0.08, 0.7, 0.72, '#4fc3ff', 0.86, 0, 0, { round: 0.03 });
    box(d, 0.06, 0.26, 0.06, '#ffffff', 0, 0.78, -0.22);
    box(d, 0.98, 0.6, 0.06, '#ffffff', 0, 0.98, -0.22, { round: 0.04 });
    const screenMat = noOutline(new THREE.MeshBasicMaterial({ color: '#7fd4ff' }));
    addMesh(d, new THREE.PlaneGeometry(0.86, 0.48), screenMat, 0, 1.28, -0.185, false);
    world.monitorMat = screenMat;
    face(d, 0.34, 0, 1.28, -0.18, { eyes: 'oval', mouth: 'smile', ink: '#ffffff' });
    box(d, 0.52, 0.03, 0.17, '#ffffff', 0, 0.78, 0.12, { round: 0.01 });
    cyl(d, 0.05, 0.07, 0.04, '#ff5fa2', -0.72, 0.78, -0.2);
    cyl(d, 0.015, 0.015, 0.42, '#ff5fa2', -0.72, 0.8, -0.2);
    ball(d, 0.1, '#fff1a8', -0.72, 1.24, -0.16, { emissive: '#ffe48a', ei: 0.3 });
    const ch = group(scene, 5, -5.75);
    ch.userData.flatten = true;
    cyl(ch, 0.27, 0.27, 0.1, '#ff5fa2', 0, 0.4, 0);
    box(ch, 0.5, 0.6, 0.1, '#ff5fa2', 0, 0.48, 0.24, { round: 0.05 });
    cyl(ch, 0.03, 0.03, 0.4, '#ffffff', 0, 0, 0);
    cyl(ch, 0.25, 0.25, 0.03, '#ffffff', 0, 0, 0);
    interact(d, { id: 'computer', name: 'Study desk', emoji: '💻', room: 'study', panel: 'focus',
      approach: [5, -5.1], pose: 'sit', seat: { x: 5, y: 0.5, z: -5.75, ry: Math.PI } });

    const bs = group(scene, 8.9, -6.66);
    box(bs, 1.6, 2.1, 0.42, '#ffffff', 0, 0, 0, { round: 0.06 });
    const colors = ['#ff5fa2', '#ffd93d', '#4fc3ff', '#6fdcb9', '#a98bff', '#ff9f43'];
    for (let s = 0; s < 4; s++) {
      box(bs, 1.48, 0.04, 0.38, '#ffc2dc', 0, 0.15 + s * 0.48, 0.02, { round: 0.01 });
      let x = -0.68;
      while (x < 0.62) {
        const w = 0.07 + Math.random() * 0.05, h = 0.26 + Math.random() * 0.12;
        box(bs, w, h, 0.26, colors[Math.floor(Math.random() * colors.length)], x + w / 2, 0.19 + s * 0.48, 0.05, { round: 0.015, shadow: false });
        x += w + 0.015;
      }
    }
    interact(bs, { id: 'bookshelf', name: 'Bookshelf (flashcards)', emoji: '📚', room: 'study', panel: 'flashcards',
      approach: [8.9, -5.8], face: [8.9, -6.7] });

    const wb = group(scene, 2.6, -6.86);
    box(wb, 1.7, 1.05, 0.05, '#ffd93d', 0, 0.95, 0, { round: 0.03 });
    box(wb, 1.58, 0.94, 0.02, '#ffffff', 0, 1.005, 0.03, { round: 0.01, shadow: false });
    for (let i = 0; i < 5; i++) box(wb, 0.2 + Math.random() * 0.6, 0.025, 0.01, ['#4fc3ff', '#ff5fa2', '#6fdcb9'][i % 3], -0.35 + Math.random() * 0.4, 1.2 + i * 0.12 - 0.25, 0.045, { shadow: false, round: 0.005 });
    interact(wb, { id: 'whiteboard', name: 'Skills whiteboard', emoji: '🧠', room: 'study', panel: 'skills',
      approach: [2.6, -6.0], face: [2.6, -6.9] });

    const rug = addMesh(scene, new THREE.PlaneGeometry(2.4, 1.6), toon('#ffffff', { outline: false, map: patternTexture({ bg: '#bfe8ff', flowers: ['#ffffff', '#ffd93d'], size: 30, rx: 1.5, ry: 1 }) }), 5, 0.02, -3.2, false);
    rug.rotation.x = -Math.PI / 2;
    cyl(scene, 0.22, 0.17, 0.42, '#ff9fc8', 9.4, 0, -0.55);
    flower(9.4, -0.55, { size: 0.42, stem: 1.1, y: 0.35 });
  }

  // ===== MUSIC ROOM =====
  {
    const tt = group(scene, 13, -6.5);
    box(tt, 1.6, 0.8, 0.62, '#ff5fa2', 0, 0, 0, { round: 0.08 });
    box(tt, 0.7, 0.1, 0.5, '#ffffff', 0, 0.8, 0, { round: 0.03 });
    const platter = group(tt, -0.08, 0, 0, 0.92);
    cyl(platter, 0.21, 0.21, 0.03, '#2b2233', 0, 0, 0, { seg: 32 });
    cyl(platter, 0.07, 0.07, 0.035, '#ffd93d', 0, 0, 0);
    world.animated.push((t, dt) => { if (world.musicPlaying) platter.rotation.y -= dt * 3.5; });
    cyl(tt, 0.012, 0.012, 0.3, '#d9d9e8', 0.22, 0.95, 0).rotation.x = Math.PI / 2.4;
    for (const s of [-1, 1]) {
      const sp = group(scene, 13 + s * 1.55, -6.55);
      box(sp, 0.55, 1.15, 0.5, '#a98bff', 0, 0, 0, { round: 0.1 });
      cyl(sp, 0.16, 0.16, 0.04, '#2b2233', 0, 0.42, 0.25).rotation.x = Math.PI / 2;
      face(sp, 0.26, 0, 0.88, 0.255, { eyes: 'happy', mouth: 'open' });
      world.animated.push(t => { const k = world.musicPlaying ? 1 + Math.max(0, Math.sin(t * 8.4)) * 0.05 : 1; sp.scale.set(k, k, k); });
    }
    interact(tt, { id: 'turntable', name: 'Turntable', emoji: '💿', room: 'music', panel: 'music',
      approach: [13, -5.6], face: [13, -6.5] });

    const frame = group(scene, 13, -6.88);
    box(frame, 0.9, 0.9, 0.05, '#ffffff', 0, 1.45, 0, { round: 0.03 });
    const art = addMesh(frame, new THREE.PlaneGeometry(0.78, 0.78), toon('#ffffff', { outline: false, map: patternTexture({ bg: '#ffd93d', flowers: ['#ff5fa2'], size: 70 }) }), 0, 1.9, 0.03, false);
    world.nowPlayingMat = art.material;

    const shelf = group(scene, 15.62, -3.4, -Math.PI / 2);
    box(shelf, 1.8, 1.7, 0.42, '#ffffff', 0, 0, 0, { round: 0.06 });
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      const sleeve = box(shelf, 0.36, 0.36, 0.02, RAINBOW[(r * 4 + c) % RAINBOW.length], -0.6 + c * 0.4, 0.12 + r * 0.52, 0.2, { round: 0.01, shadow: false });
      sleeve.rotation.x = -0.08;
    }
    interact(shelf, { id: 'vinyls', name: 'Vinyl shelf', emoji: '📀', room: 'music', panel: 'music',
      approach: [14.7, -3.4], face: [15.6, -3.4] });

    const chair = group(scene, 11.6, -3.9, Math.PI / 2);
    box(chair, 1.0, 0.45, 0.9, '#ffd93d', 0, 0, 0, { round: 0.18 });
    box(chair, 1.0, 0.6, 0.25, '#ffd93d', 0, 0.35, -0.34, { round: 0.12 });
    box(chair, 0.22, 0.35, 0.9, '#ffe48a', -0.45, 0.35, 0, { round: 0.1 });
    box(chair, 0.22, 0.35, 0.9, '#ffe48a', 0.45, 0.35, 0, { round: 0.1 });
    interact(chair, { id: 'armchair', name: 'Listening chair', emoji: '🎧', room: 'music', panel: 'music',
      approach: [12.55, -3.9], pose: 'sit', seat: { x: 11.65, y: 0.5, z: -3.9, ry: Math.PI / 2 } });

    const rug = addMesh(scene, new THREE.CircleGeometry(1.3, 40), toon('#ffffff', { outline: false, map: patternTexture({ bg: '#3b2a5f', flowers: ['#fff1a8', '#ff9fc8', '#bfe8ff'], stars: true, size: 26 }) }), 13, 0.02, -3.6, false);
    rug.rotation.x = -Math.PI / 2;
    const disco = ball(scene, 0.22, '#e8e8f8', 13, 2.25, -3.6, { seg: 10, emissive: '#ffffff', ei: 0.2 });
    disco.userData.dynamic = true;
    world.animated.push((t, dt) => { disco.rotation.y += dt * (world.musicPlaying ? 1.5 : 0.3); });
    cyl(scene, 0.008, 0.008, 0.3, INK, 13, 2.45, -3.6);
  }

  // ===== KITCHEN =====
  {
    const fr = group(scene, -9.5, 0.8, Math.PI / 2);
    box(fr, 0.88, 1.95, 0.76, '#bfe8ff', 0, 0, 0, { round: 0.14 });
    box(fr, 0.9, 0.03, 0.78, INK, 0, 1.28, 0, { round: 0.01, shadow: false });
    box(fr, 0.05, 0.36, 0.06, '#ffffff', 0.32, 1.42, 0.39, { round: 0.02 });
    box(fr, 0.05, 0.5, 0.06, '#ffffff', 0.32, 0.6, 0.39, { round: 0.02 });
    face(fr, 0.55, -0.05, 0.85, 0.385, { eyes: 'oval', mouth: 'open' });
    ball(fr, 0.06, '#ff5fa2', -0.2, 1.6, 0.39);
    ball(fr, 0.06, '#ffd93d', 0.0, 1.66, 0.39);
    interact(fr, { id: 'fridge', name: 'Fridge', emoji: '🧊', room: 'kitchen', panel: 'fridge',
      approach: [-8.5, 0.9], face: [-9.6, 0.9] });

    box(scene, 0.72, 0.88, 3.4, '#6fdcb9', -9.62, 0, 3.6, { round: 0.06 });
    box(scene, 0.78, 0.07, 3.46, '#ffffff', -9.6, 0.88, 3.6, { round: 0.03 });
    box(scene, 0.42, 0.7, 3.4, '#cdf6e8', -9.78, 1.55, 3.6, { round: 0.06 });
    const sink = group(scene, -9.55, 2.8);
    cyl(sink, 0.24, 0.2, 0.03, '#e8f6ff', 0, 0.94, 0, { shadow: false });
    cyl(sink, 0.025, 0.025, 0.3, '#d9d9e8', -0.25, 0.95, 0);
    box(sink, 0.2, 0.03, 0.04, '#d9d9e8', -0.17, 1.22, 0, { round: 0.01 });
    interact(sink, { id: 'sink', name: 'Kitchen sink (water)', emoji: '🚰', room: 'kitchen', panel: 'water',
      approach: [-8.55, 2.8], face: [-9.6, 2.8] });
    const st = group(scene, -9.55, 4.5);
    box(st, 0.62, 0.03, 0.64, '#ffffff', 0, 0.94, 0, { round: 0.01 });
    for (const [bx, bz] of [[-0.14, -0.15], [-0.14, 0.15], [0.14, -0.15], [0.14, 0.15]]) cyl(st, 0.09, 0.09, 0.012, '#ff9fc8', bx, 0.96, bz, { shadow: false });
    const pot = group(st, 0.14, -0.15, 0, 0.97);
    cyl(pot, 0.15, 0.15, 0.14, '#ff5fa2');
    face(pot, 0.16, 0.152, 0.08, 0, { eyes: 'happy', mouth: 'smile' }, Math.PI / 2);
    world.animated.push(t => { pot.position.y = 0.97 + Math.max(0, Math.sin(t * 6)) * 0.008; });
    interact(st, { id: 'stove', name: 'Stove (cook)', emoji: '🍳', room: 'kitchen', panel: 'stove',
      approach: [-8.55, 4.5], face: [-9.6, 4.5] });

    const tb = group(scene, -5.6, 4.3);
    tb.userData.flatten = true;
    cyl(tb, 0.78, 0.78, 0.07, '#ffffff', 0, 0.7, 0, { seg: 32 });
    cyl(tb, 0.07, 0.3, 0.7, '#ff9fc8', 0, 0, 0);
    cyl(tb, 0.17, 0.11, 0.07, '#ffd93d', 0, 0.77, 0);
    ball(tb, 0.055, '#ff6b6b', -0.04, 0.87, 0.02);
    ball(tb, 0.055, '#ff9f43', 0.05, 0.87, -0.03);
    ball(tb, 0.055, '#7be36b', 0.02, 0.88, 0.06);
    for (const a of [0, Math.PI]) {
      const c = group(scene, -5.6 + Math.cos(a) * 1.05, 4.3, -a + Math.PI / 2);
      c.userData.flatten = true;
      box(c, 0.46, 0.08, 0.46, '#6fdcb9', 0, 0.42, 0, { round: 0.04 });
      box(c, 0.46, 0.5, 0.08, '#6fdcb9', 0, 0.46, -0.2, { round: 0.04 });
      for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) cyl(c, 0.03, 0.03, 0.42, '#ffffff', lx, 0, lz);
    }
  }

  // ===== LIVING ROOM =====
  {
    const tv = group(scene, 0.75, 0.34);
    box(tv, 1.8, 0.5, 0.46, '#ffffff', 0, 0, 0, { round: 0.08 });
    box(tv, 1.5, 0.88, 0.07, '#2b2233', 0, 0.6, -0.08, { round: 0.05 });
    const tvMat = noOutline(new THREE.MeshBasicMaterial({ color: '#3a3346' }));
    addMesh(tv, new THREE.PlaneGeometry(1.4, 0.78), tvMat, 0, 1.04, -0.04, false);
    world.tvMat = tvMat;

    const sofa = group(scene, 0.75, 3.45, Math.PI);
    box(sofa, 2.35, 0.44, 1.0, '#ff8fbf', 0, 0, 0, { round: 0.18 });
    box(sofa, 2.35, 0.6, 0.28, '#ff7ab3', 0, 0.38, -0.38, { round: 0.14 });
    box(sofa, 0.3, 0.36, 1.0, '#ff7ab3', -1.06, 0.38, 0, { round: 0.14 });
    box(sofa, 0.3, 0.36, 1.0, '#ff7ab3', 1.06, 0.38, 0, { round: 0.14 });
    box(sofa, 0.92, 0.14, 0.72, '#ffb3d1', -0.46, 0.42, 0.08, { round: 0.07 });
    box(sofa, 0.92, 0.14, 0.72, '#ffb3d1', 0.46, 0.42, 0.08, { round: 0.07 });
    const pillow = group(sofa, -0.72, -0.2, 0, 0.52);
    box(pillow, 0.4, 0.36, 0.14, '#ffd93d', 0, 0, 0, { round: 0.07 });
    face(pillow, 0.24, 0, 0.19, 0.075, { eyes: 'happy', mouth: 'smile' });
    pillow.rotation.z = 0.2;
    interact(sofa, { id: 'tv', name: 'Sofa & TV (fun)', emoji: '📺', room: 'living', panel: 'tv',
      approach: [0.75, 2.5], pose: 'sit', seat: { x: 0.75, y: 0.52, z: 3.42, ry: Math.PI } });

    const ct = group(scene, 0.75, 1.85);
    ct.userData.flatten = true;
    box(ct, 1.05, 0.08, 0.6, '#ffffff', 0, 0.36, 0, { round: 0.04 });
    for (const [lx, lz] of [[-0.45, -0.22], [0.45, -0.22], [-0.45, 0.22], [0.45, 0.22]]) cyl(ct, 0.03, 0.03, 0.36, '#ffd93d', lx, 0, lz);
    const rug = addMesh(scene, new THREE.CircleGeometry(1.6, 48), toon('#ffffff', { outline: false, map: patternTexture({ bg: '#fff1a8', flowers: RAINBOW, size: 30 }) }), 0.75, 0.02, 2.6, false);
    rug.rotation.x = -Math.PI / 2;
    rug.scale.x = 1.25;

    const hb = group(scene, -2.9, 5.5, Math.PI / 2);
    box(hb, 1.45, 1.0, 0.05, '#ffffff', 0, 0.82, 0, { round: 0.04 });
    box(hb, 1.33, 0.88, 0.02, '#ffe0cf', 0, 0.88, 0.03, { round: 0.01, shadow: false });
    const notes = ['#ffd93d', '#ff9fc8', '#9be37a', '#7fd4ff'];
    for (let i = 0; i < 6; i++) box(hb, 0.22, 0.22, 0.012, notes[i % 4], -0.45 + (i % 3) * 0.45, 1.06 - Math.floor(i / 3) * 0.36, 0.045, { shadow: false, round: 0.01 });
    interact(hb, { id: 'habits', name: 'Habit board', emoji: '✅', room: 'living', panel: 'habits',
      approach: [-2.05, 5.5], face: [-2.9, 5.5] });

    const sideT = group(scene, 3.45, 6.4);
    cyl(sideT, 0.3, 0.3, 0.05, '#ffffff', 0, 0.58, 0);
    cyl(sideT, 0.05, 0.16, 0.58, '#ff9fc8', 0, 0, 0);
    box(sideT, 0.1, 0.02, 0.18, '#ff5fa2', 0, 0.64, 0, { round: 0.008 });
    interact(sideT, { id: 'phone', name: 'Phone (call a friend)', emoji: '📱', room: 'living', panel: 'phone',
      approach: [2.75, 5.95], face: [3.45, 6.4] });

    const tr = group(scene, 3.72, 1.2, -Math.PI / 2);
    box(tr, 1.2, 1.7, 0.42, '#ffffff', 0, 0, 0, { round: 0.06 });
    for (let s = 0; s < 3; s++) box(tr, 1.08, 0.04, 0.38, '#bfe8ff', 0, 0.35 + s * 0.48, 0.02, { round: 0.01 });
    for (let i = 0; i < 3; i++) {
      cyl(tr, 0.05, 0.08, 0.06, '#ffd93d', -0.35 + i * 0.35, 1.31, 0);
      cyl(tr, 0.1, 0.05, 0.15, '#ffd93d', -0.35 + i * 0.35, 1.37, 0, { emissive: '#ffd93d', ei: 0.15 });
    }
    ball(tr, 0.11, '#ff5fa2', 0, 0.96, 0);
    interact(tr, { id: 'trophies', name: 'Trophy shelf (progress)', emoji: '🏆', room: 'living', panel: 'progress',
      approach: [2.85, 1.2], face: [3.8, 1.2] });
  }

  // ===== GYM =====
  {
    const tm = group(scene, 8.6, 1.55);
    box(tm, 0.88, 0.2, 1.9, '#a98bff', 0, 0, 0, { round: 0.08 });
    box(tm, 0.64, 0.03, 1.7, '#2b2233', 0, 0.2, 0.05, { shadow: false, round: 0.01 });
    cyl(tm, 0.035, 0.035, 1.1, '#ffffff', -0.39, 0.2, -0.85);
    cyl(tm, 0.035, 0.035, 1.1, '#ffffff', 0.39, 0.2, -0.85);
    box(tm, 0.88, 0.28, 0.14, '#a98bff', 0, 1.25, -0.85, { round: 0.06 });
    face(tm, 0.24, 0, 1.39, -0.775, { eyes: 'happy', mouth: 'open' });
    interact(tm, { id: 'treadmill', name: 'Treadmill', emoji: '🏃', room: 'gym', panel: 'workout:Run',
      approach: [8.6, 2.95], pose: 'run', seat: { x: 8.6, y: 0.23, z: 1.75, ry: Math.PI } });

    const wr = group(scene, 9.55, 5.9, -Math.PI / 2);
    box(wr, 1.4, 0.06, 0.42, '#ffffff', 0, 0.45, 0, { round: 0.02 });
    box(wr, 1.4, 0.06, 0.42, '#ffffff', 0, 0.85, 0, { round: 0.02 });
    for (const lx of [-0.66, 0.66]) box(wr, 0.06, 0.95, 0.42, '#ff5fa2', lx, 0, 0, { round: 0.02 });
    for (let i = 0; i < 4; i++) for (const y of [0.56, 0.96]) {
      const db = group(wr, -0.45 + i * 0.3, 0, 0, y);
      cyl(db, 0.015, 0.015, 0.25, '#d9d9e8', 0, -0.125, 0).rotation.z = Math.PI / 2;
      ball(db, 0.055, RAINBOW[i], -0.12, 0, 0);
      ball(db, 0.055, RAINBOW[i], 0.12, 0, 0);
    }
    interact(wr, { id: 'weights', name: 'Weights', emoji: '🏋️', room: 'gym', panel: 'workout:Strength',
      approach: [8.7, 5.9], face: [9.6, 5.9] });

    const ym = group(scene, 6.4, 5.6);
    box(ym, 0.72, 0.03, 1.8, '#ff9fc8', 0, 0.01, 0, { shadow: false, round: 0.01 });
    interact(ym, { id: 'yoga', name: 'Yoga mat', emoji: '🧘', room: 'gym', panel: 'workout:Yoga / stretching',
      approach: [6.4, 4.4], pose: 'stand', seat: { x: 6.4, y: 0.04, z: 5.6, ry: 0 } });

    const gbg = group(scene, 5.0, 6.3);
    const gb = ball(gbg, 0.34, '#6fdcb9', 0, 0.34, 0);
    face(gbg, 0.3, 0, 0.36, 0.345, { eyes: 'oval', mouth: 'smile' });
    world.animated.push(t => { gbg.scale.y = 1 + Math.sin(t * 2) * 0.02; });
    cyl(scene, 0.06, 0.06, 0.26, '#4fc3ff', 6.4, 0, 6.7);
    void gb;
  }

  // ===== GAME ROOM =====
  {
    for (const [z, col] of [[1.9, '#ff5fa2'], [3.3, '#4fc3ff']]) {
      const ac = group(scene, 15.5, z, -Math.PI / 2);
      box(ac, 0.85, 1.7, 0.72, col, 0, 0, 0, { round: 0.1 });
      box(ac, 0.78, 0.12, 0.3, '#ffffff', 0, 0.95, 0.38, { round: 0.04 });
      const scr = noOutline(new THREE.MeshBasicMaterial({ color: '#fff1a8' }));
      const s = addMesh(ac, new THREE.PlaneGeometry(0.62, 0.48), scr, 0, 1.35, 0.365, false);
      s.rotation.x = -0.12;
      const f = face(ac, 0.36, 0, 1.36, 0.375, { eyes: 'happy', mouth: 'open' });
      f.rotation.x = -0.12;
      ball(ac, 0.04, '#ffd93d', -0.15, 1.08, 0.48);
      ball(ac, 0.035, '#ff6b6b', 0.1, 1.08, 0.5);
      ball(ac, 0.035, '#7be36b', 0.2, 1.08, 0.48);
      box(ac, 0.88, 0.14, 0.76, '#ffffff', 0, 1.7, 0, { round: 0.06 });
      world.animated.push(t => scr.color.setHSL((t * 0.05 + z) % 1, 0.8, 0.85));
      interact(ac, { id: 'arcade' + z, name: 'Arcade games', emoji: '🕹️', room: 'game', panel: 'arcade',
        approach: [14.6, z], face: [15.5, z] });
    }

    const cm = group(scene, 15.25, 5.95, -Math.PI / 2);
    box(cm, 0.95, 0.8, 0.95, '#ffd93d', 0, 0, 0, { round: 0.1 });
    box(cm, 0.9, 0.9, 0.9, '#bfe8ff', 0, 0.8, 0, { opacity: 0.3, round: 0.03 });
    box(cm, 0.98, 0.18, 0.98, '#ff5fa2', 0, 1.7, 0, { round: 0.08 });
    for (let i = 0; i < 6; i++) {
      const col = ['#ff9fc8', '#fff1a8', '#cdb8ff', '#bff0de'][i % 4];
      const pl = group(cm, -0.25 + (i % 3) * 0.25, -0.15 + Math.floor(i / 3) * 0.25, 0, 0.92 + Math.floor(i / 3) * 0.12);
      ball(pl, 0.1, col, 0, 0, 0);
      ball(pl, 0.035, col, -0.06, 0.08, 0);
      ball(pl, 0.035, col, 0.06, 0.08, 0);
    }
    const claw = group(cm, 0, 0, 0, 1.55);
    cyl(claw, 0.01, 0.01, 0.15, '#d9d9e8', 0, -0.1, 0);
    for (let i = 0; i < 3; i++) {
      const prong = cyl(claw, 0.012, 0.008, 0.1, '#d9d9e8', Math.cos(i * 2.1) * 0.04, -0.2, Math.sin(i * 2.1) * 0.04);
      prong.rotation.z = Math.cos(i * 2.1) * 0.5;
    }
    world.animated.push(t => { claw.position.x = Math.sin(t * 0.6) * 0.25; claw.position.z = Math.cos(t * 0.4) * 0.2; });
    face(cm, 0.32, 0, 0.42, 0.48, { eyes: 'oval', mouth: 'open' });
    interact(cm, { id: 'claw', name: 'Claw machine', emoji: '🧸', room: 'game', panel: 'claw',
      approach: [14.35, 5.95], face: [15.25, 5.95] });

    for (const [x, z, col] of [[11.6, 5.6, '#a98bff'], [12.9, 6.1, '#6fdcb9']]) ball(scene, 0.5, col, x, 0.3, z).scale.set(1, 0.6, 1);
    box(scene, 1.4, 0.4, 1.4, '#ffffff', 11.0, 0, 1.0, { round: 0.12 });
    for (let i = 0; i < 26; i++) ball(scene, 0.09, RAINBOW[i % RAINBOW.length], 10.5 + Math.random(), 0.42, 0.5 + Math.random(), { seg: 8, shadow: false });
    const rug = addMesh(scene, new THREE.CircleGeometry(1.2, 40), toon('#ffffff', { outline: false, map: patternTexture({ bg: '#a98bff', flowers: ['#ffd93d', '#ff9fc8', '#ffffff'], stars: true, size: 28 }) }), 13, 0.02, 3.6, false);
    rug.rotation.x = -Math.PI / 2;
  }

  // ===== GARDEN =====
  {
    for (let z = 7.5; z < 16.6; z += 0.75) {
      cyl(scene, 0.3, 0.32, 0.05, ['#ffe0ec', '#fff1a8', '#d6efff'][Math.round(z / 0.75) % 3], 0.5 + (Math.random() - 0.5) * 0.15, 0, z, { seg: 18 });
    }
    const bench = group(scene, -5, 11.2);
    box(bench, 1.7, 0.1, 0.5, '#ff9fc8', 0, 0.4, 0, { round: 0.04 });
    box(bench, 1.7, 0.45, 0.08, '#ff9fc8', 0, 0.55, -0.24, { round: 0.04 });
    for (const lx of [-0.7, 0.7]) box(bench, 0.08, 0.42, 0.45, '#ffffff', lx, 0, 0, { round: 0.03 });
    interact(bench, { id: 'bench', name: 'Feelings bench', emoji: '💗', room: 'garden', panel: 'feelings',
      approach: [-5, 12.0], pose: 'sit', seat: { x: -5, y: 0.5, z: 11.15, ry: 0 } });

    const pond = group(scene, 5, 12.6);
    const water = cyl(pond, 1.6, 1.6, 0.04, '#7fd4ff', 0, 0.01, 0, { seg: 40, shadow: false, outline: false });
    water.userData.dynamic = true;
    world.animated.push(t => { water.position.y = 0.03 + Math.sin(t * 1.5) * 0.004; });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ball(pond, 0.24, ['#ffffff', '#ffe0ec', '#d6efff'][i % 3], Math.cos(a) * 1.72, 0.08, Math.sin(a) * 1.72, { seg: 10 }).scale.y = 0.5;
    }
    for (const [lx, lz] of [[-0.5, 0.3], [0.6, -0.4], [0.1, 0.8]]) cyl(pond, 0.2, 0.2, 0.02, '#7be36b', lx, 0.05, lz, { shadow: false }).scale.z = 0.8;
    const duck = group(pond, -0.6, -0.5, 0.6, 0.06);
    ball(duck, 0.14, '#ffd93d', 0, 0.1, 0).scale.set(1.2, 0.9, 1);
    ball(duck, 0.09, '#ffd93d', 0.1, 0.26, 0);
    ball(duck, 0.03, '#ff9f43', 0.2, 0.25, 0, { seg: 8 });
    world.animated.push(t => { duck.position.x = Math.sin(t * 0.3) * 0.7; duck.position.z = Math.cos(t * 0.3) * 0.7; duck.rotation.y = -t * 0.3; });
    interact(pond, { id: 'pond', name: 'Calm pond (breathing)', emoji: '🌊', room: 'garden', panel: 'calm',
      approach: [5, 10.25], face: [5, 12.6] });

    const tree = (x, z, s = 1, crown = '#9be37a', gratitude = false, happy = false) => {
      const g = group(scene, x, z);
      if (!gratitude) g.userData.flatten = true;
      cyl(g, 0.2 * s, 0.3 * s, 2.2 * s, '#c98f62');
      ball(g, 1.5 * s, crown, 0, 3.0 * s, 0, { seg: 18 });
      ball(g, 0.95 * s, crown, 0.95 * s, 2.5 * s, 0.4 * s, { seg: 14 });
      ball(g, 0.9 * s, crown, -0.95 * s, 2.6 * s, -0.2 * s, { seg: 14 });
      if (happy) face(g, 1.1 * s, 0, 3.0 * s, 1.5 * s + 0.01, { eyes: 'happy', mouth: 'open' });
      if (gratitude) {
        const tags = ['#ffd93d', '#ff9fc8', '#7fd4ff', '#cdb8ff', '#ffffff'];
        for (let i = 0; i < 10; i++) {
          const a = i * 0.7;
          box(g, 0.14, 0.18, 0.02, tags[i % 5], Math.cos(a) * 1.4 * s, 1.95 * s + (i % 3) * 0.22, Math.sin(a) * 1.4 * s, { shadow: false, round: 0.01 });
        }
      }
      return g;
    };
    const gt = tree(-9.5, 14.2, 1.1, '#ffb3d1', true, true);
    interact(gt, { id: 'tree', name: 'Gratitude tree', emoji: '🌳', room: 'garden', panel: 'gratitude',
      approach: [-8.2, 12.6], face: [-9.5, 14.2] });
    tree(17.5, 15.2, 0.9, '#9be37a', false, true);
    tree(18.6, 9.5, 0.8, '#ffb3d1');
    tree(-12.6, 9, 0.75, '#9be37a');

    // big smiling flowers everywhere
    const spots = [[-12, 15], [-7, 9.4], [-3.5, 15.8], [2.7, 15.2], [8.4, 9.5], [9.6, 15.6], [12.5, 11.8], [15.5, 8.9], [-11, 11.5], [7.5, 15.9], [14.2, 15.8], [-6.5, 16]];
    const schemes = [RAINBOW, ['#ff5fa2', '#ff9fc8'], ['#ffd93d', '#ff9f43'], ['#4fc3ff', '#a98bff']];
    spots.forEach(([x, z], i) => flower(x, z, { size: 0.9 + (i % 3) * 0.35, stem: 0.9 + (i % 2) * 0.4, colors: schemes[i % 4], face: { eyes: i % 2 ? 'happy' : 'oval', mouth: 'open' } }));
    flower(10.2, 12.2, { size: 2.2, stem: 1.3 });

    // flower beds along the front of the house
    for (const [x0, x1] of [[-9.6, -0.6], [1.6, 15.6]]) {
      box(scene, x1 - x0, 0.16, 0.62, '#c98f62', (x0 + x1) / 2, 0, 7.45, { shadow: false, round: 0.06 });
      let i = 0;
      for (let x = x0 + 0.3; x < x1 - 0.1; x += 0.55) {
        const fl = makeFlower({ size: 0.32, stem: 0.6, petals: 8, colors: [RAINBOW[i++ % 6]], face: { eyes: 'happy', mouth: 'smile' } });
        fl.group.position.set(x, 0.12, 7.45);
        fl.group.userData.flatten = true;
        scene.add(fl.group);
      }
    }

    const mb = group(scene, 2.0, 8.4);
    cyl(mb, 0.05, 0.05, 1.0, '#ffffff');
    box(mb, 0.34, 0.3, 0.5, '#ff5fa2', 0, 1.0, 0, { round: 0.12 });
    face(mb, 0.24, 0, 1.15, 0.255, { eyes: 'oval', mouth: 'smile' });
    box(mb, 0.02, 0.16, 0.05, '#ffd93d', 0.18, 1.2, 0.18, { round: 0.01 });
    interact(mb, { id: 'mailbox', name: 'Mailbox (settings)', emoji: '📬', room: 'garden', panel: 'settings',
      approach: [1.35, 8.4], face: [2.0, 8.4] });

    for (const [x, z] of [[-0.6, 9.6], [1.6, 13.4], [-0.6, 16.2]]) {
      const post = group(scene, x, z);
      post.userData.flatten = true;
      cyl(post, 0.05, 0.07, 2.0, '#ffffff');
      ball(post, 0.16, '#fff1a8', 0, 2.12, 0, { emissive: '#ffe48a', ei: 0.6, shadow: false });
      const l = new THREE.PointLight('#ffd9b0', 0, 9, 1.4);
      l.position.set(0, 2.1, 0);
      l.userData.minor = true;
      post.add(l);
      world.lamps.push(l);
    }
    const porch = new THREE.PointLight('#ffd9b0', 0, 7, 1.5);
    porch.position.set(0.5, 2.4, 7.5);
    porch.userData.minor = true;
    scene.add(porch);
    world.lamps.push(porch);

    const fence = (ax, az, bx, bz) => {
      const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 1.6);
      for (let i = 0; i <= n; i++) {
        const px = ax + (bx - ax) * i / n, pz = az + (bz - az) * i / n;
        box(scene, 0.14, 0.9, 0.14, '#ffffff', px, 0, pz, { round: 0.05 });
        ball(scene, 0.09, '#ff9fc8', px, 0.95, pz, { seg: 10 });
      }
      for (const y of [0.32, 0.66]) {
        const rail = box(scene, len, 0.07, 0.05, '#ffffff', (ax + bx) / 2, y, (az + bz) / 2, { round: 0.02 });
        rail.rotation.y = -Math.atan2(bz - az, bx - ax);
      }
    };
    fence(-14, 17, -0.5, 17); fence(1.5, 17, 20, 17);
    fence(-14, 7, -14, 17); fence(20, 7, 20, 17);
    fence(-14, 7, -10.2, 7); fence(16.2, 7, 20, 7);
  }

  // ===== SHOP DECOR (hidden until bought) =====
  const decor = (id, x, z, ry = 0) => { const g = group(scene, x, z, ry); g.visible = false; world.decor[id] = g; return g; };
  {
    const p = decor('plant', -2.4, 6.45);
    cyl(p, 0.26, 0.2, 0.46, '#ffd93d');
    face(p, 0.26, 0, 0.24, 0.245, { eyes: 'happy', mouth: 'smile' });
    const pf = makeFlower({ size: 0.45, stem: 0.9 });
    pf.group.position.y = 0.4;
    p.add(pf.group);

    const pt = decor('painting', 0.75, 0.1);
    box(pt, 1.3, 0.82, 0.05, '#ffffff', 0, 1.62, 0, { round: 0.03 });
    addMesh(pt, new THREE.PlaneGeometry(1.18, 0.7), toon('#ffffff', { outline: false, map: patternTexture({ bg: '#ffc2dc', flowers: RAINBOW, size: 48 }) }), 0, 2.03, 0.03, false);

    const bb = decor('beanbag', 2.1, -1.2);
    ball(bb, 0.5, '#ffd93d', 0, 0.3, 0).scale.set(1, 0.6, 1);
    face(bb, 0.34, 0, 0.36, 0.5, { eyes: 'happy', mouth: 'smile' });

    const fl = decor('floorlamp', 3.5, 5.0);
    cyl(fl, 0.2, 0.22, 0.05, '#ffffff');
    cyl(fl, 0.025, 0.025, 1.5, '#ffffff', 0, 0.05, 0);
    for (const [cx, cy, r] of [[0, 1.6, 0.22], [0.18, 1.55, 0.16], [-0.18, 1.56, 0.17]]) ball(fl, r, '#ffffff', cx, cy, 0, { emissive: '#fff1d0', ei: 0.5 });
    face(fl, 0.2, 0, 1.6, 0.225, { eyes: 'sleepy', mouth: 'smile' });
    const flLight = new THREE.PointLight('#ffd9b0', 0, 5, 1.6);
    flLight.position.set(0, 1.6, 0);
    fl.add(flLight);
    world.lamps.push(flLight);

    const gu = decor('guitar', -3.45, -0.6, 0.3);
    ball(gu, 0.22, '#ff5fa2', 0, 0.3, 0).scale.set(1, 1.2, 0.35);
    ball(gu, 0.17, '#ff5fa2', 0, 0.62, 0).scale.set(1, 1, 0.35);
    box(gu, 0.07, 0.7, 0.05, '#ffffff', 0, 0.7, 0, { round: 0.02 });
    gu.rotation.z = 0.15;

    // fairy lights swag along the back fence of the garden
    const li = decor('lights', 0, 16.9);
    for (let x = -13.8; x <= 19.8; x += 0.4) {
      if (x > -0.6 && x < 1.6) continue;
      const sag = 0.22 * Math.sin((((x + 14) % 1.6) / 1.6) * Math.PI);
      const b = ball(li, 0.06, RAINBOW[Math.round(x * 2.5 + 60) % 6], x, 1.12 - sag, 0, { seg: 8, shadow: false, emissive: '#ffe48a', ei: 0.6 });
      if (!world.bulbMats.includes(b.material)) world.bulbMats.push(b.material);
    }

    const aq = decor('aquarium', -2.65, 1.1, Math.PI / 2);
    box(aq, 1.0, 0.7, 0.46, '#ffffff', 0, 0, 0, { round: 0.06 });
    box(aq, 1.0, 0.56, 0.46, '#7fd4ff', 0, 0.7, 0, { opacity: 0.35, round: 0.03 });
    box(aq, 0.96, 0.06, 0.42, '#fff1a8', 0, 0.71, 0, { shadow: false, round: 0.01 });
    const fish = [];
    for (let i = 0; i < 4; i++) {
      const f = ball(aq, 0.04, ['#ff9f43', '#ffd93d', '#ff5fa2', '#4fc3ff'][i], 0, 0.95, 0, { seg: 8, shadow: false });
      f.scale.set(1.6, 1, 0.6);
      f.userData.dynamic = true;
      fish.push(f);
    }
    world.animated.push(t => fish.forEach((f, i) => {
      f.position.x = Math.sin(t * 0.7 + i * 1.7) * 0.38;
      f.position.y = 0.85 + i * 0.07 + Math.sin(t * 1.3 + i) * 0.03;
      f.position.z = Math.cos(t * 0.5 + i) * 0.1;
    }));

    const co = decor('console', 1.45, 0.36);
    box(co, 0.32, 0.07, 0.24, '#ffffff', 0, 0.5, 0, { round: 0.03 });
    box(co, 0.18, 0.05, 0.11, '#ff5fa2', -0.7, 0.44, 1.5, { round: 0.02 });

    const fo = decor('fountain', -3, 15);
    cyl(fo, 1.0, 1.1, 0.36, '#ffffff', 0, 0, 0, { seg: 28 });
    cyl(fo, 0.9, 0.9, 0.03, '#7fd4ff', 0, 0.35, 0, { seg: 28, shadow: false, outline: false });
    cyl(fo, 0.12, 0.16, 0.9, '#ffc2dc', 0, 0.36, 0);
    const ff = makeFlower({ size: 0.6, stem: 0 });
    ff.group.position.y = 1.4;
    fo.add(ff.group);
    const spray = ball(fo, 0.12, '#bfe8ff', 0, 1.85, 0, { opacity: 0.7, shadow: false });
    spray.userData.dynamic = true;
    world.animated.push(t => { spray.scale.setScalar(1 + Math.sin(t * 6) * 0.15); });

    const cat = decor('cat', 2.3, 4.7, -0.6);
    const fur = '#fff6ec';
    const cb = ball(cat, 0.2, fur, 0, 0.19, 0);
    cb.scale.set(0.95, 0.85, 1.35);
    cb.userData.dynamic = true;
    const head = group(cat, 0, 0.24, 0, 0.42);
    ball(head, 0.16, fur, 0, 0, 0);
    for (const ex of [-0.08, 0.08]) addMesh(head, new THREE.ConeGeometry(0.055, 0.1, 12), toon(fur), ex, 0.14, 0).rotation.z = -ex * 2;
    ball(head, 0.035, '#ff5fa2', 0.09, 0.12, 0.04, { seg: 8 });
    face(head, 0.24, 0, -0.01, 0.16, { eyes: 'oval', mouth: 'cat' });
    const tail = group(cat, 0, -0.26, 0, 0.14);
    cyl(tail, 0.03, 0.035, 0.36, fur, 0, 0, 0).rotation.x = -0.6;
    world.animated.push(t => {
      tail.rotation.z = Math.sin(t * 2.2) * 0.5;
      head.rotation.y = Math.sin(t * 0.4) * 0.5;
      cb.scale.y = 0.85 + Math.sin(t * 2) * 0.015;
    });
    interact(cat, { id: 'cat', name: 'Your cat', emoji: '🐈', room: 'living', panel: 'cat', approach: [2.3, 3.9], face: [2.3, 4.7] });
  }

  // ===== AI HELPER MASCOTS =====
  for (const bot of bots) {
    const [x, z] = BOT_SPOTS[bot.id];
    const g = group(scene, x, z);
    const hover = group(g, 0, 0, 0, 1.1);
    const squish = group(hover);
    buildMascot(squish, bot);
    const shadowDisk = addMesh(g, new THREE.CircleGeometry(0.26, 24), noOutline(new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.15 })), 0, 0.025, 0, false);
    shadowDisk.rotation.x = -Math.PI / 2;
    const label = labelSprite(`${bot.emoji} ${bot.name}`, { scale: 0.9 });
    label.position.set(0, 1.92, 0);
    g.add(label);
    const rec = world.bots[bot.id] = { group: g, hover, label, home: [x, z], target: null };
    const ph = Math.random() * 6;
    world.animated.push(t => {
      const s = Math.sin(t * 2.2 + ph);
      hover.position.y = 1.1 + s * 0.07;
      squish.scale.set(1 - s * 0.03, 1 + s * 0.04, 1 - s * 0.03);
      shadowDisk.scale.setScalar(1 - s * 0.12);
    });
    rec.item = interact(g, { id: 'bot:' + bot.id, name: `${bot.name} (${bot.role})`, emoji: bot.emoji, room: ROOM_OF_BOT[bot.id], panel: 'chat:' + bot.id,
      approach: [x, z + 0.95], face: [x, z], bot: bot.id });
    world.animated.push((t, dt) => {
      if (!rec.target) return;
      const p = g.position, [tx, tz] = rec.target;
      const k = 1 - Math.exp(-dt * 2.5);
      p.x += (tx - p.x) * k; p.z += (tz - p.z) * k;
      rec.item.approach = [p.x, p.z + 0.95];
      rec.item.face = [p.x, p.z];
      if (Math.hypot(tx - p.x, tz - p.z) < 0.01) rec.target = null;
    });
  }

  // Rename a helper's floating name tag.
  world.relabelBot = (id, text, name) => {
    const rec = world.bots[id];
    rec.group.remove(rec.label);
    rec.label.material.map.dispose();
    rec.label = labelSprite(text, { scale: 0.9 });
    rec.label.position.set(0, 1.92, 0);
    rec.label.userData.interact = rec.item;
    rec.group.add(rec.label);
    rec.item.name = name;
  };
  // Float a helper somewhere else (or back home with no position).
  world.moveBot = (id, pos) => { const rec = world.bots[id]; rec.target = pos || rec.home; };

  // ===== SKY: sun, moon, clouds, stars =====
  world.hemi = new THREE.HemisphereLight('#ffffff', '#ffd9e8', 1.3);
  scene.add(world.hemi);
  const sun = new THREE.DirectionalLight('#fff6e0', 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 22, bottom: -22, near: 1, far: 100 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  sun.target.position.set(3, 0, 3);
  scene.add(sun, sun.target);
  world.sun = sun;
  const moonLight = new THREE.DirectionalLight('#b8c4ff', 0);
  moonLight.position.set(-20, 30, 25);
  scene.add(moonLight);

  const skyFace = (bg, opts) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: facePlane(1, { ...opts, bg }).material.map, fog: false, transparent: true }));
    scene.add(s);
    return s;
  };
  world.sunSprite = skyFace('#ffd93d', { eyes: 'happy', mouth: 'open' });
  world.sunSprite.scale.setScalar(9);
  world.moonSprite = skyFace('#fff6c9', { eyes: 'sleepy', mouth: 'smile' });
  world.moonSprite.scale.setScalar(7);

  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const c = group(scene, -40 + i * 13, -30 - (i % 3) * 8, 0, 16 + (i % 2) * 4);
    for (const [cx, cy, r] of [[0, 0, 2], [2.1, -0.4, 1.5], [-2.1, -0.5, 1.5], [1, 1, 1.4]]) ball(c, r, '#ffffff', cx, cy, 0, { seg: 16, shadow: false });
    if (i % 2 === 0) face(c, 2.0, 0, -0.1, 2.05, { eyes: 'happy', mouth: 'smile' });
    c.scale.setScalar(0.8 + (i % 3) * 0.2);
    clouds.push(c);
  }
  world.animated.push((t, dt) => clouds.forEach((c, i) => {
    c.position.x += dt * (0.25 + i * 0.03);
    if (c.position.x > 55) c.position.x = -55;
  }));

  const starGeo = new THREE.BufferGeometry();
  const pts = [];
  for (let i = 0; i < 600; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.45;
    pts.push(Math.cos(th) * Math.sin(ph) * 90, Math.cos(ph) * 90 + 5, Math.sin(th) * Math.sin(ph) * 90);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  world.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#fff6c9', size: 0.45, transparent: true, opacity: 0, fog: false }));
  scene.add(world.stars);

  scene.fog = new THREE.Fog('#9ee2ff', 55, 130);

  // ----- day / night -----
  const NIGHT = new THREE.Color('#2a2163'), DUSK = new THREE.Color('#ffb3c9'), DAY = new THREE.Color('#9ee2ff');
  world.setTime = hour => {
    const t = (hour - 6) / 13;
    const elev = Math.sin(Math.PI * Math.min(Math.max(t, -0.1), 1.1));
    const dayF = THREE.MathUtils.clamp(elev * 2.2, 0, 1);
    const sky = NIGHT.clone().lerp(DAY, dayF);
    const duskW = THREE.MathUtils.clamp(1 - Math.abs(dayF - 0.35) / 0.35, 0, 1) * 0.6;
    sky.lerp(DUSK, duskW);
    scene.background = sky;
    scene.fog.color.copy(sky);
    const az = Math.PI * THREE.MathUtils.clamp(t, 0, 1);
    sun.position.set(3 - Math.cos(az) * 25, Math.max(elev, 0.15) * 28 + 4, 20);
    sun.intensity = 1.7 * dayF;
    world.hemi.intensity = 0.22 + 1.08 * dayF;
    world.hemi.color.set(dayF > 0.3 ? '#ffffff' : '#8f8ae0');
    moonLight.intensity = (1 - dayF) * 0.45;
    const night = 1 - dayF;
    const lampsOn = night > 0.05;
    world.lamps.forEach(l => {
      l.intensity = night * (l.parent === scene ? 9 : 5);
      l.visible = lampsOn && !(l.userData.minor && world.lowPower);
    });
    world.stars.material.opacity = THREE.MathUtils.clamp(night * 1.4 - 0.4, 0, 1);
    world.sunSprite.visible = dayF > 0.05;
    world.sunSprite.position.set(3 - Math.cos(az) * 60, 8 + elev * 30, -70);
    world.moonSprite.visible = night > 0.4;
    world.moonSprite.position.set(-25, 32, -70);
    for (const m of world.windowMats) m.color.copy(sky).lerp(new THREE.Color('#ffffff'), 0.25);
    for (const b of world.bulbMats) b.emissiveIntensity = 0.3 + night * 1.2;
    world.isNight = night > 0.5;
    return dayF;
  };

  world.setWallMode = mode => {
    for (const w of world.cutWalls) {
      if (w.lintel) { w.mesh.visible = mode === 'up'; continue; }
      const s = mode === 'up' ? 1 : 0.2;
      w.mesh.scale.y = s;
      w.mesh.position.y = (WALL_H * s) / 2;
    }
  };

  world.setOwned = owned => { for (const id in world.decor) world.decor[id].visible = owned.includes(id); };

  world.update = (t, dt) => { for (const f of world.animated) f(t, dt); };

  return world;
}

// ---------- mascots (original designs) ----------

function buildMascot(g, bot) {
  const c = bot.color;
  const lighter = '#' + new THREE.Color(c).offsetHSL(0, 0, 0.1).getHexString();
  ball(g, 0.3, c, 0, 0, 0, { seg: 28 }).scale.set(1, 0.93, 0.95);
  face(g, 0.42, 0, 0.02, 0.288, { eyes: 'oval', mouth: bot.mouth || 'smile' });
  for (const s of [-1, 1]) ball(g, 0.08, lighter, s * 0.12, -0.27, 0.05, { seg: 10 }).scale.set(1.2, 0.6, 1.4);
  switch (bot.kind) {
    case 'chick':
      for (const [x, y] of [[-0.06, 0.32], [0, 0.35], [0.06, 0.32]]) ball(g, 0.06, c, x, y, 0, { seg: 10 });
      for (const s of [-1, 1]) ball(g, 0.1, lighter, s * 0.3, -0.02, 0, { seg: 12 }).scale.set(0.5, 1, 0.8);
      ball(g, 0.04, '#ff9f43', 0, -0.02, 0.31, { seg: 8 });
      break;
    case 'owl':
      for (const s of [-1, 1]) {
        addMesh(g, new THREE.ConeGeometry(0.08, 0.18, 14), toon(c), s * 0.17, 0.3, 0).rotation.z = -s * 0.4;
        addMesh(g, new THREE.TorusGeometry(0.075, 0.014, 8, 24), toon('#ff5fa2'), s * 0.085, 0.05, 0.29).rotation.y = s * 0.15;
      }
      break;
    case 'chef':
      cyl(g, 0.15, 0.15, 0.14, '#ffffff', 0, 0.24, 0);
      for (const [x, z] of [[-0.08, 0], [0.08, 0], [0, 0.06], [0, -0.06]]) ball(g, 0.11, '#ffffff', x, 0.42, z, { seg: 12 });
      break;
    case 'dino':
      for (let i = 0; i < 4; i++) addMesh(g, new THREE.ConeGeometry(0.06, 0.13, 10), toon('#6fdcb9'), 0, 0.27 - i * 0.05, -0.08 - i * 0.07).rotation.x = -0.5 - i * 0.25;
      addMesh(g, new THREE.ConeGeometry(0.09, 0.25, 12), toon(c), 0, -0.15, -0.3).rotation.x = -1.9;
      break;
    case 'bunny':
      for (const s of [-1, 1]) {
        addMesh(g, new THREE.CapsuleGeometry(0.06, 0.28, 6, 12), toon(c), s * 0.1, 0.42, -0.02).rotation.z = -s * 0.18;
        addMesh(g, new THREE.CapsuleGeometry(0.03, 0.2, 4, 8), toon('#ffc2dc'), s * 0.1, 0.42, 0.035).rotation.z = -s * 0.18;
      }
      break;
    case 'cat':
      for (const s of [-1, 1]) addMesh(g, new THREE.ConeGeometry(0.09, 0.15, 14), toon(c), s * 0.16, 0.28, 0).rotation.z = -s * 0.35;
      ball(g, 0.05, '#ffd93d', 0.16, 0.2, 0.2, { seg: 8 });
      break;
    case 'bear': {
      for (const s of [-1, 1]) ball(g, 0.09, c, s * 0.19, 0.24, 0, { seg: 12 });
      const leaf = ball(g, 0.1, '#4fb85c', 0.02, 0.33, 0, { seg: 12 });
      leaf.scale.set(1.2, 0.35, 0.7);
      leaf.rotation.z = 0.4;
      break;
    }
    case 'mochi':
      addMesh(g, new THREE.TorusGeometry(0.3, 0.03, 8, 30, Math.PI), toon('#ff5fa2'), 0, 0.02, 0);
      for (const s of [-1, 1]) cyl(g, 0.09, 0.09, 0.08, '#ff5fa2', s * 0.3, -0.05, 0).rotation.z = Math.PI / 2;
      break;
    default: break;
  }
}

// ---------- navigation ----------

const MARGIN = 0.32;

export function roomAt(x, z) {
  for (const [id, r] of Object.entries(ROOMS)) {
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return id;
  }
  return null;
}

export function walkable(x, z) {
  for (const r of Object.values(ROOMS)) {
    if (x > r.x0 + MARGIN && x < r.x1 - MARGIN && z > r.z0 + MARGIN && z < r.z1 - MARGIN) return true;
  }
  for (const d of DOORS) {
    if (d.dir === 'h' && Math.abs(x - d.x) < DOOR_W / 2 - 0.25 && Math.abs(z - d.z) < 0.6) return true;
    if (d.dir === 'v' && Math.abs(z - d.z) < DOOR_W / 2 - 0.25 && Math.abs(x - d.x) < 0.6) return true;
  }
  return false;
}

export function clampToRoom(x, z) {
  const id = roomAt(x, z);
  if (!id) return null;
  const r = ROOMS[id];
  return [THREE.MathUtils.clamp(x, r.x0 + MARGIN + 0.05, r.x1 - MARGIN - 0.05), THREE.MathUtils.clamp(z, r.z0 + MARGIN + 0.05, r.z1 - MARGIN - 0.05)];
}

// Rooms are convex boxes connected by doors, so a path is: through each door on the way.
export function findPath(fx, fz, tx, tz) {
  const a = roomAt(fx, fz), b = roomAt(tx, tz);
  if (!a || !b || a === b) return [[tx, tz]];
  const prev = { [a]: null };
  const queue = [a];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === b) break;
    for (const d of DOORS) {
      const next = d.a === cur ? d.b : d.b === cur ? d.a : null;
      if (next && !(next in prev)) { prev[next] = { room: cur, door: d }; queue.push(next); }
    }
  }
  if (!(b in prev)) return [[tx, tz]];
  const steps = [];
  for (let r = b; prev[r]; r = prev[r].room) steps.unshift({ from: prev[r].room, door: prev[r].door });
  const pts = [];
  for (const s of steps) {
    const d = s.door, fr = ROOMS[s.from];
    if (d.dir === 'h') {
      const sign = (fr.z0 + fr.z1) / 2 < d.z ? -1 : 1;
      pts.push([d.x, d.z + sign * 0.6], [d.x, d.z - sign * 0.6]);
    } else {
      const sign = (fr.x0 + fr.x1) / 2 < d.x ? -1 : 1;
      pts.push([d.x + sign * 0.6, d.z], [d.x - sign * 0.6, d.z]);
    }
  }
  pts.push([tx, tz]);
  return pts;
}
