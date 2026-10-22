// The player's character ("the pet"): a cute, rounded figure with smooth blended animation.
import * as THREE from 'three';
import { toon, noOutline } from './style.js';

export const LOOKS = {
  skin: ['#ffe0c7', '#f6c9a0', '#e5ac7c', '#c68642', '#8d5524', '#5c3a1e'],
  hair: ['#2b2233', '#5a3a2e', '#a0643c', '#f2cf7e', '#f4ece0', '#ff8fbf', '#a98bff', '#4fc3ff', '#6fdcb9'],
  hairStyle: ['short', 'long', 'bun', 'curly', 'ponytail', 'buzz'],
  shirt: ['#ff5fa2', '#ffd93d', '#4fc3ff', '#6fdcb9', '#a98bff', '#ffffff', '#2b2233', '#ff9f43', '#ffc2dc', '#ff6b6b'],
  pants: ['#4a4e8f', '#2b2233', '#a98bff', '#4fc3ff', '#ffc2dc', '#fff1a8', '#6fdcb9'],
  shoes: ['#ffffff', '#2b2233', '#ff5fa2', '#ffd93d', '#4fc3ff'],
};

const HIP = 0.7;
const smooth = (cur, target, k) => cur + (target - cur) * k;

export function createAvatar(look) {
  const m = {
    skin: new THREE.MeshToonMaterial(), hair: new THREE.MeshToonMaterial(), shirt: new THREE.MeshToonMaterial(),
    pants: new THREE.MeshToonMaterial(), shoes: new THREE.MeshToonMaterial(), fringe: new THREE.MeshToonMaterial(),
  };
  noOutline(m.fringe);
  const grad = toon('#ffffff').gradientMap;
  for (const k in m) m[k].gradientMap = grad;
  const dark = toon('#2b2233');
  const white = toon('#ffffff', { outline: false });
  const blushMat = noOutline(new THREE.MeshBasicMaterial({ color: '#ff7aa8', transparent: true, opacity: 0.55, depthWrite: false }));

  const mesh = (geo, mat, x, y, z, parent, shadow = true) => {
    const o = new THREE.Mesh(geo, mat);
    o.position.set(x, y, z);
    o.castShadow = shadow;
    parent.add(o);
    return o;
  };
  const pivot = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 14);

  const root = new THREE.Group();     // world position + facing
  const body = pivot(root, 0, 0, 0);  // pose offsets, lean, bob

  // legs: thigh pivot at the hip, shin pivot at the knee
  const legs = [-0.1, 0.1].map(x => {
    const thigh = pivot(body, x, HIP, 0);
    mesh(capsule(0.078, 0.22), m.pants, 0, -0.18, 0, thigh);
    const shin = pivot(thigh, 0, -0.34, 0);
    mesh(capsule(0.07, 0.2), m.pants, 0, -0.15, 0, shin);
    const foot = mesh(new THREE.SphereGeometry(0.1, 16, 12), m.shoes, 0, -0.32, 0.04, shin);
    foot.scale.set(0.85, 0.55, 1.35);
    return { thigh, shin };
  });

  const torso = pivot(body, 0, HIP, 0);
  mesh(new THREE.SphereGeometry(0.19, 20, 14), m.pants, 0, 0.04, 0, torso).scale.set(1, 0.6, 0.82);
  const chest = mesh(capsule(0.19, 0.2), m.shirt, 0, 0.28, 0, torso);
  chest.scale.set(1, 1, 0.8);
  mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 12), m.skin, 0, 0.56, 0, torso);

  const head = pivot(torso, 0, 0.62, 0);
  mesh(new THREE.SphereGeometry(0.27, 32, 24), m.skin, 0, 0.2, 0, head).scale.set(1, 0.95, 0.95);
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.05, 10, 8), m.skin, s * 0.265, 0.17, 0, head);
  const eyes = [-1, 1].map(s => {
    const e = pivot(head, s * 0.1, 0.2, 0.232);
    mesh(new THREE.SphereGeometry(0.05, 16, 12), dark, 0, 0, 0, e, false).scale.set(0.9, 1.3, 0.5);
    mesh(new THREE.SphereGeometry(0.017, 8, 6), white, -0.014, 0.026, 0.022, e, false);
    mesh(new THREE.SphereGeometry(0.008, 6, 6), white, 0.014, -0.016, 0.022, e, false);
    return e;
  });
  for (const s of [-1, 1]) {
    const b = mesh(new THREE.CircleGeometry(0.048, 18), blushMat, s * 0.16, 0.1, 0.225, head, false);
    b.rotation.y = s * 0.55;
    b.scale.y = 0.6;
  }
  const smile = mesh(new THREE.TorusGeometry(0.035, 0.009, 6, 16, Math.PI), toon('#2b2233', { outline: false }), 0, 0.09, 0.252, head, false);
  smile.rotation.z = Math.PI;
  const hair = pivot(head, 0, 0.2, 0);

  const arms = [-1, 1].map(s => {
    const shoulder = pivot(torso, s * 0.255, 0.46, 0);
    mesh(capsule(0.062, 0.16), m.shirt, 0, -0.12, 0, shoulder);
    const elbow = pivot(shoulder, 0, -0.26, 0);
    mesh(capsule(0.055, 0.12), m.skin, 0, -0.09, 0, elbow);
    mesh(new THREE.SphereGeometry(0.068, 12, 10), m.skin, 0, -0.2, 0, elbow);
    return { shoulder, elbow, side: s };
  });

  // Sims-style mood gem
  const gemMat = new THREE.MeshToonMaterial({ color: '#3ddc84', emissive: '#3ddc84', emissiveIntensity: 0.5, gradientMap: grad });
  const gem = mesh(new THREE.OctahedronGeometry(0.11), gemMat, 0, 2.2, 0, root, false);
  gem.scale.y = 1.7;

  function buildHair(style) {
    hair.clear();
    const cap = (r, thetaLen) => mesh(new THREE.SphereGeometry(r, 32, 18, 0, Math.PI * 2, 0, thetaLen), m.hair, 0, 0.0, -0.012, hair);
    if (style === 'buzz') { cap(0.272, Math.PI * 0.42); return; }
    cap(0.285, Math.PI * 0.52);
    // fringe
    for (const [x, r, y] of [[-0.13, 0.085, 0.13], [0, 0.095, 0.15], [0.13, 0.085, 0.13]]) mesh(new THREE.SphereGeometry(r, 14, 10), m.fringe, x, y, 0.2, hair).scale.set(1.15, 0.62, 0.55);
    if (style === 'long') {
      mesh(capsule(0.2, 0.25), m.hair, 0, -0.2, -0.12, hair).scale.set(1.25, 1, 0.6);
      for (const sx of [-0.23, 0.23]) mesh(capsule(0.07, 0.25), m.hair, sx, -0.15, 0.0, hair);
    } else if (style === 'bun') {
      mesh(new THREE.SphereGeometry(0.12, 16, 12), m.hair, 0, 0.26, -0.12, hair);
    } else if (style === 'curly') {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        mesh(new THREE.SphereGeometry(0.085, 10, 8), m.hair, Math.cos(a) * 0.24, 0.06 + (i % 2) * 0.06, Math.sin(a) * 0.24 - 0.03, hair);
      }
      mesh(new THREE.SphereGeometry(0.2, 16, 12), m.hair, 0, 0.15, -0.03, hair);
    } else if (style === 'ponytail') {
      const tail = pivot(hair, 0, 0.05, -0.27);
      mesh(capsule(0.065, 0.22), m.hair, 0, -0.15, -0.04, tail).rotation.x = 0.35;
      world.ponytail = tail;
    }
  }
  const world = {};

  function setLook(l) {
    m.skin.color.set(l.skin);
    m.hair.color.set(l.hair);
    m.fringe.color.set(l.hair);
    m.shirt.color.set(l.shirt);
    m.pants.color.set(l.pants);
    m.shoes.color.set(l.shoes);
    world.ponytail = null;
    buildHair(l.hairStyle);
  }
  setLook(look);

  // ---------- animation ----------

  let pose = 'idle';
  let phase = 0, walkW = 0, runW = 0, blinkT = 2 + Math.random() * 3, cheerT = 0;
  const J = { // current joint values, smoothed toward targets every frame
    bodyY: 0, bodyX: 0, bodyZ: 0, bodyPitch: 0, lean: 0, bank: 0,
    thighL: 0, thighR: 0, shinL: 0, shinR: 0, armL: 0, armR: 0, armZL: 0, armZR: 0, elbowL: 0, elbowR: 0,
    headY: 0, headX: 0,
  };

  function setPose(p) { pose = p; }
  function cheer() { cheerT = 0.9; }

  function update(dt, t, speed = 0, turnRate = 0) {
    const k = 1 - Math.exp(-dt * 12);
    const fast = 1 - Math.exp(-dt * 22);
    if (pose === 'run') speed = 3.4;
    walkW = smooth(walkW, Math.min(1, speed / 1.0), 1 - Math.exp(-dt * 8));
    runW = smooth(runW, THREE.MathUtils.clamp((speed - 2.6) / 0.9, 0, 1), 1 - Math.exp(-dt * 6));
    phase += dt * (2.2 + speed * 2.4);

    // targets for the base pose
    const T = { bodyY: 0, bodyX: 0, bodyZ: 0, bodyPitch: 0, lean: 0, bank: 0, thighL: 0, thighR: 0, shinL: 0, shinR: 0,
      armL: 0, armR: 0, armZL: 0.08, armZR: -0.08, elbowL: -0.1, elbowR: -0.1, headY: 0, headX: 0 };
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
      // idle with gentle breathing and looking around
      T.bodyY = idleBreath * 0.006;
      T.headY = Math.sin(t * 0.5) * 0.3 * Math.max(0, Math.sin(t * 0.17));
      T.headX = Math.sin(t * 0.7) * 0.04;
      T.armZL = 0.08 + idleBreath * 0.02; T.armZR = -0.08 - idleBreath * 0.02;
    }

    // locomotion layer, blended in by walk weight
    if (walkW > 0.01 && (pose === 'idle' || pose === 'run')) {
      const amp = 0.55 + runW * 0.4;
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
    torso.scale.y = 1 + idleBreath * 0.008;
    if (world.ponytail) world.ponytail.rotation.x = 0.2 + J.lean * 2 + Math.sin(phase * 2) * 0.12 * walkW;

    // blinking
    blinkT -= dt;
    const blink = blinkT < 0.12 ? 0.12 : 1;
    eyes.forEach(e => { e.scale.y = smooth(e.scale.y, blink, fast); });
    if (blinkT < 0) blinkT = 2 + Math.random() * 4;

    gem.rotation.y += dt * 1.5;
    const gemY = pose === 'lie' ? 1.15 : pose === 'sit' || pose === 'meditate' ? 1.6 : 2.2;
    gem.position.y = smooth(gem.position.y, gemY + Math.sin(t * 2) * 0.04, k);
  }

  function setMoodColor(score) {
    const c = score >= 60 ? '#3ddc84' : score >= 35 ? '#ffd93d' : '#ff5c7a';
    gemMat.color.set(c);
    gemMat.emissive.set(c);
  }

  return { root, setLook, setPose, update, setMoodColor, cheer, get pose() { return pose; } };
}
