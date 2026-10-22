// The house's art style: superflat toon shading, kawaii faces and original smiling flowers.
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';

export const INK = '#3b2a3f';
export const FONT = '"Fredoka", "Baloo 2", system-ui, sans-serif';

export const PALETTE = {
  pink: '#ff5fa2', pinkSoft: '#ffc2dc', yellow: '#ffd93d', yellowSoft: '#fff1a8',
  sky: '#4fc3ff', skySoft: '#bfe8ff', mint: '#6fdcb9', mintSoft: '#cdf6e8',
  lilac: '#a98bff', lilacSoft: '#e4dbff', peach: '#ffad85', peachSoft: '#ffe0cf',
  cream: '#fff6ec', white: '#ffffff', green: '#7bd36b', leaf: '#4fb85c', red: '#ff6b6b',
  wood: '#f0c497', woodDark: '#c98f62',
};
export const RAINBOW = ['#ff5fa2', '#ff9f43', '#ffe14d', '#7be36b', '#4fc3ff', '#a77bff'];

// ---------- toon materials ----------

let gradient;
export function gradientMap() {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([150, 215, 255]), 3, 1, THREE.RedFormat);
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
}

export function noOutline(m) {
  m.userData.outlineParameters = { visible: false };
  return m;
}

const cache = new Map();
// A cartoon material. Options: opacity, emissive, ei, map, outline:false, vertexColors
export function toon(color, o = {}) {
  const key = color + JSON.stringify({ ...o, map: o.map?.uuid });
  if (cache.has(key)) return cache.get(key);
  const m = new THREE.MeshToonMaterial({
    color,
    gradientMap: gradientMap(),
    transparent: o.opacity != null,
    opacity: o.opacity ?? 1,
    emissive: o.emissive ?? 0x000000,
    emissiveIntensity: o.ei ?? 1,
    map: o.map ?? null,
    vertexColors: !!o.vertexColors,
    side: o.side ?? THREE.FrontSide,
  });
  if (o.outline === false || o.opacity != null) noOutline(m);
  cache.set(key, m);
  return m;
}

// ---------- shared geometries ----------

const geoCache = new Map();
export function roundedBox(w, h, d, round = 0.05) {
  const r = Math.max(0.001, Math.min(round, Math.min(w, h, d) * 0.45));
  const key = `${w}|${h}|${d}|${r}`;
  if (!geoCache.has(key)) geoCache.set(key, new RoundedBoxGeometry(w, h, d, 2, r));
  return geoCache.get(key);
}

// ---------- canvas art ----------

function canvas(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Kawaii face. eyes: oval | happy | sleepy ; mouth: smile | open | cat | o ; blush: bool
const faceCache = new Map();
export function faceTexture({ eyes = 'oval', mouth = 'smile', blush = true, bg = null, ink = INK } = {}) {
  const key = [eyes, mouth, blush, bg, ink].join('|');
  if (faceCache.has(key)) return faceCache.get(key);
  const t = canvas(256, (g, s) => {
    if (bg) { g.fillStyle = bg; g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = ink; g.strokeStyle = ink; g.lineCap = 'round'; g.lineWidth = 9;
    for (const ex of [86, 170]) {
      if (eyes === 'happy') { g.beginPath(); g.arc(ex, 128, 20, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
      else if (eyes === 'sleepy') { g.beginPath(); g.arc(ex, 116, 18, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); }
      else {
        g.beginPath(); g.ellipse(ex, 116, 17, 25, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fff';
        g.beginPath(); g.arc(ex - 6, 104, 7, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(ex + 6, 128, 3.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = ink;
      }
    }
    if (blush) {
      g.fillStyle = 'rgba(255, 110, 160, .55)';
      for (const bx of [58, 198]) { g.beginPath(); g.ellipse(bx, 156, 24, 13, 0, 0, Math.PI * 2); g.fill(); }
    }
    g.fillStyle = ink;
    if (mouth === 'open') {
      g.beginPath(); g.moveTo(98, 150); g.quadraticCurveTo(128, 205, 158, 150); g.closePath(); g.fill();
      g.fillStyle = '#ff8fab'; g.beginPath(); g.ellipse(128, 174, 14, 9, 0, 0, Math.PI * 2); g.fill();
    } else if (mouth === 'cat') {
      g.lineWidth = 7;
      g.beginPath(); g.arc(116, 150, 12, 0, Math.PI); g.stroke();
      g.beginPath(); g.arc(140, 150, 12, 0, Math.PI); g.stroke();
    } else if (mouth === 'o') {
      g.beginPath(); g.ellipse(128, 160, 9, 12, 0, 0, Math.PI * 2); g.fill();
    } else {
      g.lineWidth = 8;
      g.beginPath(); g.arc(128, 146, 20, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
    }
  });
  faceCache.set(key, t);
  return t;
}

export function facePlane(size, opts) {
  const m = new THREE.MeshBasicMaterial({ map: faceTexture(opts), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  noOutline(m);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), m);
  mesh.renderOrder = 2;
  return mesh;
}

// tiny 2D smiling flower used in wallpaper and rugs
function drawFlower(g, x, y, r, petal, center = '#ffe14d', faces = true) {
  g.fillStyle = petal;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.beginPath(); g.arc(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.48, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = center; g.beginPath(); g.arc(x, y, r * 0.5, 0, Math.PI * 2); g.fill();
  if (!faces) return;
  g.fillStyle = INK;
  g.beginPath(); g.arc(x - r * 0.17, y - r * 0.08, r * 0.07, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(x + r * 0.17, y - r * 0.08, r * 0.07, 0, Math.PI * 2); g.fill();
  g.strokeStyle = INK; g.lineWidth = Math.max(1, r * 0.06);
  g.beginPath(); g.arc(x, y + r * 0.05, r * 0.2, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
}

export function patternTexture({ bg, flowers = RAINBOW, dots = null, size = 40, rx = 1, ry = 1, stars = false, faces = true }) {
  const t = canvas(256, (g, s) => {
    g.fillStyle = bg; g.fillRect(0, 0, s, s);
    if (dots) {
      g.fillStyle = dots;
      for (let y = 16; y < s; y += 32) for (let x = (y / 32) % 2 ? 32 : 16; x < s; x += 32) { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); }
    }
    let i = 0;
    for (let y = size; y < s; y += size * 2.2) {
      for (let x = (Math.round(y / size) % 2 ? size * 1.6 : size * 0.6); x < s; x += size * 2.2) {
        if (stars) drawStar(g, x, y, size * 0.4, flowers[i++ % flowers.length]);
        else drawFlower(g, x, y, size * 0.42, flowers[i++ % flowers.length], faces ? '#ffe14d' : '#c9f0a8', faces);
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  return t;
}

function drawStar(g, x, y, r, color) {
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath(); g.fill();
}

export function checkerTexture(a, b, rx, ry) {
  const t = canvas(128, (g, s) => {
    g.fillStyle = a; g.fillRect(0, 0, s, s);
    g.fillStyle = b; g.fillRect(0, 0, s / 2, s / 2); g.fillRect(s / 2, s / 2, s / 2, s / 2);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.magFilter = THREE.NearestFilter;
  return t;
}

export function woodTexture(base, rx, ry) {
  const c = new THREE.Color(base);
  const shade = d => '#' + c.clone().offsetHSL(0, 0, d).getHexString();
  const t = canvas(256, (g, s) => {
    const rows = 6, h = s / rows;
    for (let r = 0; r < rows; r++) {
      g.fillStyle = shade(r % 2 ? 0.02 : -0.01);
      g.fillRect(0, r * h, s, h);
      g.fillStyle = shade(-0.12);
      g.fillRect(0, r * h + h - 3, s, 3);
      const off = (r % 3) * s / 3;
      g.fillRect((off + s / 2) % s, r * h, 3, h);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  return t;
}

// ---------- original 3D smiling flower ----------

const petalCache = new Map();
function petalGeometry(colors, n) {
  const key = colors.join(',') + n;
  if (petalCache.has(key)) return petalCache.get(key);
  const parts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const g = new THREE.SphereGeometry(1, 12, 8);
    g.scale(0.2, 0.36, 0.07);
    g.translate(0, 0.42, 0);
    g.rotateZ(a);
    const col = new THREE.Color(colors[i % colors.length]);
    const arr = new Float32Array(g.attributes.position.count * 3);
    for (let j = 0; j < arr.length; j += 3) { arr[j] = col.r; arr[j + 1] = col.g; arr[j + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    parts.push(g);
  }
  const merged = mergeGeometries(parts);
  petalCache.set(key, merged);
  return merged;
}

const discGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.09, 28).rotateX(Math.PI / 2);

// Returns { group, head }. The face points toward +z.
export function makeFlower({ size = 1, colors = RAINBOW, stem = 0.8, petals = 12, face = { eyes: 'oval', mouth: 'open' }, centerColor = '#ffe14d' } = {}) {
  const group = new THREE.Group();
  if (stem > 0) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, stem, 8), toon(PALETTE.leaf));
    s.position.y = stem / 2;
    s.castShadow = true;
    group.add(s);
    for (const side of [-1, 1]) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), toon(PALETTE.green));
      leaf.scale.set(0.16, 0.06, 0.08);
      leaf.position.set(side * 0.13, stem * 0.4, 0);
      leaf.rotation.z = side * 0.5;
      group.add(leaf);
    }
  }
  const head = new THREE.Group();
  head.position.y = stem;
  head.rotation.x = -0.2;
  group.add(head);
  const pm = new THREE.Mesh(petalGeometry(colors, petals), toon('#ffffff', { vertexColors: true }));
  pm.castShadow = true;
  head.add(pm);
  const disc = new THREE.Mesh(discGeo, toon(centerColor));
  head.add(disc);
  const f = facePlane(0.52, face);
  f.position.z = 0.05;
  head.add(f);
  group.scale.setScalar(size);
  return { group, head };
}
