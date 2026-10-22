// Builds the 3D house: rooms, walls, furniture, garden, lights, shop decor and AI helper bots.
import * as THREE from 'three';

// Floor plan (meters). The camera looks from the garden side (+z) toward the back wall (-z).
export const ROOMS = {
  bedroom:  { name: 'Bedroom',     emoji: '🛏️', x0: -10, x1: -3, z0: -7, z1: 0, floor: 'wood',   color: '#c49a6c' },
  bathroom: { name: 'Bathroom',    emoji: '🛁', x0: -3,  x1: 1,  z0: -7, z1: 0, floor: 'tile',   color: '#dbe6ea' },
  study:    { name: 'Study',       emoji: '📚', x0: 1,   x1: 10, z0: -7, z1: 0, floor: 'wood',   color: '#9c7552' },
  kitchen:  { name: 'Kitchen',     emoji: '🍳', x0: -10, x1: -3, z0: 0,  z1: 7, floor: 'tile',   color: '#ece3d3' },
  living:   { name: 'Living Room', emoji: '🛋️', x0: -3,  x1: 4,  z0: 0,  z1: 7, floor: 'wood',   color: '#b48659' },
  gym:      { name: 'Home Gym',    emoji: '🏋️', x0: 4,   x1: 10, z0: 0,  z1: 7, floor: 'rubber', color: '#56626b' },
  garden:   { name: 'Garden',      emoji: '🌿', x0: -14, x1: 14, z0: 7,  z1: 17, outdoor: true },
};

// Doorways. dir 'h' = in a wall running along x (at z), 'v' = in a wall running along z (at x).
export const DOORS = [
  { a: 'bedroom',  b: 'kitchen',  x: -6.5, z: 0,    dir: 'h' },
  { a: 'bedroom',  b: 'bathroom', x: -3,   z: -3.5, dir: 'v' },
  { a: 'bathroom', b: 'living',   x: -1,   z: 0,    dir: 'h' },
  { a: 'study',    b: 'living',   x: 2.5,  z: 0,    dir: 'h' },
  { a: 'study',    b: 'gym',      x: 7,    z: 0,    dir: 'h' },
  { a: 'kitchen',  b: 'living',   x: -3,   z: 3.5,  dir: 'v' },
  { a: 'living',   b: 'gym',      x: 4,    z: 3.5,  dir: 'v' },
  { a: 'living',   b: 'garden',   x: 0.5,  z: 7,    dir: 'h' },
];

const WALL_H = 2.6, WALL_T = 0.15, DOOR_W = 1.4;

// Things you can buy in the shop. They are built hidden and appear once owned.
export const SHOP_ITEMS = [
  { id: 'plant',      name: 'Big leafy plant',  emoji: '🪴', price: 20,  room: 'Living Room' },
  { id: 'painting',   name: 'Sunset painting',  emoji: '🖼️', price: 35,  room: 'Living Room' },
  { id: 'beanbag',    name: 'Comfy bean bag',   emoji: '🫘', price: 45,  room: 'Study' },
  { id: 'floorlamp',  name: 'Cozy floor lamp',  emoji: '💡', price: 50,  room: 'Living Room' },
  { id: 'guitar',     name: 'Guitar',           emoji: '🎸', price: 60,  room: 'Bedroom' },
  { id: 'lights',     name: 'Fairy lights',     emoji: '✨', price: 70,  room: 'Garden' },
  { id: 'aquarium',   name: 'Aquarium',         emoji: '🐠', price: 100, room: 'Living Room' },
  { id: 'console',    name: 'Game console',     emoji: '🎮', price: 120, room: 'Living Room' },
  { id: 'fountain',   name: 'Garden fountain',  emoji: '⛲', price: 150, room: 'Garden' },
  { id: 'cat',        name: 'A pet cat',        emoji: '🐈', price: 250, room: 'Living Room' },
];

// ---------- primitive helpers ----------

const matCache = new Map();
export function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({
      color,
      roughness: o.r ?? 0.8,
      metalness: o.m ?? 0,
      transparent: o.opacity != null,
      opacity: o.opacity ?? 1,
      emissive: o.emissive ?? 0x000000,
      emissiveIntensity: o.ei ?? 1,
      map: o.map ?? null,
    }));
  }
  return matCache.get(key);
}

function addMesh(parent, geo, material, x, y, z, shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
// y is the bottom of the box
export const box = (p, w, h, d, color, x = 0, y = 0, z = 0, o = {}) =>
  addMesh(p, new THREE.BoxGeometry(w, h, d), o.material ?? mat(color, o), x, y + h / 2, z, o.shadow !== false);
export const cyl = (p, rt, rb, h, color, x = 0, y = 0, z = 0, o = {}) =>
  addMesh(p, new THREE.CylinderGeometry(rt, rb, h, o.seg ?? 20), o.material ?? mat(color, o), x, y + h / 2, z, o.shadow !== false);
export const ball = (p, r, color, x = 0, y = 0, z = 0, o = {}) =>
  addMesh(p, new THREE.SphereGeometry(r, o.seg ?? 16, o.seg ? o.seg * 0.75 : 12), o.material ?? mat(color, o), x, y, z, o.shadow !== false);

function group(parent, x = 0, z = 0, ry = 0, y = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  parent.add(g);
  return g;
}

function canvasTexture(draw, rx, ry, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function shade(hex, amt) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amt);
  return '#' + c.getHexString();
}

const floorTextures = {
  wood: (base, w, d) => canvasTexture((g, s) => {
    const rows = 8, h = s / rows;
    for (let r = 0; r < rows; r++) {
      let x = (r % 2) * -s / 3;
      while (x < s) {
        const len = s / 1.5;
        g.fillStyle = shade(base, (Math.random() - 0.5) * 0.06);
        g.fillRect(x, r * h, len, h);
        g.strokeStyle = shade(base, -0.12);
        g.lineWidth = 2;
        g.strokeRect(x, r * h, len, h);
        x += len;
      }
    }
  }, w / 3, d / 3),
  tile: (base, w, d) => canvasTexture((g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    const n = 4, t = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = shade(base, (Math.random() - 0.5) * 0.03);
      g.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
    }
  }, w / 2.4, d / 2.4),
  rubber: (base, w, d) => canvasTexture((g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = Math.random() > 0.5 ? shade(base, 0.08) : shade(base, -0.06);
      g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
    g.strokeStyle = shade(base, -0.15); g.lineWidth = 3; g.strokeRect(0, 0, s, s);
  }, w / 2, d / 2),
};

function labelSprite(text, { bg = 'rgba(30,24,20,.82)', fg = '#fff', scale = 1 } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const font = '600 44px system-ui, -apple-system, Segoe UI, sans-serif';
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 48;
  c.width = w; c.height = 76;
  g.font = font;
  g.fillStyle = bg;
  const r = 34;
  g.beginPath();
  g.roundRect(0, 4, w, 68, r);
  g.fill();
  g.fillStyle = fg;
  g.textBaseline = 'middle';
  g.fillText(text, 24, 40);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set((w / 76) * 0.32 * scale, 0.32 * scale, 1);
  s.renderOrder = 10;
  return s;
}
export { labelSprite };

// ---------- world ----------

export function buildWorld(scene, bots) {
  const world = {
    interactables: [],
    bots: {},
    decor: {},
    lamps: [],
    cutWalls: [],
    animated: [],
    windowMats: [],
  };

  function interact(obj, def) {
    const item = { ...def, object: obj };
    obj.traverse(o => { o.userData.interact = item; });
    world.interactables.push(item);
    return item;
  }

  // ----- ground & sky -----
  const grass = canvasTexture((g, s) => {
    g.fillStyle = '#7fb069'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = Math.random() > 0.5 ? '#8cbd75' : '#6fa25c';
      g.fillRect(Math.random() * s, Math.random() * s, 2, 3);
    }
  }, 30, 30);
  const ground = addMesh(scene, new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }), 0, 0, 0, false);
  ground.rotation.x = -Math.PI / 2;
  ground.userData.ground = true;
  world.ground = ground;

  // ----- floors -----
  for (const [id, r] of Object.entries(ROOMS)) {
    if (r.outdoor) continue;
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    const tex = floorTextures[r.floor](r.color, w, d);
    const f = addMesh(scene, new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: tex, roughness: r.floor === 'tile' ? 0.35 : 0.75 }), (r.x0 + r.x1) / 2, 0.012, (r.z0 + r.z1) / 2, false);
    f.rotation.x = -Math.PI / 2;
    f.userData.ground = true;
  }
  // house foundation edge
  box(scene, 20.4, 0.1, 14.4, '#cfc4b4', 0, -0.09, 0, { shadow: false });

  // ----- walls -----
  const wallMat = mat('#f4eee4', { r: 0.95 });
  const extMat = mat('#e8d9c4', { r: 0.95 });
  const lines = [
    { dir: 'h', at: -7, from: -10, to: 10, back: true },
    { dir: 'h', at: 0, from: -10, to: 10 },
    { dir: 'h', at: 7, from: -10, to: 10, ext: true },
    { dir: 'v', at: -10, from: -7, to: 7, ext: true },
    { dir: 'v', at: 10, from: -7, to: 7, ext: true },
    { dir: 'v', at: -3, from: -7, to: 7 },
    { dir: 'v', at: 1, from: -7, to: 0 },
    { dir: 'v', at: 4, from: 0, to: 7 },
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
      // lintel above the doorway
      const lin = L.dir === 'h'
        ? box(scene, DOOR_W, WALL_H - 2.15, WALL_T, null, p, 2.15, L.at, { material: L.ext ? extMat : wallMat })
        : box(scene, WALL_T, WALL_H - 2.15, DOOR_W, null, L.at, 2.15, p, { material: wallMat });
      world.cutWalls.push({ mesh: lin, lintel: true });
    }
    segs.push([cur, L.to]);
    for (const [a, b] of segs) {
      const len = b - a + (a === L.from || b === L.to ? WALL_T : 0);
      const c = (a + b) / 2;
      const m = L.dir === 'h'
        ? box(scene, len, WALL_H, WALL_T, null, c, 0, L.at, { material: L.ext || L.back ? extMat : wallMat })
        : box(scene, WALL_T, WALL_H, len, null, L.at, 0, c, { material: L.ext ? extMat : wallMat });
      if (L.back) {
        // inner face of the back wall is cream; give it a wainscot stripe
        box(scene, len, 0.9, 0.02, '#e7dccb', c, 0, L.at + WALL_T / 2 + 0.01, { shadow: false });
      } else {
        world.cutWalls.push({ mesh: m });
      }
    }
  }

  // windows on the back wall
  for (const [x, w] of [[-6.2, 1.4], [-1, 0.8], [3.4, 1.4], [7.6, 1.4]]) {
    const glassMat = new THREE.MeshStandardMaterial({ color: '#a9d6f5', emissive: '#a9d6f5', emissiveIntensity: 0.6, roughness: 0.1 });
    world.windowMats.push(glassMat);
    box(scene, w + 0.14, 1.24, 0.06, '#ffffff', x, 1.03, -6.9);
    box(scene, w, 1.1, 0.02, null, x, 1.1, -6.86, { material: glassMat, shadow: false });
    box(scene, 0.05, 1.1, 0.03, '#ffffff', x, 1.1, -6.85, { shadow: false });
    box(scene, w + 0.3, 0.06, 0.18, '#ffffff', x, 1.0, -6.82);
  }

  // ----- room lamps (switch on at night) -----
  function roomLamp(x, z) {
    const light = new THREE.PointLight('#ffd7a0', 0, 11, 1.6);
    light.position.set(x, 2.35, z);
    scene.add(light);
    world.lamps.push(light);
    return light;
  }
  roomLamp(-6.5, -3.5); roomLamp(-1, -3.5); roomLamp(5.5, -3.5);
  roomLamp(-6.5, 3.5); roomLamp(0.5, 3.5); roomLamp(7, 3.5);

  // ===== BEDROOM =====
  {
    const bed = group(scene, -8.2, -5.4);
    box(bed, 1.7, 0.35, 2.2, '#7a5134');
    box(bed, 1.6, 0.22, 2.1, '#f4f1ea', 0, 0.35, 0);
    box(bed, 1.64, 0.07, 1.35, '#6c8ebf', 0, 0.55, 0.38);
    box(bed, 1.64, 0.08, 0.18, '#5878a8', 0, 0.55, -0.28);
    box(bed, 0.6, 0.14, 0.38, '#ffffff', -0.38, 0.57, -0.78);
    box(bed, 0.6, 0.14, 0.38, '#ffffff', 0.38, 0.57, -0.78);
    box(bed, 1.7, 1.05, 0.1, '#6a4428', 0, 0, -1.1);
    interact(bed, { id: 'bed', name: 'Bed', emoji: '🛏️', room: 'bedroom', panel: 'bed',
      approach: [-6.9, -5.0], pose: 'lie', seat: { x: -8.2, y: 0.6, z: -4.55, ry: 0 } });

    const ns = group(scene, -9.5, -6.5);
    box(ns, 0.5, 0.55, 0.42, '#7a5134');
    cyl(ns, 0.08, 0.1, 0.2, '#d9c7a8', 0, 0.55, 0);
    cyl(ns, 0.12, 0.18, 0.2, '#fff4dc', 0, 0.75, 0, { emissive: '#ffe2a8', ei: 0.4 });

    const desk = group(scene, -4.3, -6.55);
    box(desk, 1.4, 0.05, 0.65, '#b88a5a', 0, 0.72, 0);
    for (const [lx, lz] of [[-0.65, -0.28], [0.65, -0.28], [-0.65, 0.28], [0.65, 0.28]]) box(desk, 0.05, 0.72, 0.05, '#6a4428', lx, 0, lz);
    box(desk, 0.36, 0.03, 0.26, '#d35d6e', -0.1, 0.77, 0.08);
    box(desk, 0.34, 0.01, 0.24, '#fff8ef', -0.1, 0.8, 0.08, { shadow: false });
    cyl(desk, 0.01, 0.01, 0.16, '#333', 0.18, 0.8, 0.1).rotation.z = Math.PI / 2.3;
    cyl(desk, 0.05, 0.05, 0.12, '#7fb069', 0.5, 0.77, -0.15);
    ball(desk, 0.09, '#5c9a4a', 0.5, 0.97, -0.15);
    const chair = group(scene, -4.3, -5.8);
    box(chair, 0.48, 0.05, 0.46, '#8c6239', 0, 0.43, 0);
    box(chair, 0.48, 0.5, 0.05, '#8c6239', 0, 0.48, 0.21);
    for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) box(chair, 0.04, 0.43, 0.04, '#5a3c22', lx, 0, lz);
    interact(desk, { id: 'journal', name: 'Journal desk', emoji: '📓', room: 'bedroom', panel: 'journal',
      approach: [-4.3, -5.2], pose: 'sit', seat: { x: -4.3, y: 0.46, z: -5.75, ry: Math.PI } });

    const wr = group(scene, -9.62, -1.7, Math.PI / 2);
    box(wr, 1.3, 2.05, 0.6, '#a8774c');
    box(wr, 0.02, 1.9, 0.01, '#6a4428', 0, 0.08, 0.305);
    ball(wr, 0.03, '#d4af37', -0.08, 1.05, 0.31);
    ball(wr, 0.03, '#d4af37', 0.08, 1.05, 0.31);
    interact(wr, { id: 'wardrobe', name: 'Wardrobe', emoji: '👕', room: 'bedroom', panel: 'wardrobe',
      approach: [-8.7, -1.7], face: [-9.6, -1.7] });

    box(scene, 2.6, 0.015, 1.8, '#c98b8b', -6.6, 0.015, -3, { shadow: false });
  }

  // ===== BATHROOM =====
  {
    const sh = group(scene, 0.25, -6.25);
    box(sh, 1.3, 0.08, 1.3, '#ffffff');
    box(sh, 0.03, 2.0, 1.3, '#cfe8f3', -0.65, 0.08, 0, { opacity: 0.28, r: 0.05 });
    box(sh, 0.62, 2.0, 0.03, '#cfe8f3', -0.32, 0.08, 0.65, { opacity: 0.28, r: 0.05 });
    cyl(sh, 0.02, 0.02, 0.4, '#bbbbbb', 0, 1.95, -0.55, { m: 0.8, r: 0.3 }).rotation.x = Math.PI / 2;
    cyl(sh, 0.11, 0.08, 0.05, '#cccccc', 0, 2.05, -0.38, { m: 0.8, r: 0.3 });
    interact(sh, { id: 'shower', name: 'Shower', emoji: '🚿', room: 'bathroom', panel: 'shower',
      approach: [-0.2, -5.0], pose: 'stand', seat: { x: 0.3, y: 0.08, z: -6.2, ry: 0 } });

    const v = group(scene, -1.6, -6.68);
    box(v, 1.2, 0.8, 0.5, '#7ea6b5');
    box(v, 1.24, 0.06, 0.54, '#f7f7f7', 0, 0.8, 0);
    box(v, 0.5, 0.02, 0.32, '#dfe9ee', 0, 0.86, 0.02, { shadow: false });
    cyl(v, 0.02, 0.02, 0.2, '#bbbbbb', 0, 0.86, -0.18, { m: 0.8, r: 0.3 });
    box(v, 0.95, 0.95, 0.03, '#bcd9e6', 0, 1.15, -0.22, { m: 0.9, r: 0.05 });
    interact(v, { id: 'mirror', name: 'Mirror & sink', emoji: '🪞', room: 'bathroom', panel: 'mirror',
      approach: [-1.6, -5.9], face: [-1.6, -6.7] });

    const t = group(scene, 0.55, -2.2, -Math.PI / 2);
    cyl(t, 0.2, 0.17, 0.4, '#ffffff');
    cyl(t, 0.23, 0.23, 0.04, '#f2f2f2', 0, 0.4, 0);
    box(t, 0.48, 0.42, 0.2, '#ffffff', 0, 0.4, -0.28);
    interact(t, { id: 'toilet', name: 'Toilet', emoji: '🚽', room: 'bathroom', panel: 'toilet',
      approach: [-0.3, -2.2], face: [0.55, -2.2] });

    box(scene, 0.9, 0.012, 0.6, '#9cc5a1', -1.6, 0.015, -5.8, { shadow: false });
    box(scene, 0.6, 0.04, 0.04, '#bbbbbb', -2.94, 1.2, -5.2).rotation.y = Math.PI / 2;
    box(scene, 0.04, 0.6, 0.5, '#f2c6a0', -2.9, 0.65, -5.2);
  }

  // ===== STUDY =====
  {
    const d = group(scene, 5, -6.5);
    box(d, 1.8, 0.06, 0.75, '#e6dccd', 0, 0.72, 0);
    box(d, 0.06, 0.72, 0.7, '#555', -0.85, 0, 0);
    box(d, 0.06, 0.72, 0.7, '#555', 0.85, 0, 0);
    box(d, 0.06, 0.25, 0.06, '#333', 0, 0.78, -0.22);
    box(d, 0.95, 0.56, 0.05, '#222', 0, 0.98, -0.22);
    const screenMat = new THREE.MeshStandardMaterial({ color: '#203040', emissive: '#4a90d9', emissiveIntensity: 0.5 });
    box(d, 0.88, 0.49, 0.01, null, 0, 1.015, -0.19, { material: screenMat, shadow: false });
    world.monitorMat = screenMat;
    box(d, 0.5, 0.02, 0.16, '#444', 0, 0.78, 0.1);
    box(d, 0.08, 0.02, 0.12, '#444', 0.38, 0.78, 0.12);
    cyl(d, 0.05, 0.07, 0.04, '#333', -0.7, 0.78, -0.2);
    cyl(d, 0.012, 0.012, 0.4, '#333', -0.7, 0.8, -0.2);
    cyl(d, 0.04, 0.09, 0.1, '#f2b134', -0.7, 1.18, -0.15, { emissive: '#ffd36b', ei: 0.3 });
    const ch = group(scene, 5, -5.75);
    cyl(ch, 0.25, 0.25, 0.08, '#2d3142', 0, 0.42, 0);
    box(ch, 0.48, 0.6, 0.08, '#2d3142', 0, 0.5, 0.24);
    cyl(ch, 0.03, 0.03, 0.42, '#777', 0, 0, 0);
    cyl(ch, 0.25, 0.25, 0.03, '#555', 0, 0, 0);
    interact(d, { id: 'computer', name: 'Study desk', emoji: '💻', room: 'study', panel: 'focus',
      approach: [5, -5.1], pose: 'sit', seat: { x: 5, y: 0.47, z: -5.75, ry: Math.PI } });

    const bs = group(scene, 8.9, -6.68);
    box(bs, 1.6, 2.1, 0.4, '#5a3c22');
    const colors = ['#e07a5f', '#3d405b', '#81b29a', '#f2cc8f', '#6d597a', '#457b9d', '#e63946'];
    for (let s = 0; s < 4; s++) {
      box(bs, 1.5, 0.03, 0.36, '#7a5134', 0, 0.15 + s * 0.48, 0.02);
      let x = -0.7;
      while (x < 0.65) {
        const w = 0.05 + Math.random() * 0.06, h = 0.26 + Math.random() * 0.14;
        box(bs, w, h, 0.26, colors[Math.floor(Math.random() * colors.length)], x + w / 2, 0.18 + s * 0.48, 0.04, { shadow: false });
        x += w + 0.01;
      }
    }
    interact(bs, { id: 'bookshelf', name: 'Bookshelf (flashcards)', emoji: '📚', room: 'study', panel: 'flashcards',
      approach: [8.9, -5.8], face: [8.9, -6.7] });

    const wb = group(scene, 2.6, -6.9);
    box(wb, 1.7, 1.05, 0.04, '#9a9a9a', 0, 0.95, 0);
    box(wb, 1.6, 0.95, 0.02, '#ffffff', 0, 1.0, 0.025, { shadow: false });
    for (let i = 0; i < 5; i++) box(wb, 0.2 + Math.random() * 0.6, 0.02, 0.005, ['#2a9d8f', '#e76f51', '#264653'][i % 3], -0.4 + Math.random() * 0.5, 1.15 + i * 0.12 - 0.25, 0.04, { shadow: false });
    interact(wb, { id: 'whiteboard', name: 'Skills whiteboard', emoji: '🧠', room: 'study', panel: 'skills',
      approach: [2.6, -6.0], face: [2.6, -6.9] });

    box(scene, 2.4, 0.012, 1.6, '#3d5a80', 5, 0.015, -3.2, { shadow: false });
    cyl(scene, 0.2, 0.16, 0.4, '#c56b4a', 9.4, 0, -0.5);
    ball(scene, 0.38, '#4f8a3c', 9.4, 0.75, -0.5);
  }

  // ===== KITCHEN =====
  {
    const fr = group(scene, -9.55, 0.8, Math.PI / 2);
    box(fr, 0.85, 1.95, 0.72, '#e8ecef', 0, 0, 0, { m: 0.3, r: 0.35 });
    box(fr, 0.86, 0.02, 0.73, '#b9c1c7', 0, 1.25, 0, { shadow: false });
    box(fr, 0.03, 0.4, 0.04, '#9aa3a9', 0.33, 1.4, 0.37, { m: 0.6 });
    box(fr, 0.03, 0.6, 0.04, '#9aa3a9', 0.33, 0.5, 0.37, { m: 0.6 });
    interact(fr, { id: 'fridge', name: 'Fridge', emoji: '🧊', room: 'kitchen', panel: 'fridge',
      approach: [-8.55, 0.9], face: [-9.6, 0.9] });

    box(scene, 0.7, 0.88, 3.4, '#7d9d8c', -9.62, 0, 3.6);
    box(scene, 0.76, 0.05, 3.45, '#3f3f46', -9.6, 0.88, 3.6, { r: 0.4 });
    box(scene, 0.4, 0.7, 3.4, '#8fb09e', -9.78, 1.55, 3.6);
    // sink
    const sink = group(scene, -9.55, 2.8);
    box(sink, 0.5, 0.02, 0.6, '#c8d0d5', 0, 0.93, 0, { m: 0.7, r: 0.25, shadow: false });
    cyl(sink, 0.02, 0.02, 0.28, '#c0c0c0', -0.25, 0.93, 0, { m: 0.8, r: 0.2 });
    box(sink, 0.18, 0.02, 0.03, '#c0c0c0', -0.17, 1.2, 0, { m: 0.8, r: 0.2 });
    interact(sink, { id: 'sink', name: 'Kitchen sink (water)', emoji: '🚰', room: 'kitchen', panel: 'water',
      approach: [-8.6, 2.8], face: [-9.6, 2.8] });
    // stove
    const st = group(scene, -9.55, 4.5);
    box(st, 0.6, 0.02, 0.62, '#1f1f1f', 0, 0.93, 0, { r: 0.3 });
    for (const [bx, bz] of [[-0.14, -0.15], [-0.14, 0.15], [0.14, -0.15], [0.14, 0.15]]) cyl(st, 0.09, 0.09, 0.01, '#444', bx, 0.95, bz, { shadow: false });
    cyl(st, 0.14, 0.14, 0.12, '#b23a48', 0.14, 0.96, -0.15, { m: 0.3 });
    interact(st, { id: 'stove', name: 'Stove (cook)', emoji: '🍳', room: 'kitchen', panel: 'stove',
      approach: [-8.6, 4.5], face: [-9.6, 4.5] });

    const tb = group(scene, -5.6, 4.3);
    cyl(tb, 0.75, 0.75, 0.05, '#c9a173', 0, 0.72, 0);
    cyl(tb, 0.06, 0.25, 0.72, '#7a5134', 0, 0, 0);
    cyl(tb, 0.16, 0.1, 0.07, '#f1faee', 0, 0.77, 0);
    ball(tb, 0.05, '#e63946', -0.04, 0.86, 0.02);
    ball(tb, 0.05, '#f4a261', 0.05, 0.86, -0.03);
    ball(tb, 0.05, '#90be6d', 0.02, 0.87, 0.06);
    for (const a of [0, Math.PI]) {
      const c = group(scene, -5.6 + Math.cos(a) * 1.0, 4.3, -a + Math.PI / 2);
      box(c, 0.44, 0.05, 0.44, '#8c6239', 0, 0.43, 0);
      box(c, 0.44, 0.5, 0.05, '#8c6239', 0, 0.48, -0.2);
      for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) box(c, 0.04, 0.43, 0.04, '#5a3c22', lx, 0, lz);
    }
  }

  // ===== LIVING ROOM =====
  {
    const tv = group(scene, 0.75, 0.32);
    box(tv, 1.8, 0.5, 0.45, '#3a3a40');
    box(tv, 1.5, 0.86, 0.05, '#111', 0, 0.62, -0.08);
    const tvMat = new THREE.MeshStandardMaterial({ color: '#0d0d10', emissive: '#000000', roughness: 0.2 });
    box(tv, 1.42, 0.78, 0.01, null, 0, 0.66, -0.05, { material: tvMat, shadow: false });
    world.tvMat = tvMat;

    const sofa = group(scene, 0.75, 3.45, Math.PI);
    box(sofa, 2.3, 0.42, 0.95, '#457b9d');
    box(sofa, 2.3, 0.55, 0.22, '#3b6a88', 0, 0.42, -0.37);
    box(sofa, 0.22, 0.28, 0.95, '#3b6a88', -1.04, 0.42, 0);
    box(sofa, 0.22, 0.28, 0.95, '#3b6a88', 1.04, 0.42, 0);
    box(sofa, 0.9, 0.1, 0.7, '#4f86aa', -0.47, 0.42, 0.08);
    box(sofa, 0.9, 0.1, 0.7, '#4f86aa', 0.47, 0.42, 0.08);
    box(sofa, 0.35, 0.3, 0.12, '#f2cc8f', -0.75, 0.52, -0.22).rotation.z = 0.2;
    interact(sofa, { id: 'tv', name: 'Sofa & TV (fun)', emoji: '📺', room: 'living', panel: 'tv',
      approach: [0.75, 2.55], pose: 'sit', seat: { x: 0.75, y: 0.5, z: 3.45, ry: Math.PI } });

    const ct = group(scene, 0.75, 1.85);
    box(ct, 1.0, 0.05, 0.55, '#c9a173', 0, 0.38, 0);
    for (const [lx, lz] of [[-0.45, -0.22], [0.45, -0.22], [-0.45, 0.22], [0.45, 0.22]]) box(ct, 0.04, 0.38, 0.04, '#7a5134', lx, 0, lz);
    box(scene, 3.2, 0.012, 2.6, '#e9c46a', 0.75, 0.015, 2.6, { shadow: false });

    const hb = group(scene, -2.9, 5.5, Math.PI / 2);
    box(hb, 1.4, 0.95, 0.04, '#b5835a', 0, 0.85, 0);
    box(hb, 1.3, 0.85, 0.02, '#d9a86c', 0, 0.9, 0.025, { shadow: false });
    const notes = ['#ffe66d', '#ff9f9f', '#a0e7a0', '#9fd3ff'];
    for (let i = 0; i < 6; i++) box(hb, 0.2, 0.2, 0.01, notes[i % 4], -0.45 + (i % 3) * 0.45, 1.05 - Math.floor(i / 3) * 0.35, 0.04, { shadow: false });
    interact(hb, { id: 'habits', name: 'Habit board', emoji: '✅', room: 'living', panel: 'habits',
      approach: [-2.05, 5.5], face: [-2.9, 5.5] });

    const sideT = group(scene, 3.45, 6.4);
    cyl(sideT, 0.3, 0.3, 0.04, '#c9a173', 0, 0.6, 0);
    cyl(sideT, 0.04, 0.15, 0.6, '#7a5134', 0, 0, 0);
    box(sideT, 0.09, 0.015, 0.17, '#222', 0, 0.64, 0, { m: 0.4 });
    interact(sideT, { id: 'phone', name: 'Phone (call a friend)', emoji: '📱', room: 'living', panel: 'phone',
      approach: [2.75, 5.95], face: [3.45, 6.4] });

    const tr = group(scene, 3.72, 1.2, -Math.PI / 2);
    box(tr, 1.2, 1.7, 0.4, '#6a4428');
    for (let s = 0; s < 3; s++) box(tr, 1.1, 0.03, 0.36, '#8c6239', 0, 0.35 + s * 0.48, 0.02);
    for (let i = 0; i < 3; i++) {
      cyl(tr, 0.05, 0.08, 0.06, '#c9a227', -0.35 + i * 0.35, 1.31, 0, { m: 0.8, r: 0.3 });
      cyl(tr, 0.09, 0.04, 0.14, '#e9c46a', -0.35 + i * 0.35, 1.37, 0, { m: 0.8, r: 0.3 });
    }
    ball(tr, 0.1, '#e9c46a', 0, 0.95, 0, { m: 0.8, r: 0.3 });
    interact(tr, { id: 'trophies', name: 'Trophy shelf (progress)', emoji: '🏆', room: 'living', panel: 'progress',
      approach: [2.85, 1.2], face: [3.8, 1.2] });
  }

  // ===== GYM =====
  {
    const tm = group(scene, 8.6, 1.55);
    box(tm, 0.85, 0.18, 1.9, '#2b2d42');
    box(tm, 0.62, 0.03, 1.7, '#111', 0, 0.18, 0.05, { shadow: false });
    cyl(tm, 0.03, 0.03, 1.1, '#8d99ae', -0.38, 0.18, -0.85, { m: 0.6 });
    cyl(tm, 0.03, 0.03, 1.1, '#8d99ae', 0.38, 0.18, -0.85, { m: 0.6 });
    box(tm, 0.85, 0.25, 0.12, '#2b2d42', 0, 1.25, -0.85);
    box(tm, 0.4, 0.15, 0.01, '#38b000', 0, 1.3, -0.78, { emissive: '#38b000', ei: 0.6, shadow: false });
    interact(tm, { id: 'treadmill', name: 'Treadmill', emoji: '🏃', room: 'gym', panel: 'workout:Run',
      approach: [8.6, 2.95], pose: 'run', seat: { x: 8.6, y: 0.21, z: 1.75, ry: Math.PI } });

    const wr = group(scene, 9.55, 4.6, -Math.PI / 2);
    box(wr, 1.4, 0.05, 0.4, '#555', 0, 0.45, 0);
    box(wr, 1.4, 0.05, 0.4, '#555', 0, 0.85, 0);
    for (const lx of [-0.65, 0.65]) box(wr, 0.05, 0.95, 0.4, '#333', lx, 0, 0);
    for (let i = 0; i < 4; i++) for (const y of [0.52, 0.92]) {
      const db = group(wr, -0.45 + i * 0.3, 0, 0, y);
      cyl(db, 0.015, 0.015, 0.25, '#999', 0, 0, 0, { m: 0.8 }).rotation.z = Math.PI / 2;
      cyl(db, 0.05, 0.05, 0.05, '#e63946', -0.12, -0.02, 0).rotation.z = Math.PI / 2;
      cyl(db, 0.05, 0.05, 0.05, '#e63946', 0.12, -0.02, 0).rotation.z = Math.PI / 2;
    }
    interact(wr, { id: 'weights', name: 'Weights', emoji: '🏋️', room: 'gym', panel: 'workout:Strength',
      approach: [8.7, 4.6], face: [9.6, 4.6] });

    const ym = group(scene, 6.4, 5.6);
    box(ym, 0.7, 0.012, 1.8, '#9b5de5', 0, 0.012, 0, { shadow: false });
    interact(ym, { id: 'yoga', name: 'Yoga mat', emoji: '🧘', room: 'gym', panel: 'workout:Yoga / stretching',
      approach: [6.4, 4.4], pose: 'stand', seat: { x: 6.4, y: 0.02, z: 5.6, ry: 0 } });

    ball(scene, 0.32, '#f15bb5', 5.0, 0.32, 6.3);
    cyl(scene, 0.05, 0.05, 0.24, '#00bbf9', 6.4, 0, 6.7);
  }

  // ===== GARDEN =====
  {
    for (let z = 7.5; z < 16.6; z += 0.75) {
      const s = cyl(scene, 0.3, 0.32, 0.04, '#bfb5a3', 0.5 + (Math.random() - 0.5) * 0.15, 0, z, { seg: 8 });
      s.rotation.y = Math.random();
    }
    const bench = group(scene, -5, 11.2);
    box(bench, 1.6, 0.06, 0.45, '#a0522d', 0, 0.42, 0);
    box(bench, 1.6, 0.4, 0.05, '#a0522d', 0, 0.55, -0.22);
    for (const lx of [-0.7, 0.7]) { box(bench, 0.06, 0.42, 0.45, '#333', lx, 0, 0); }
    interact(bench, { id: 'bench', name: 'Feelings bench', emoji: '💗', room: 'garden', panel: 'feelings',
      approach: [-5, 12.0], pose: 'sit', seat: { x: -5, y: 0.47, z: 11.15, ry: 0 } });

    const pond = group(scene, 5, 12.6);
    const water = cyl(pond, 1.6, 1.6, 0.03, '#4fa3d1', 0, 0.01, 0, { r: 0.05, m: 0.2, seg: 32, shadow: false });
    world.animated.push(t => { water.material.emissiveIntensity = 0; water.position.y = 0.025 + Math.sin(t * 1.5) * 0.004; });
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const r = addMesh(pond, new THREE.DodecahedronGeometry(0.22), mat('#9a9a9a', { r: 1 }), Math.cos(a) * 1.7, 0.08, Math.sin(a) * 1.7);
      r.scale.y = 0.6;
    }
    for (const [lx, lz] of [[-0.5, 0.3], [0.6, -0.4], [0.1, 0.8]]) {
      const lp = cyl(pond, 0.2, 0.2, 0.01, '#5aa04a', lx, 0.05, lz, { shadow: false });
      lp.scale.z = 0.8;
    }
    ball(pond, 0.07, '#ff8fab', 0.62, 0.1, -0.38);
    interact(pond, { id: 'pond', name: 'Calm pond (breathing)', emoji: '🌊', room: 'garden', panel: 'calm',
      approach: [5, 10.25], face: [5, 12.6] });

    const tree = (x, z, s = 1, gratitude = false) => {
      const g = group(scene, x, z);
      cyl(g, 0.18 * s, 0.28 * s, 2.2 * s, '#7a5134');
      addMesh(g, new THREE.IcosahedronGeometry(1.5 * s, 1), mat('#4f8a3c', { r: 1 }), 0, 2.9 * s, 0);
      addMesh(g, new THREE.IcosahedronGeometry(1.0 * s, 1), mat('#5fa04a', { r: 1 }), 0.7 * s, 2.4 * s, 0.5 * s);
      addMesh(g, new THREE.IcosahedronGeometry(0.9 * s, 1), mat('#467d35', { r: 1 }), -0.8 * s, 2.5 * s, -0.3 * s);
      if (gratitude) {
        const tags = ['#ffe66d', '#ff9f9f', '#9fd3ff', '#c3a6ff'];
        for (let i = 0; i < 8; i++) {
          const a = i * 0.8;
          box(g, 0.12, 0.16, 0.01, tags[i % 4], Math.cos(a) * 1.35, 1.9 + (i % 3) * 0.2, Math.sin(a) * 1.35, { shadow: false, emissive: tags[i % 4], ei: 0.2 });
        }
      }
      return g;
    };
    const gt = tree(-9.5, 14.2, 1.1, true);
    interact(gt, { id: 'tree', name: 'Gratitude tree', emoji: '🌳', room: 'garden', panel: 'gratitude',
      approach: [-8.2, 12.6], face: [-9.5, 14.2] });
    tree(11.5, 15.2, 0.9); tree(12.3, 9.2, 0.8); tree(-12.6, 9, 0.75);

    // flower beds along the front of the house
    const flowerColors = ['#ff595e', '#ffca3a', '#8ac926', '#ff99c8', '#c77dff', '#ffffff'];
    for (const [x0, x1] of [[-9.6, -0.6], [1.6, 9.6]]) {
      box(scene, x1 - x0, 0.12, 0.6, '#6b4f3a', (x0 + x1) / 2, 0, 7.45, { shadow: false });
      for (let x = x0 + 0.2; x < x1; x += 0.35) {
        ball(scene, 0.14, '#3f7d3a', x, 0.2, 7.45 + (Math.random() - 0.5) * 0.2, { seg: 8 });
        ball(scene, 0.06, flowerColors[Math.floor(Math.random() * flowerColors.length)], x + 0.05, 0.33, 7.5, { seg: 8, shadow: false });
      }
    }

    const mb = group(scene, 2.0, 8.4);
    box(mb, 0.08, 1.0, 0.08, '#7a5134');
    box(mb, 0.3, 0.25, 0.45, '#d62828', 0, 1.0, 0);
    box(mb, 0.02, 0.15, 0.04, '#ffd60a', 0.16, 1.15, 0.12);
    interact(mb, { id: 'mailbox', name: 'Mailbox (settings)', emoji: '📬', room: 'garden', panel: 'settings',
      approach: [1.35, 8.4], face: [2.0, 8.4] });

    // lamp posts along the path and a porch light
    for (const [x, z] of [[-0.6, 9.6], [1.6, 13.4], [-0.6, 16.2]]) {
      const post = group(scene, x, z);
      cyl(post, 0.05, 0.07, 2.0, '#2f2f35');
      ball(post, 0.13, '#fff4d6', 0, 2.1, 0, { emissive: '#ffe0a3', ei: 1, shadow: false });
      const l = new THREE.PointLight('#ffd7a0', 0, 9, 1.4);
      l.position.set(0, 2.1, 0);
      post.add(l);
      world.lamps.push(l);
    }
    const porch = new THREE.PointLight('#ffd7a0', 0, 7, 1.5);
    porch.position.set(0.5, 2.4, 7.5);
    scene.add(porch);
    world.lamps.push(porch);

    // fence
    const fence = (ax, az, bx, bz) => {
      const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 1.6);
      for (let i = 0; i <= n; i++) box(scene, 0.1, 0.9, 0.1, '#f4f1ea', ax + (bx - ax) * i / n, 0, az + (bz - az) * i / n);
      for (const y of [0.35, 0.7]) {
        const rail = box(scene, len, 0.06, 0.04, '#f4f1ea', (ax + bx) / 2, y, (az + bz) / 2);
        rail.rotation.y = -Math.atan2(bz - az, bx - ax);
      }
    };
    fence(-14, 17, -0.5, 17); fence(1.5, 17, 14, 17);
    fence(-14, 7, -14, 17); fence(14, 7, 14, 17);
    fence(-14, 7, -10.2, 7); fence(10.2, 7, 14, 7);
  }

  // ===== SHOP DECOR (hidden until bought) =====
  const decor = (id, x, z, ry = 0) => { const g = group(scene, x, z, ry); g.visible = false; world.decor[id] = g; return g; };
  {
    const p = decor('plant', -2.45, 6.45);
    cyl(p, 0.25, 0.2, 0.45, '#e07a5f');
    for (let i = 0; i < 7; i++) {
      const leaf = box(p, 0.12, 0.6, 0.03, i % 2 ? '#3a7d44' : '#4f9d58', 0, 0.45, 0);
      leaf.rotation.set(0.5 * Math.cos(i), i * 0.9, 0.5 * Math.sin(i));
      leaf.position.y = 0.7;
    }

    const pt = decor('painting', 0.75, 0.1);
    const art = canvasTexture((g, s) => {
      const grd = g.createLinearGradient(0, 0, 0, s);
      grd.addColorStop(0, '#ff9e6d'); grd.addColorStop(0.55, '#ffd27f'); grd.addColorStop(0.56, '#3d5a80'); grd.addColorStop(1, '#293241');
      g.fillStyle = grd; g.fillRect(0, 0, s, s);
      g.fillStyle = '#fff3b0'; g.beginPath(); g.arc(s / 2, s * 0.55, s * 0.15, Math.PI, 0); g.fill();
    }, 1, 1);
    box(pt, 1.3, 0.8, 0.04, '#5a3c22', 0, 1.6, 0);
    box(pt, 1.2, 0.7, 0.01, null, 0, 1.65, 0.025, { material: new THREE.MeshStandardMaterial({ map: art }), shadow: false });

    const bb = decor('beanbag', 2.1, -1.2);
    const bag = ball(bb, 0.5, '#f4a261', 0, 0.3, 0);
    bag.scale.set(1, 0.6, 1);

    const fl = decor('floorlamp', 3.5, 5.0);
    cyl(fl, 0.18, 0.2, 0.04, '#333');
    cyl(fl, 0.02, 0.02, 1.5, '#333', 0, 0.04, 0);
    cyl(fl, 0.15, 0.25, 0.3, '#fff1d0', 0, 1.5, 0, { emissive: '#ffdca0', ei: 0.6 });
    const flLight = new THREE.PointLight('#ffd7a0', 0, 5, 1.6);
    flLight.position.set(0, 1.55, 0);
    fl.add(flLight);
    world.lamps.push(flLight);

    const gu = decor('guitar', -3.45, -0.6, 0.3);
    const body = ball(gu, 0.22, '#c1121f', 0, 0.3, 0); body.scale.set(1, 1.2, 0.35);
    ball(gu, 0.17, '#c1121f', 0, 0.62, 0).scale.set(1, 1, 0.35);
    box(gu, 0.06, 0.7, 0.04, '#5a3c22', 0, 0.7, 0);
    gu.rotation.z = 0.15;

    const li = decor('lights', 0, 7.2);
    const bulbs = [];
    for (let x = -9.6; x <= 9.6; x += 0.5) {
      const sag = 0.25 * Math.sin(((x + 9.6) % 2.4) / 2.4 * Math.PI);
      bulbs.push(ball(li, 0.05, ['#ffd166', '#ef476f', '#06d6a0', '#118ab2'][Math.round(x * 2) & 3], x, 2.5 - sag, 0, { seg: 6, shadow: false, emissive: '#ffd166', ei: 0.9 }));
    }

    const aq = decor('aquarium', -2.65, 1.1, Math.PI / 2);
    box(aq, 1.0, 0.7, 0.45, '#3a3a40');
    box(aq, 1.0, 0.55, 0.45, '#7fd1ff', 0, 0.7, 0, { opacity: 0.35, r: 0.05 });
    box(aq, 0.96, 0.06, 0.41, '#e9d8a6', 0, 0.71, 0, { shadow: false });
    const fish = [];
    for (let i = 0; i < 4; i++) {
      const f = ball(aq, 0.035, ['#ff7b00', '#ffd000', '#ff4d6d', '#4cc9f0'][i], 0, 0.95, 0, { seg: 8, shadow: false });
      f.scale.set(1.6, 1, 0.6);
      fish.push(f);
    }
    world.bulbMats = [...new Set(bulbs.map(b => b.material))];
    world.animated.push(t => fish.forEach((f, i) => {
      f.position.x = Math.sin(t * 0.7 + i * 1.7) * 0.38;
      f.position.y = 0.85 + i * 0.07 + Math.sin(t * 1.3 + i) * 0.03;
      f.position.z = Math.cos(t * 0.5 + i) * 0.1;
    }));

    const co = decor('console', 1.5, 0.35);
    box(co, 0.3, 0.06, 0.22, '#f1f1f1', 0, 0.5, 0);
    box(co, 0.16, 0.04, 0.1, '#222', -0.75, 0.43, 1.6);

    const fo = decor('fountain', -3, 15);
    cyl(fo, 1.0, 1.1, 0.35, '#bdb5a6', 0, 0, 0, { seg: 24 });
    cyl(fo, 0.9, 0.9, 0.02, '#5fb3e6', 0, 0.34, 0, { seg: 24, shadow: false });
    cyl(fo, 0.12, 0.15, 0.9, '#bdb5a6', 0, 0.35, 0);
    cyl(fo, 0.45, 0.35, 0.12, '#bdb5a6', 0, 1.2, 0);
    const spray = ball(fo, 0.12, '#a9def9', 0, 1.45, 0, { opacity: 0.7, shadow: false });
    world.animated.push(t => { spray.scale.setScalar(1 + Math.sin(t * 6) * 0.15); });

    const cat = decor('cat', 2.3, 4.7, -0.6);
    const fur = '#f4a259';
    const cb = ball(cat, 0.18, fur, 0, 0.18, 0); cb.scale.set(0.9, 0.8, 1.4);
    const head = group(cat, 0, 0, 0, 0.36); head.position.z = 0.22;
    ball(head, 0.12, fur, 0, 0, 0);
    for (const ex of [-0.06, 0.06]) {
      const ear = addMesh(head, new THREE.ConeGeometry(0.04, 0.08, 4), mat(fur), ex, 0.11, 0);
      ear.rotation.y = Math.PI / 4;
      ball(head, 0.018, '#1b1b1b', ex * 0.8, 0.02, 0.105, { seg: 6, shadow: false });
    }
    ball(head, 0.015, '#ff8fab', 0, -0.02, 0.12, { seg: 6, shadow: false });
    const tail = group(cat, 0, -0.22, 0, 0.12);
    cyl(tail, 0.025, 0.03, 0.35, fur, 0, 0, 0).rotation.x = -0.6;
    world.animated.push(t => {
      tail.rotation.z = Math.sin(t * 2.2) * 0.5;
      head.rotation.y = Math.sin(t * 0.4) * 0.5;
    });
    interact(cat, { id: 'cat', name: 'Your cat', emoji: '🐈', room: 'living', panel: 'cat', approach: [2.3, 3.9], face: [2.3, 4.7] });
  }

  // ===== AI HELPER BOTS =====
  const botSpots = {
    luna: [-5.6, -2.2], mo: [-2.2, -1.2], owl: [2.7, -3.1], basil: [-6.0, 1.6],
    sunny: [-2.0, 1.4], rex: [5.3, 1.4], sage: [-2.4, 11.4],
  };
  for (const bot of bots) {
    const [x, z] = botSpots[bot.id];
    const g = group(scene, x, z);
    const hover = group(g, 0, 0, 0, 1.15);
    const body = ball(hover, 0.24, '#f7f7f2', 0, 0, 0, { r: 0.35, seg: 24 });
    body.scale.set(1, 0.92, 1);
    box(hover, 0.32, 0.13, 0.08, '#1d1d24', 0, -0.035, 0.19, { r: 0.2, shadow: false });
    for (const ex of [-0.07, 0.07]) ball(hover, 0.028, bot.color, ex, 0.03, 0.235, { seg: 8, emissive: bot.color, ei: 1.2, shadow: false });
    cyl(hover, 0.01, 0.01, 0.14, '#888', 0, 0.2, 0);
    ball(hover, 0.04, bot.color, 0, 0.36, 0, { emissive: bot.color, ei: 1.0, seg: 10 });
    const ring = addMesh(hover, new THREE.TorusGeometry(0.27, 0.025, 8, 32), mat(bot.color, { emissive: bot.color, ei: 0.5 }), 0, -0.05, 0);
    ring.rotation.x = Math.PI / 2;
    const shadowDisk = addMesh(g, new THREE.CircleGeometry(0.22, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.18 }), 0, 0.02, 0, false);
    shadowDisk.rotation.x = -Math.PI / 2;
    const label = labelSprite(`${bot.emoji} ${bot.name}`);
    label.position.set(0, 1.75, 0);
    g.add(label);
    world.bots[bot.id] = { group: g, hover, label };
    world.animated.push(t => {
      hover.position.y = 1.15 + Math.sin(t * 2 + x) * 0.06;
      ring.rotation.z = t * 0.8;
    });
    interact(g, { id: 'bot:' + bot.id, name: `${bot.name} (${bot.role})`, emoji: bot.emoji, room: ROOM_OF_BOT[bot.id], panel: 'chat:' + bot.id,
      approach: [x, z + 0.95], face: [x, z], bot: bot.id });
  }

  // ===== SKY, SUN, STARS =====
  world.hemi = new THREE.HemisphereLight('#cfe8ff', '#7a6a55', 1.0);
  scene.add(world.hemi);
  const sun = new THREE.DirectionalLight('#fff3dc', 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 90 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  world.sun = sun;
  const moonLight = new THREE.DirectionalLight('#9db4ff', 0);
  moonLight.position.set(-20, 30, 25);
  scene.add(moonLight);

  const starGeo = new THREE.BufferGeometry();
  const pts = [];
  for (let i = 0; i < 600; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.45;
    pts.push(Math.cos(th) * Math.sin(ph) * 90, Math.cos(ph) * 90 + 5, Math.sin(th) * Math.sin(ph) * 90);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  world.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.35, transparent: true, opacity: 0, fog: false }));
  scene.add(world.stars);
  world.moon = ball(scene, 2.2, '#f5f3ce', -30, 40, -60, { emissive: '#f5f3ce', ei: 1, shadow: false });
  world.moon.material = new THREE.MeshBasicMaterial({ color: '#f5f3ce', fog: false });

  scene.fog = new THREE.Fog('#9fd3ff', 45, 110);

  // ----- day / night -----
  const NIGHT = new THREE.Color('#0b1230'), DUSK = new THREE.Color('#f2a172'), DAY = new THREE.Color('#9fd3ff');
  world.setTime = hour => {
    const t = (hour - 6) / 13;                       // 0 at 6am sunrise, 1 at 7pm sunset
    const elev = Math.sin(Math.PI * Math.min(Math.max(t, -0.1), 1.1));
    const dayF = THREE.MathUtils.clamp(elev * 2.2, 0, 1);
    const sky = NIGHT.clone().lerp(DAY, dayF);
    const duskW = THREE.MathUtils.clamp(1 - Math.abs(dayF - 0.35) / 0.35, 0, 1) * 0.55;
    sky.lerp(DUSK, duskW);
    scene.background = sky;
    scene.fog.color.copy(sky);
    const az = Math.PI * THREE.MathUtils.clamp(t, 0, 1);
    sun.position.set(-Math.cos(az) * 25, Math.max(elev, 0.15) * 28 + 4, 18);
    sun.intensity = 2.6 * dayF;
    sun.color.set(duskW > 0.25 ? '#ffc58f' : '#fff3dc');
    world.hemi.intensity = 0.45 + 0.75 * dayF;
    moonLight.intensity = (1 - dayF) * 0.9;
    world.hemi.color.set(dayF > 0.3 ? '#cfe8ff' : '#6d7cb5');
    const night = 1 - dayF;
    world.lamps.forEach(l => { l.intensity = night * (l.parent === scene ? 14 : 6); });
    world.stars.material.opacity = THREE.MathUtils.clamp(night * 1.4 - 0.4, 0, 1);
    world.moon.visible = night > 0.4;
    for (const m of world.windowMats) {
      m.color.copy(sky).lerp(new THREE.Color('#ffffff'), 0.2);
      m.emissive.copy(sky);
      m.emissiveIntensity = 0.3 + dayF * 0.4;
    }
    for (const b of world.bulbMats) b.emissiveIntensity = 0.2 + night * 1.5;
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

  world.update = t => { for (const f of world.animated) f(t); };

  return world;
}

const ROOM_OF_BOT = { luna: 'bedroom', mo: 'bathroom', owl: 'study', basil: 'kitchen', sunny: 'living', rex: 'gym', sage: 'garden' };

// ---------- navigation ----------

const MARGIN = 0.3;

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

// Clamp a clicked point to the inside of the room it is in.
export function clampToRoom(x, z) {
  const id = roomAt(x, z);
  if (!id) return null;
  const r = ROOMS[id];
  return [THREE.MathUtils.clamp(x, r.x0 + MARGIN + 0.05, r.x1 - MARGIN - 0.05), THREE.MathUtils.clamp(z, r.z0 + MARGIN + 0.05, r.z1 - MARGIN - 0.05)];
}

// Rooms are convex boxes connected by doors, so a path is: through each door on the way.
export function findPath(fx, fz, tx, tz) {
  let a = roomAt(fx, fz), b = roomAt(tx, tz);
  if (!a || !b) return [[tx, tz]];
  if (a === b) return [[tx, tz]];
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
  for (let r = b; prev[r]; r = prev[r].room) steps.unshift({ from: prev[r].room, to: r, door: prev[r].door });
  const pts = [];
  for (const s of steps) {
    const d = s.door, fr = ROOMS[s.from];
    if (d.dir === 'h') {
      const sign = (fr.z0 + fr.z1) / 2 < d.z ? -1 : 1;
      pts.push([d.x, d.z + sign * 0.55], [d.x, d.z - sign * 0.55]);
    } else {
      const sign = (fr.x0 + fr.x1) / 2 < d.x ? -1 : 1;
      pts.push([d.x + sign * 0.55, d.z], [d.x - sign * 0.55, d.z]);
    }
  }
  pts.push([tx, tz]);
  return pts;
}
