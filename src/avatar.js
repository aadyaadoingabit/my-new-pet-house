// The player's character ("the pet"): a cute chibi girl with smooth blended animation,
// outfits you can mix and match, and a hand-drawn face that shows how she feels.
import * as THREE from '../vendor/three.module.min.js';
import { toon, noOutline, makeFlower, INK } from './style.js';
import { normalizeLook } from './state.js';

export const LOOKS = {
  skin: ['#fde7d6', '#f9d7bf', '#f3c6a5', '#eab38a', '#d99c6f', '#c68642', '#b07040', '#8d5524', '#71421e', '#5c3a1e', '#4a2c17', '#3b2214'],
  hair: ['#2b2233', '#4a3226', '#7a4a2e', '#a0643c', '#c0392b', '#f2cf7e', '#f4ece0', '#ff8fbf', '#a98bff', '#4fc3ff', '#6fdcb9'],
  eyes: ['#5b3a29', '#2b2233', '#8e6b3e', '#3f8f5a', '#3a7bd5', '#7a8a99', '#8e5bd6', '#e05297', '#d9a21b'],
  shirt: ['#ffc2dc', '#ff5fa2', '#ffd93d', '#fff1a8', '#4fc3ff', '#6fdcb9', '#a98bff', '#ffffff', '#2b2233', '#ff9f43', '#ff6b6b'],
  pants: ['#a98bff', '#4a4e8f', '#2b2233', '#4fc3ff', '#ffc2dc', '#ff5fa2', '#fff1a8', '#6fdcb9', '#ffffff'],
  shoes: ['#ffffff', '#2b2233', '#ff5fa2', '#ffd93d', '#4fc3ff', '#a0643c', '#a98bff'],
  accent: ['#ff5fa2', '#ff6b6b', '#ffd93d', '#ffffff', '#2b2233', '#a98bff', '#4fc3ff', '#6fdcb9'],
  hairStyle: [['twintails', 'Twin tails'], ['long', 'Long'], ['ponytail', 'Ponytail'], ['bob', 'Bob'], ['bun', 'Bun'],
    ['spacebuns', 'Space buns'], ['braids', 'Braids'], ['curly', 'Curly puffs'], ['pixie', 'Pixie']],
  outfit: [['skirt', 'Top & skirt', '🎀'], ['dress', 'Sundress', '👗'], ['tee', 'Tee & jeans', '👖'], ['hoodie', 'Hoodie', '🧥'],
    ['overalls', 'Overalls', '🧸'], ['gym', 'Gym set', '💪'], ['pjs', 'Pajamas', '🌙']],
  shoeStyle: [['flats', 'Mary Janes'], ['sneakers', 'Sneakers'], ['boots', 'Boots']],
  acc: [['none', 'None', '🚫'], ['bow', 'Bow', '🎀'], ['flower', 'Flower clip', '🌸'], ['catears', 'Cat ears', '🐱'],
    ['bunnyears', 'Bunny ears', '🐰'], ['headphones', 'Headphones', '🎧'], ['glasses', 'Glasses', '👓'], ['stars', 'Star clips', '⭐']],
};

// Her face. 'auto' follows how you're doing.
export const FACES = [
  ['auto', '✨', 'Auto'], ['happy', '😊', 'Happy'], ['joy', '😄', 'Joyful'], ['chill', '🙂', 'Chill'], ['wink', '😜', 'Wink'],
  ['love', '🥰', 'In love'], ['starry', '🤩', 'Starry'], ['shy', '😳', 'Shy'], ['calm', '😌', 'Calm'], ['sleepy', '😪', 'Sleepy'],
  ['surprised', '😮', 'Surprised'], ['sad', '🥺', 'Sad'], ['grumpy', '😤', 'Grumpy'],
];
const EXPR = {
  happy: { eyes: 'open', brows: 'soft', mouth: 'smile', blush: 0.55 },
  joy: { eyes: 'arch', brows: 'up', mouth: 'open', blush: 0.65 },
  chill: { eyes: 'open', brows: 'soft', mouth: 'small', blush: 0.35 },
  wink: { eyeL: 'open', eyeR: 'arch', brows: 'soft', mouth: 'tongue', blush: 0.6 },
  love: { eyes: 'heart', brows: 'soft', mouth: 'open', blush: 0.9 },
  starry: { eyes: 'star', brows: 'up', mouth: 'open', blush: 0.6 },
  shy: { eyes: 'down', brows: 'worried', mouth: 'wavy', blush: 1, lines: true },
  calm: { eyes: 'closed', brows: 'soft', mouth: 'smile', blush: 0.45 },
  sleepy: { eyes: 'half', brows: 'soft', mouth: 'o', blush: 0.3 },
  surprised: { eyes: 'wide', brows: 'up', mouth: 'o', blush: 0.4 },
  sad: { eyes: 'shine', brows: 'worried', mouth: 'frown', blush: 0.4, tear: true },
  grumpy: { eyes: 'grump', brows: 'angry', mouth: 'pout', blush: 0.7 },
};
const BLINKS = new Set(['open', 'down', 'shine', 'half', 'grump', 'wide']);

const HIP = 0.7;
const HEAD_SCALE = 1.12;
const FACE_W = 1.7, FACE_H = 1.4;   // how much of the head the face drawing covers (radians)
const smooth = (cur, target, k) => cur + (target - cur) * k;
const tint = (hex, amt) => '#' + new THREE.Color(hex).lerp(new THREE.Color(amt < 0 ? '#120a14' : '#ffffff'), Math.abs(amt)).getHexString();

// ---------- the face, drawn on a canvas ----------

const faceCache = new Map();
function faceTexture(expr, eyeColor, blink) {
  const key = `${expr}|${eyeColor}|${blink}`;
  if (faceCache.has(key)) return faceCache.get(key);
  if (faceCache.size > 48) {
    const [oldKey, oldTex] = faceCache.entries().next().value;
    oldTex.dispose();
    faceCache.delete(oldKey);
  }
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  drawFace(c.getContext('2d'), EXPR[expr] || EXPR.happy, eyeColor, blink);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  faceCache.set(key, t);
  return t;
}

function drawFace(g, f, eyeColor, blink) {
  const L = 160, R = 352, EY = 282, MY = 394, BY = 196, EYE_SCALE = 1.22;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // blush
  for (const x of [106, 406]) {
    const gr = g.createRadialGradient(x, 356, 4, x, 356, 50);
    gr.addColorStop(0, `rgba(255, 110, 150, ${0.7 * f.blush})`);
    gr.addColorStop(1, 'rgba(255, 110, 150, 0)');
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(x, 356, 54, 34, 0, 0, Math.PI * 2); g.fill();
    if (f.lines) {
      g.strokeStyle = 'rgba(240, 80, 130, 0.85)'; g.lineWidth = 5;
      for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(x + i * 16 - 6, 366); g.lineTo(x + i * 16 + 6, 346); g.stroke(); }
    }
  }
  // brows
  g.strokeStyle = INK; g.lineWidth = 8;
  for (const [x, s] of [[L, -1], [R, 1]]) {
    const outer = x + s * 30, inner = x - s * 26;
    g.beginPath();
    if (f.brows === 'angry') { g.lineWidth = 10; g.moveTo(outer, BY - 12); g.lineTo(inner, BY + 12); }
    else if (f.brows === 'worried') { g.moveTo(outer, BY + 8); g.quadraticCurveTo(x, BY - 2, inner, BY - 16); }
    else { const y = f.brows === 'up' ? BY - 20 : BY; g.moveTo(outer, y + 4); g.quadraticCurveTo(x, y - 10, inner, y + 4); }
    g.stroke();
  }
  // eyes
  for (const [x, s] of [[L, -1], [R, 1]]) {
    let kind = (s < 0 ? f.eyeL : f.eyeR) || f.eyes;
    if (blink && BLINKS.has(kind)) kind = 'blink';
    g.save();
    g.translate(x, EY); g.scale(EYE_SCALE, EYE_SCALE); g.translate(-x, -EY);
    drawEye(g, kind, x, EY, s, eyeColor);
    g.restore();
  }
  if (f.tear) {
    g.fillStyle = '#8fdcff'; g.strokeStyle = INK; g.lineWidth = 4;
    g.beginPath(); g.moveTo(L + 30, EY + 62); g.quadraticCurveTo(L + 12, EY + 92, L + 30, EY + 100); g.quadraticCurveTo(L + 48, EY + 92, L + 30, EY + 62);
    g.fill(); g.stroke();
  }
  drawMouth(g, f.mouth, 256, MY);
}

function ellipse(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); }

function openEye(g, x, y, s, color, { look = 0, shine = false, lid = 0, slant = 0 } = {}) {
  const rx = 44, ry = 56;
  g.save();
  if (lid) { // a lid covering the top of the eye (sleepy or grumpy)
    g.beginPath();
    g.moveTo(x - 70, y - ry + lid - slant * s * -1);
    g.lineTo(x + 70, y - ry + lid + slant * s * -1);
    g.lineTo(x + 70, y + 80); g.lineTo(x - 70, y + 80); g.closePath();
    g.clip();
  }
  g.fillStyle = INK; ellipse(g, x, y, rx, ry); g.fill();
  const gr = g.createLinearGradient(0, y - ry, 0, y + ry);
  gr.addColorStop(0, tint(color, -0.55)); gr.addColorStop(0.55, color); gr.addColorStop(1, tint(color, 0.45));
  g.fillStyle = gr; ellipse(g, x, y + 4, rx - 7, ry - 9); g.fill();
  g.fillStyle = tint(color, -0.75); ellipse(g, x, y + 8 + look, 17, 24); g.fill();
  g.fillStyle = '#ffffff';
  ellipse(g, x - 14, y - 20 + look, shine ? 19 : 15, shine ? 21 : 17); g.fill();
  ellipse(g, x + 16, y + 20 + look, shine ? 10 : 7, shine ? 10 : 7); g.fill();
  if (shine) { ellipse(g, x + 18, y - 8, 6, 6); g.fill(); }
  g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 4;
  g.beginPath(); g.arc(x, y + 6, 26, Math.PI * 0.2, Math.PI * 0.8); g.stroke();
  g.restore();
  // lashes
  g.strokeStyle = INK; g.lineWidth = 12;
  if (lid) {
    g.beginPath(); g.moveTo(x - rx - 2, y - ry + lid - slant * s * -1); g.lineTo(x + rx + 2, y - ry + lid + slant * s * -1); g.stroke();
  } else {
    g.beginPath(); g.ellipse(x, y + 4, rx + 3, ry + 2, 0, Math.PI * 1.06, Math.PI * 1.94); g.stroke();
  }
  const ox = x + s * (rx + 2), oy = y - 22 + (lid ? lid * 0.6 : 0);
  g.lineWidth = 8;
  g.beginPath(); g.moveTo(ox - s * 6, oy + 6); g.lineTo(ox + s * 16, oy - 10); g.stroke();
  g.lineWidth = 6;
  g.beginPath(); g.moveTo(ox - s * 2, oy + 22); g.lineTo(ox + s * 14, oy + 14); g.stroke();
}

function drawEye(g, kind, x, y, s, color) {
  g.strokeStyle = INK;
  switch (kind) {
    case 'open': return openEye(g, x, y, s, color);
    case 'down': return openEye(g, x, y, s, color, { look: 10 });
    case 'shine': return openEye(g, x, y, s, color, { shine: true, look: -4 });
    case 'half': return openEye(g, x, y, s, color, { lid: 50 });
    case 'grump': return openEye(g, x, y, s, color, { lid: 40, slant: 14 });
    case 'wide': {
      g.fillStyle = '#ffffff'; g.lineWidth = 7; ellipse(g, x, y, 40, 50); g.fill(); g.stroke();
      g.fillStyle = color; ellipse(g, x, y + 4, 19, 21); g.fill();
      g.fillStyle = INK; ellipse(g, x, y + 4, 9, 10); g.fill();
      g.fillStyle = '#ffffff'; ellipse(g, x - 6, y - 4, 5, 5); g.fill();
      return;
    }
    case 'arch': // happy ^ ^
      g.lineWidth = 11; g.beginPath(); g.moveTo(x - 38, y + 14); g.quadraticCurveTo(x, y - 36, x + 38, y + 14); g.stroke();
      return;
    case 'closed': // peaceful, or asleep
      g.lineWidth = 10; g.beginPath(); g.moveTo(x - 38, y); g.quadraticCurveTo(x, y + 28, x + 38, y); g.stroke();
      g.lineWidth = 6; g.beginPath(); g.moveTo(x + s * 36, y + 2); g.lineTo(x + s * 48, y - 8); g.stroke();
      return;
    case 'blink':
      g.lineWidth = 10; g.beginPath(); g.moveTo(x - 40, y + 6); g.quadraticCurveTo(x, y + 18, x + 40, y + 6); g.stroke();
      return;
    case 'heart': {
      const sz = 48;
      g.beginPath();
      g.moveTo(x, y + sz * 0.9);
      g.bezierCurveTo(x - sz * 1.35, y + sz * 0.05, x - sz * 0.9, y - sz * 1.0, x, y - sz * 0.35);
      g.bezierCurveTo(x + sz * 0.9, y - sz * 1.0, x + sz * 1.35, y + sz * 0.05, x, y + sz * 0.9);
      g.closePath();
      g.fillStyle = '#ff4f8b'; g.fill(); g.lineWidth = 6; g.stroke();
      g.fillStyle = '#ffffff'; ellipse(g, x - 18, y - 16, 9, 7); g.fill();
      return;
    }
    case 'star': {
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 22 : 52;
        g.lineTo(x + Math.cos(a) * r, y + 4 + Math.sin(a) * r);
      }
      g.closePath();
      g.fillStyle = '#ffd93d'; g.fill(); g.lineWidth = 6; g.stroke();
      g.fillStyle = '#ffffff'; ellipse(g, x - 10, y - 8, 7, 6); g.fill();
      return;
    }
  }
}

function drawMouth(g, kind, x, y) {
  g.strokeStyle = INK; g.lineWidth = 8;
  const dark = '#7a2941', tongue = '#ff8fab';
  g.beginPath();
  switch (kind) {
    case 'smile': g.moveTo(x - 26, y - 4); g.quadraticCurveTo(x, y + 20, x + 26, y - 4); g.stroke(); break;
    case 'small': g.moveTo(x - 14, y); g.quadraticCurveTo(x, y + 9, x + 14, y); g.stroke(); break;
    case 'frown': g.moveTo(x - 22, y + 12); g.quadraticCurveTo(x, y - 8, x + 22, y + 12); g.stroke(); break;
    case 'wavy':
      g.lineWidth = 7; g.moveTo(x - 30, y + 4);
      for (let i = 0; i < 4; i++) g.quadraticCurveTo(x - 30 + i * 15 + 7.5, y + (i % 2 ? 12 : -4), x - 30 + (i + 1) * 15, y + 4);
      g.stroke(); break;
    case 'pout':
      g.lineWidth = 7; g.moveTo(x - 6, y - 12); g.quadraticCurveTo(x + 12, y - 6, x - 2, y); g.quadraticCurveTo(x + 12, y + 6, x - 6, y + 12); g.stroke(); break;
    case 'o':
      g.ellipse(x, y + 6, 13, 16, 0, 0, Math.PI * 2); g.fillStyle = dark; g.fill(); g.lineWidth = 6; g.stroke(); break;
    case 'tongue':
      g.moveTo(x - 26, y - 4); g.quadraticCurveTo(x, y + 20, x + 26, y - 4); g.stroke();
      g.beginPath(); g.ellipse(x + 8, y + 14, 10, 10, 0, 0, Math.PI); g.fillStyle = tongue; g.fill(); g.lineWidth = 5; g.stroke(); break;
    case 'open': {
      g.moveTo(x - 30, y - 8); g.quadraticCurveTo(x, y - 12, x + 30, y - 8);
      g.quadraticCurveTo(x + 26, y + 38, x, y + 38); g.quadraticCurveTo(x - 26, y + 38, x - 30, y - 8);
      g.closePath(); g.fillStyle = dark; g.fill();
      g.save(); g.clip(); g.fillStyle = tongue; ellipse(g, x, y + 36, 20, 14); g.fill(); g.restore();
      g.lineWidth = 6; g.stroke(); break;
    }
  }
}

// ---------- the character ----------

export function createAvatar(look) {
  const grad = toon('#ffffff').gradientMap;
  const mat = color => { const x = new THREE.MeshToonMaterial({ color, gradientMap: grad }); return x; };
  const m = {
    skin: mat('#ffffff'), hair: mat('#ffffff'), fringe: noOutline(mat('#ffffff')), top: mat('#ffffff'), bottom: mat('#ffffff'),
    shoes: mat('#ffffff'), socks: mat('#ffffff'), accent: mat('#ffffff'), white: mat('#ffffff'), inner: mat('#ffb3cf'),
  };
  m.top.side = m.bottom.side = THREE.DoubleSide;   // skirts are open cones
  const faceMat = noOutline(new THREE.MeshToonMaterial({ gradientMap: grad, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  let L = normalizeLook(look);

  const mesh = (geo, material, x, y, z, parent, shadow = true) => {
    const o = new THREE.Mesh(geo, material);
    o.position.set(x, y, z);
    o.castShadow = shadow;
    parent.add(o);
    return o;
  };
  const pivot = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 14);
  const sphere = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);

  const root = new THREE.Group();     // world position + facing
  const body = pivot(root, 0, 0, 0);  // pose offsets, lean, bob

  // legs: thigh pivot at the hip, shin pivot at the knee
  const legs = [-0.09, 0.09].map(x => {
    const thigh = pivot(body, x, HIP, 0);
    const thighMesh = mesh(capsule(0.068, 0.22), m.skin, 0, -0.18, 0, thigh);
    const shin = pivot(thigh, 0, -0.34, 0);
    const shinMesh = mesh(capsule(0.058, 0.2), m.skin, 0, -0.15, 0, shin);
    const foot = mesh(sphere(0.095), m.shoes, 0, -0.32, 0.04, shin);
    return { thigh, shin, thighMesh, shinMesh, foot };
  });

  const torso = pivot(body, 0, HIP, 0);
  const hips = mesh(sphere(0.17, 20, 14), m.bottom, 0, 0.04, 0, torso);
  hips.scale.set(1, 0.6, 0.82);
  const chest = mesh(capsule(0.16, 0.2), m.top, 0, 0.28, 0, torso);
  chest.scale.set(1, 1, 0.78);
  mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 12), m.skin, 0, 0.56, 0, torso);
  const outfit = pivot(torso, 0, 0, 0);

  const head = pivot(torso, 0, 0.6, 0);
  head.scale.setScalar(HEAD_SCALE);
  const skull = mesh(sphere(0.27, 32, 24), m.skin, 0, 0.2, 0, head);
  skull.scale.set(1, 0.95, 0.95);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.2735, 36, 28, Math.PI / 2 - FACE_W / 2, FACE_W, Math.PI / 2 - FACE_H / 2, FACE_H), faceMat);
  face.renderOrder = 2;
  skull.add(face);
  for (const s of [-1, 1]) mesh(sphere(0.045, 10, 8), m.skin, s * 0.262, 0.17, 0, head);
  const hair = pivot(head, 0, 0.2, 0);
  const acc = pivot(head, 0, 0, 0);

  const arms = [-1, 1].map(s => {
    const shoulder = pivot(torso, s * 0.22, 0.46, 0);
    const upper = mesh(capsule(0.055, 0.16), m.top, 0, -0.12, 0, shoulder);
    const puff = mesh(sphere(0.085), m.top, 0, -0.04, 0, shoulder);
    const elbow = pivot(shoulder, 0, -0.26, 0);
    const lower = mesh(capsule(0.05, 0.12), m.skin, 0, -0.09, 0, elbow);
    mesh(sphere(0.06, 12, 10), m.skin, 0, -0.2, 0, elbow);
    return { shoulder, elbow, upper, lower, puff, side: s };
  });

  // Sims-style mood gem
  const gemMat = new THREE.MeshToonMaterial({ color: '#3ddc84', emissive: '#3ddc84', emissiveIntensity: 0.5, gradientMap: grad });
  const gem = mesh(new THREE.OctahedronGeometry(0.11), gemMat, 0, 2.3, 0, root, false);
  gem.scale.y = 1.7;
  let gemBase = 2.3;

  // ---------- hair ----------
  let swaying = [];   // tails and braids that swing as she moves
  function buildHair(style) {
    hair.clear();
    swaying = [];
    // crown all round, then back and sides reaching lower, so her face stays clear
    const cap = (r, thetaLen) => {
      mesh(new THREE.SphereGeometry(r, 32, 10, 0, Math.PI * 2, 0, Math.PI * 0.3), m.hair, 0, 0, -0.012, hair);
      mesh(new THREE.SphereGeometry(r, 32, 18, Math.PI - 0.55, Math.PI + 1.1, 0, thetaLen), m.hair, 0, 0, -0.012, hair);
    };
    const bangs = (n = 5) => {
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1) - 0.5;
        const b = mesh(sphere(0.075, 14, 10), m.fringe, t * 0.36, 0.135 - Math.abs(t) * 0.1, 0.205 - Math.abs(t) * 0.07, hair);
        b.scale.set(1.05, 0.7, 0.55);
        b.rotation.z = t * 0.6;
      }
    };
    const sideLocks = len => { for (const s of [-1, 1]) mesh(capsule(0.05, len), m.hair, s * 0.235, -0.02 - len / 2, 0.07, hair); };
    const tail = (x, y, z, len, tilt, r = 0.075) => {
      const p = pivot(hair, x, y, z);
      mesh(capsule(r, len), m.hair, 0, -len / 2 - 0.04, 0, p);
      mesh(new THREE.TorusGeometry(r * 0.75, 0.018, 8, 16), m.accent, 0, -0.01, 0, p).rotation.x = Math.PI / 2;
      swaying.push({ p, rest: 0.15, restZ: tilt });
      return p;
    };

    if (style === 'pixie') {
      cap(0.279, Math.PI * 0.55);
      for (const [x, y, z, r] of [[-0.12, 0.13, 0.2, 0.08], [0.02, 0.15, 0.21, 0.085], [0.14, 0.11, 0.19, 0.07]]) {
        mesh(sphere(r, 14, 10), m.fringe, x, y, z, hair).scale.set(1.3, 0.62, 0.55);
      }
      return;
    }
    cap(0.285, Math.PI * 0.6);
    bangs();
    if (style === 'long') {
      mesh(capsule(0.2, 0.34), m.hair, 0, -0.26, -0.12, hair).scale.set(1.3, 1, 0.6);
      sideLocks(0.3);
    } else if (style === 'twintails') {
      sideLocks(0.14);
      tail(-0.27, 0.12, -0.06, 0.38, -0.45);
      tail(0.27, 0.12, -0.06, 0.38, 0.45);
    } else if (style === 'ponytail') {
      sideLocks(0.12);
      tail(0, 0.08, -0.27, 0.36, 0);
      swaying.at(-1).rest = 0.45;
    } else if (style === 'bob') {
      mesh(sphere(0.25, 24, 16), m.hair, 0, -0.05, -0.1, hair).scale.set(1.12, 0.9, 0.85);
      for (const s of [-1, 1]) mesh(capsule(0.065, 0.1), m.hair, s * 0.23, -0.1, 0.05, hair);
    } else if (style === 'bun') {
      sideLocks(0.12);
      mesh(sphere(0.12), m.hair, 0, 0.26, -0.12, hair);
      mesh(new THREE.TorusGeometry(0.09, 0.018, 8, 18), m.accent, 0, 0.21, -0.1, hair).rotation.x = 1.1;
    } else if (style === 'spacebuns') {
      sideLocks(0.12);
      for (const s of [-1, 1]) {
        mesh(sphere(0.1), m.hair, s * 0.17, 0.25, -0.04, hair);
        mesh(new THREE.TorusGeometry(0.075, 0.016, 8, 16), m.accent, s * 0.15, 0.2, -0.03, hair).rotation.set(1.2, 0, -s * 0.5);
      }
    } else if (style === 'braids') {
      mesh(capsule(0.18, 0.08), m.hair, 0, -0.12, -0.13, hair).scale.set(1.25, 1, 0.6);
      for (const s of [-1, 1]) {
        const p = pivot(hair, s * 0.22, -0.08, -0.02);
        for (let i = 0; i < 5; i++) mesh(sphere(0.062 - i * 0.005, 12, 10), m.hair, 0, -i * 0.075, i * 0.02, p);
        mesh(sphere(0.03, 10, 8), m.accent, 0, -0.37, 0.1, p);
        swaying.push({ p, rest: 0.05, restZ: 0 });
      }
    } else if (style === 'curly') {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        mesh(sphere(0.085, 10, 8), m.hair, Math.cos(a) * 0.24, 0.06 + (i % 2) * 0.06, Math.sin(a) * 0.24 - 0.03, hair);
      }
      mesh(sphere(0.2), m.hair, 0, 0.15, -0.03, hair);
      for (const s of [-1, 1]) mesh(sphere(0.14, 14, 10), m.hair, s * 0.2, 0.28, -0.05, hair);
    }
  }

  // ---------- accessories ----------
  function buildAcc(kind) {
    acc.clear();
    gemBase = kind === 'bunnyears' ? 2.55 : 2.3;
    const g = pivot(acc, 0, 0, 0);
    if (kind === 'bow') {
      g.position.set(0.17, 0.45, 0.04); g.rotation.z = -0.4;
      for (const s of [-1, 1]) { const loop = mesh(sphere(0.08), m.accent, s * 0.08, 0, 0, g); loop.scale.set(1.1, 0.75, 0.45); loop.rotation.z = s * 0.3; }
      mesh(sphere(0.035, 10, 8), m.accent, 0, 0, 0.02, g);
    } else if (kind === 'flower') {
      const f = makeFlower({ size: 0.24, stem: 0, petals: 8, colors: [L.accent, tint(L.accent, 0.4)] });
      f.group.position.set(0.2, 0.38, 0.13); f.group.rotation.set(-0.2, 0.7, -0.2);
      g.add(f.group);
    } else if (kind === 'catears' || kind === 'bunnyears') {
      for (const s of [-1, 1]) {
        const e = pivot(g, s * (kind === 'catears' ? 0.15 : 0.09), kind === 'catears' ? 0.45 : 0.6, -0.03);
        if (kind === 'catears') {
          e.rotation.z = -s * 0.35;
          mesh(new THREE.ConeGeometry(0.075, 0.15, 16), m.accent, 0, 0, 0, e);
          mesh(new THREE.ConeGeometry(0.045, 0.1, 12), m.inner, 0, -0.01, 0.035, e, false);
        } else {
          e.rotation.z = -s * 0.15;
          mesh(capsule(0.05, 0.22), m.accent, 0, 0, 0, e).scale.z = 0.5;
          mesh(capsule(0.028, 0.18), m.inner, 0, 0, 0.022, e, false).scale.z = 0.4;
        }
      }
    } else if (kind === 'headphones') {
      g.position.y = 0.2;
      mesh(new THREE.TorusGeometry(0.3, 0.025, 8, 28, Math.PI), m.accent, 0, 0, 0, g);
      for (const s of [-1, 1]) mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 18), m.accent, s * 0.29, 0, 0, g).rotation.z = Math.PI / 2;
    } else if (kind === 'glasses') {
      for (const s of [-1, 1]) mesh(new THREE.TorusGeometry(0.06, 0.009, 8, 24), m.accent, s * 0.085, 0.176, 0.272, g, false);
      mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.05, 6), m.accent, 0, 0.18, 0.276, g, false).rotation.z = Math.PI / 2;
    } else if (kind === 'stars') {
      const shape = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.022 : 0.05;
        if (i) shape.lineTo(Math.cos(a) * r, Math.sin(a) * r); else shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
      for (const [x, y, z, ry] of [[0.2, 0.37, 0.14, 0.7], [0.12, 0.42, 0.18, 0.4]]) mesh(geo, m.accent, x, y, z, g).rotation.y = ry;
    }
  }

  // ---------- outfits ----------
  function buildOutfit(kind, shoeStyle) {
    outfit.clear();
    const set = (meshes, material) => meshes.forEach(x => { x.material = material; });
    const thighs = legs.map(l => l.thighMesh), shins = legs.map(l => l.shinMesh);
    const uppers = arms.map(a => a.upper), lowers = arms.map(a => a.lower), puffs = arms.map(a => a.puff);
    set(uppers, m.top); set(lowers, m.skin); set(thighs, m.bottom); set(shins, m.bottom);
    puffs.forEach(p => { p.visible = false; });
    hips.material = m.bottom;
    chest.material = m.top;
    const skirt = (len, r0, r1, material) => {
      const s = mesh(new THREE.CylinderGeometry(r0, r1, len, 20, 1, true), material, 0, 0.1 - len / 2, 0, outfit);
      return s;
    };
    const collar = () => { const c = mesh(new THREE.TorusGeometry(0.075, 0.025, 8, 20), m.white, 0, 0.53, 0.01, outfit); c.rotation.x = Math.PI / 2; };
    if (kind === 'skirt') {
      puffs.forEach(p => { p.visible = true; });
      set(thighs, m.skin); set(shins, m.socks);
      skirt(0.26, 0.165, 0.3, m.bottom);
    } else if (kind === 'dress') {
      set(uppers, m.skin); set(thighs, m.skin); set(shins, m.skin);
      hips.material = m.top;
      skirt(0.42, 0.15, 0.34, m.top);
      collar();
    } else if (kind === 'hoodie') {
      set(lowers, m.top);
      const hood = mesh(new THREE.TorusGeometry(0.13, 0.05, 10, 20), m.top, 0, 0.52, -0.06, outfit);
      hood.rotation.x = Math.PI / 2 - 0.5;
      for (const s of [-1, 1]) mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 6), m.white, s * 0.04, 0.4, 0.13, outfit, false);
      mesh(new THREE.BoxGeometry(0.18, 0.08, 0.02), m.top, 0, 0.16, 0.13, outfit);
    } else if (kind === 'overalls') {
      set(lowers, m.skin);
      const bib = mesh(new THREE.BoxGeometry(0.2, 0.18, 0.04), m.bottom, 0, 0.2, 0.115, outfit);
      bib.rotation.x = -0.08;
      for (const s of [-1, 1]) {
        const strap = mesh(new THREE.BoxGeometry(0.035, 0.28, 0.02), m.bottom, s * 0.08, 0.38, 0.06, outfit);
        strap.rotation.x = -0.5;
        mesh(sphere(0.018, 8, 6), m.accent, s * 0.075, 0.27, 0.14, outfit, false);
      }
    } else if (kind === 'gym') {
      set(uppers, m.skin); set(thighs, m.skin); set(shins, m.skin);
      mesh(new THREE.CylinderGeometry(0.165, 0.17, 0.05, 20), m.white, 0, 0.1, 0, outfit);
    } else if (kind === 'pjs') {
      set(lowers, m.top);
      collar();
      for (let i = 0; i < 3; i++) mesh(sphere(0.016, 8, 6), m.white, 0, 0.42 - i * 0.1, 0.13, outfit, false);
    }
    // shoes
    legs.forEach(l => {
      if (shoeStyle === 'boots') { l.shinMesh.material = m.shoes; l.foot.scale.set(0.95, 0.62, 1.35); }
      else if (shoeStyle === 'sneakers') l.foot.scale.set(0.9, 0.58, 1.4);
      else l.foot.scale.set(0.78, 0.45, 1.22);
    });
  }

  function setLook(look) {
    L = normalizeLook(look);
    m.skin.color.set(L.skin);
    m.hair.color.set(L.hair);
    m.fringe.color.set(L.hair);
    m.top.color.set(L.shirt);
    m.bottom.color.set(L.pants);
    m.shoes.color.set(L.shoes);
    m.accent.color.set(L.accent);
    m.socks.color.set(L.outfit === 'skirt' ? '#ffffff' : L.pants);
    buildHair(L.hairStyle);
    buildAcc(L.acc);
    buildOutfit(L.outfit, L.shoeStyle);
    shown = '';
  }

  // ---------- feelings ----------
  let autoExpr = 'happy', preview = null, previewT = 0, flashT = 0, shown = '';
  function setFace(expr, blink) {
    const key = expr + blink + L.eyes;
    if (key === shown) return;
    shown = key;
    faceMat.map = faceTexture(expr, L.eyes, blink);
    faceMat.needsUpdate = true;
  }
  // Called with your mood score (0-100) and energy, so "Auto" can match how you're doing.
  function setMoodColor(score, energy = 100) {
    const c = score >= 60 ? '#3ddc84' : score >= 35 ? '#ffd93d' : '#ff5c7a';
    gemMat.color.set(c);
    gemMat.emissive.set(c);
    autoExpr = energy < 25 ? 'sleepy' : score >= 55 ? 'happy' : score >= 35 ? 'chill' : 'sad';
    moodScore = score;
  }
  let moodScore = 70;
  // Show an expression for a few seconds (for example while trying faces on).
  function showFace(expr, secs = 2.5) { preview = expr; previewT = secs; }

  setLook(look);

  // ---------- animation ----------

  let pose = 'idle';
  let phase = 0, walkW = 0, runW = 0, blinkT = 2 + Math.random() * 3, cheerT = 0, joyT = 8;
  const J = { // current joint values, smoothed toward targets every frame
    bodyY: 0, bodyX: 0, bodyZ: 0, bodyPitch: 0, lean: 0, bank: 0,
    thighL: 0, thighR: 0, shinL: 0, shinR: 0, armL: 0, armR: 0, armZL: 0, armZR: 0, elbowL: 0, elbowR: 0,
    headY: 0, headX: 0,
  };

  function setPose(p) { pose = p; }
  function cheer() { cheerT = 0.9; flashT = 1.6; }

  function update(dt, t, speed = 0, turnRate = 0) {
    const k = 1 - Math.exp(-dt * 12);
    const fast = 1 - Math.exp(-dt * 22);
    if (pose === 'run') speed = 3.4;
    walkW = smooth(walkW, Math.min(1, speed / 1.0), 1 - Math.exp(-dt * 8));
    runW = smooth(runW, THREE.MathUtils.clamp((speed - 2.6) / 0.9, 0, 1), 1 - Math.exp(-dt * 6));
    phase += dt * (2.2 + speed * 2.4);

    // targets for the base pose
    const T = { bodyY: 0, bodyX: 0, bodyZ: 0, bodyPitch: 0, lean: 0, bank: 0, thighL: 0, thighR: 0, shinL: 0, shinR: 0,
      armL: 0, armR: 0, armZL: 0.1, armZR: -0.1, elbowL: -0.1, elbowR: -0.1, headY: 0, headX: 0 };
    const idleBreath = Math.sin(t * 2);
    if (pose === 'sit' || pose === 'meditate') {
      T.bodyY = -(HIP - 0.06);
      T.thighL = T.thighR = -Math.PI / 2;
      T.shinL = T.shinR = pose === 'meditate' ? Math.PI / 2 + 0.7 : Math.PI / 2;
      T.armL = T.armR = pose === 'meditate' ? -0.4 : -0.55;
      T.elbowL = T.elbowR = pose === 'meditate' ? -0.3 : -0.6;
      if (pose === 'meditate') { T.armZL = 0.5; T.armZR = -0.5; T.headX = 0.12; T.bodyY += Math.sin(t) * 0.008; }
      T.headY = Math.sin(t * 0.4) * 0.15;
    } else if (pose === 'lie') {
      T.bodyPitch = -Math.PI / 2;
      T.bodyY = 0.14;
      T.armZL = 0.25; T.armZR = -0.25;
      T.headY = Math.sin(t * 0.3) * 0.25;
      T.bodyY += Math.sin(t * 1.2) * 0.006;
    } else {
      // idle with gentle breathing and looking around (a little head tilt, because cute)
      T.bodyY = idleBreath * 0.006;
      T.headY = Math.sin(t * 0.5) * 0.3 * Math.max(0, Math.sin(t * 0.17));
      T.headX = Math.sin(t * 0.7) * 0.04;
      T.armZL = 0.1 + idleBreath * 0.02; T.armZR = -0.1 - idleBreath * 0.02;
    }

    // locomotion layer, blended in by walk weight
    if (walkW > 0.01 && (pose === 'idle' || pose === 'run')) {
      const amp = 0.5 + runW * 0.4;
      const s = Math.sin(phase), c = Math.cos(phase);
      const w = walkW;
      T.thighL = THREE.MathUtils.lerp(T.thighL, s * amp, w);
      T.thighR = THREE.MathUtils.lerp(T.thighR, -s * amp, w);
      T.shinL = THREE.MathUtils.lerp(T.shinL, Math.max(0, -Math.sin(phase - 0.9)) * amp * 1.5, w);
      T.shinR = THREE.MathUtils.lerp(T.shinR, Math.max(0, Math.sin(phase - 0.9)) * amp * 1.5, w);
      T.armL = THREE.MathUtils.lerp(T.armL, -s * amp * 0.85, w);
      T.armR = THREE.MathUtils.lerp(T.armR, s * amp * 0.85, w);
      T.elbowL = T.elbowR = THREE.MathUtils.lerp(-0.1, -0.35 - runW * 0.9, w);
      T.bodyY += Math.abs(c) * (0.035 + runW * 0.04) * w;
      T.lean = (0.06 + runW * 0.14) * w;
      T.bank = THREE.MathUtils.clamp(-turnRate * 0.04, -0.15, 0.15) * w;
      T.headY *= 1 - w;
    }

    // happy hop when you earn something
    if (cheerT > 0) {
      cheerT -= dt;
      const p = 1 - cheerT / 0.9;
      T.bodyY += Math.max(0, Math.sin(p * Math.PI * 2)) * 0.18;
      T.armL = T.armR = -2.6;
      T.armZL = 0.35; T.armZR = -0.35;
      T.elbowL = T.elbowR = -0.2;
    }

    for (const key in J) J[key] = smooth(J[key], T[key], key.startsWith('thigh') || key.startsWith('shin') || key.startsWith('arm') ? fast : k);

    body.position.y = J.bodyY;
    body.rotation.x = J.bodyPitch;
    torso.rotation.x = J.lean;
    torso.rotation.z = J.bank;
    legs[0].thigh.rotation.x = J.thighL; legs[1].thigh.rotation.x = J.thighR;
    legs[0].shin.rotation.x = J.shinL; legs[1].shin.rotation.x = J.shinR;
    arms[0].shoulder.rotation.x = J.armL; arms[1].shoulder.rotation.x = J.armR;
    arms[0].shoulder.rotation.z = J.armZL; arms[1].shoulder.rotation.z = J.armZR;
    arms[0].elbow.rotation.x = J.elbowL; arms[1].elbow.rotation.x = J.elbowR;
    head.rotation.y = J.headY;
    head.rotation.x = J.headX - J.lean * 0.6;
    head.rotation.z = walkW < 0.1 && pose === 'idle' ? Math.sin(t * 0.6) * 0.06 : 0;
    torso.scale.y = 1 + idleBreath * 0.008;
    for (const sw of swaying) {
      sw.p.rotation.x = sw.rest + J.lean * 2 + Math.sin(phase * 2) * 0.14 * walkW;
      sw.p.rotation.z = sw.restZ + Math.sin(phase) * 0.08 * walkW + J.bank * 0.8;
    }

    // which face?
    previewT -= dt; flashT -= dt; joyT -= dt;
    if (joyT < 0) { joyT = 9 + Math.random() * 8; if (moodScore >= 75) flashT = 1.4; }
    let expr = L.face && L.face !== 'auto' ? L.face : autoExpr;
    if (L.face === 'auto' && flashT > 0) expr = 'joy';
    if (pose === 'lie' || pose === 'meditate') expr = 'calm';
    if (cheerT > 0) expr = 'joy';
    if (previewT > 0 && preview) expr = preview;
    blinkT -= dt;
    if (blinkT < -0.13) blinkT = 2 + Math.random() * 4;
    setFace(expr, blinkT < 0);

    gem.rotation.y += dt * 1.5;
    const gemY = pose === 'lie' ? 1.25 : pose === 'sit' || pose === 'meditate' ? gemBase - 0.6 : gemBase;
    gem.position.y = smooth(gem.position.y, gemY + Math.sin(t * 2) * 0.04, k);
  }

  return { root, setLook, setPose, update, setMoodColor, showFace, cheer, get pose() { return pose; } };
}
