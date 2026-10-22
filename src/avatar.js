// The player's character ("the pet"). Built from simple shapes so every part can be recolored.
import * as THREE from 'three';

export const LOOKS = {
  skin: ['#ffdbac', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a1e'],
  hair: ['#1b1b1b', '#3b2219', '#7b4b2a', '#d8b26e', '#e8e3d9', '#b5523b', '#7b5cd6', '#e86aa6', '#3a86ff'],
  hairStyle: ['short', 'long', 'bun', 'curly', 'ponytail', 'buzz'],
  shirt: ['#e07a5f', '#3d405b', '#81b29a', '#f2cc8f', '#ffffff', '#222222', '#9b5de5', '#00bbf9', '#f15bb5', '#e63946'],
  pants: ['#3d405b', '#222222', '#6c757d', '#1d3557', '#a68a64', '#f2e8cf', '#2a9d8f'],
  shoes: ['#222222', '#ffffff', '#e63946', '#8d5524', '#3a86ff'],
};

export function createAvatar(look) {
  const m = {
    skin: new THREE.MeshStandardMaterial({ roughness: 0.7 }),
    hair: new THREE.MeshStandardMaterial({ roughness: 0.9 }),
    shirt: new THREE.MeshStandardMaterial({ roughness: 0.85 }),
    pants: new THREE.MeshStandardMaterial({ roughness: 0.9 }),
    shoes: new THREE.MeshStandardMaterial({ roughness: 0.6 }),
    dark: new THREE.MeshStandardMaterial({ color: '#1b1b1b', roughness: 0.4 }),
  };
  const mesh = (geo, mat, x, y, z, parent) => {
    const o = new THREE.Mesh(geo, mat);
    o.position.set(x, y, z);
    o.castShadow = true;
    parent.add(o);
    return o;
  };
  const pivot = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

  const root = new THREE.Group();      // world position & facing
  const body = pivot(root, 0, 0, 0);   // bobbing and poses

  // legs: thigh pivot at the hip, shin pivot at the knee
  const legs = [-0.1, 0.1].map(x => {
    const thigh = pivot(body, x, 0.8, 0);
    mesh(new THREE.BoxGeometry(0.16, 0.4, 0.18), m.pants, 0, -0.2, 0, thigh);
    const shin = pivot(thigh, 0, -0.4, 0);
    mesh(new THREE.BoxGeometry(0.15, 0.36, 0.17), m.pants, 0, -0.18, 0, shin);
    mesh(new THREE.BoxGeometry(0.17, 0.08, 0.27), m.shoes, 0, -0.36, 0.04, shin);
    return { thigh, shin };
  });

  const torso = mesh(new THREE.BoxGeometry(0.44, 0.56, 0.26), m.shirt, 0, 1.08, 0, body);
  mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.08, 10), m.skin, 0, 1.39, 0, body);

  const head = pivot(body, 0, 1.58, 0);
  mesh(new THREE.SphereGeometry(0.19, 24, 18), m.skin, 0, 0, 0, head);
  for (const ex of [-0.065, 0.065]) mesh(new THREE.SphereGeometry(0.025, 10, 8), m.dark, ex, 0.02, 0.172, head);
  const smile = mesh(new THREE.TorusGeometry(0.05, 0.011, 6, 14, Math.PI), m.dark, 0, -0.055, 0.17, head);
  smile.rotation.z = Math.PI;
  const hair = pivot(head, 0, 0, 0);

  const arms = [-0.29, 0.29].map(x => {
    const shoulder = pivot(body, x, 1.33, 0);
    mesh(new THREE.BoxGeometry(0.12, 0.3, 0.14), m.shirt, 0, -0.14, 0, shoulder);
    mesh(new THREE.BoxGeometry(0.1, 0.26, 0.12), m.skin, 0, -0.4, 0, shoulder);
    mesh(new THREE.SphereGeometry(0.06, 10, 8), m.skin, 0, -0.55, 0, shoulder);
    return shoulder;
  });

  // Sims-style mood gem floating over your head
  const gemMat = new THREE.MeshStandardMaterial({ color: '#3ddc84', emissive: '#3ddc84', emissiveIntensity: 0.7, roughness: 0.3, transparent: true, opacity: 0.9 });
  const gem = mesh(new THREE.OctahedronGeometry(0.11), gemMat, 0, 2.15, 0, root);
  gem.scale.y = 1.7;
  gem.castShadow = false;

  function buildHair(style) {
    hair.clear();
    const cap = (r, thetaLen) => mesh(new THREE.SphereGeometry(r, 24, 14, 0, Math.PI * 2, 0, thetaLen), m.hair, 0, 0.015, -0.01, hair);
    if (style === 'buzz') { cap(0.197, Math.PI * 0.42); return; }
    cap(0.205, Math.PI * 0.55);
    if (style === 'long') {
      mesh(new THREE.BoxGeometry(0.4, 0.42, 0.12), m.hair, 0, -0.16, -0.13, hair);
      for (const sx of [-0.18, 0.18]) mesh(new THREE.BoxGeometry(0.06, 0.32, 0.18), m.hair, sx, -0.1, -0.02, hair);
    } else if (style === 'bun') {
      mesh(new THREE.SphereGeometry(0.1, 14, 10), m.hair, 0, 0.18, -0.1, hair);
    } else if (style === 'curly') {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        mesh(new THREE.SphereGeometry(0.07, 8, 6), m.hair, Math.cos(a) * 0.17, 0.08 + (i % 2) * 0.06, Math.sin(a) * 0.17 - 0.02, hair);
      }
      mesh(new THREE.SphereGeometry(0.15, 12, 8), m.hair, 0, 0.14, -0.02, hair);
    } else if (style === 'ponytail') {
      const tail = mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.32, 10), m.hair, 0, -0.04, -0.23, hair);
      tail.rotation.x = 0.4;
    }
  }

  function setLook(l) {
    m.skin.color.set(l.skin);
    m.hair.color.set(l.hair);
    m.shirt.color.set(l.shirt);
    m.pants.color.set(l.pants);
    m.shoes.color.set(l.shoes);
    buildHair(l.hairStyle);
  }
  setLook(look);

  let pose = 'idle';
  function setPose(p) {
    pose = p;
    body.rotation.set(0, 0, 0);
    body.position.set(0, 0, 0);
  }

  const lerp = (o, key, v, k) => { o[key] += (v - o[key]) * k; };

  function update(dt, t, moving, running) {
    const k = Math.min(1, dt * 12);
    gem.rotation.y += dt * 1.5;
    gem.position.y = 2.15 + Math.sin(t * 2) * 0.04 + (pose === 'lie' ? -0.9 : pose === 'sit' || pose === 'meditate' ? -0.6 : 0);

    if (pose === 'lie') {
      body.rotation.x = -Math.PI / 2;
      body.position.set(0, 0.12, -0.1);
      legs.forEach(l => { lerp(l.thigh.rotation, 'x', 0, k); lerp(l.shin.rotation, 'x', 0, k); });
      arms.forEach(a => { lerp(a.rotation, 'x', 0, k); lerp(a.rotation, 'z', 0, k); });
      lerp(head.rotation, 'y', Math.sin(t * 0.3) * 0.2, k);
      body.position.y = 0.12 + Math.sin(t * 1.2) * 0.008;
      return;
    }
    if (pose === 'sit') {
      body.position.y = -0.72;
      legs.forEach(l => { lerp(l.thigh.rotation, 'x', -Math.PI / 2, k); lerp(l.shin.rotation, 'x', Math.PI / 2, k); });
      arms.forEach((a, i) => { lerp(a.rotation, 'x', -0.5, k); lerp(a.rotation, 'z', 0, k); });
      lerp(head.rotation, 'y', 0, k);
      return;
    }
    if (pose === 'meditate') {
      body.position.y = -0.72;
      legs.forEach((l, i) => { lerp(l.thigh.rotation, 'x', -Math.PI / 2, k); lerp(l.shin.rotation, 'x', Math.PI / 2 + 0.6, k); });
      arms.forEach((a, i) => { lerp(a.rotation, 'x', -0.3, k); lerp(a.rotation, 'z', (i ? -1 : 1) * 0.35, k); });
      body.position.y += Math.sin(t * 1.0) * 0.01;
      return;
    }
    if (moving || pose === 'run') {
      const run = running || pose === 'run';
      const speed = run ? 13 : 8.5, amp = run ? 0.85 : 0.55;
      const s = Math.sin(t * speed);
      legs[0].thigh.rotation.x = s * amp;
      legs[1].thigh.rotation.x = -s * amp;
      legs[0].shin.rotation.x = Math.max(0, -s) * amp * 1.2;
      legs[1].shin.rotation.x = Math.max(0, s) * amp * 1.2;
      arms[0].rotation.x = -s * amp * 0.9;
      arms[1].rotation.x = s * amp * 0.9;
      arms.forEach(a => lerp(a.rotation, 'z', 0, k));
      body.position.y = Math.abs(Math.cos(t * speed)) * (run ? 0.06 : 0.035);
      return;
    }
    // idle: breathe and look around a little
    legs.forEach(l => { lerp(l.thigh.rotation, 'x', 0, k); lerp(l.shin.rotation, 'x', 0, k); });
    arms.forEach((a, i) => { lerp(a.rotation, 'x', 0, k); lerp(a.rotation, 'z', (i ? -1 : 1) * 0.06, k); });
    body.position.y = Math.sin(t * 2) * 0.006;
    head.rotation.y = Math.sin(t * 0.5) * 0.25 * Math.max(0, Math.sin(t * 0.13));
  }

  function setMoodColor(score) {
    const c = score >= 60 ? '#3ddc84' : score >= 35 ? '#ffd23f' : '#ff4d4d';
    gemMat.color.set(c);
    gemMat.emissive.set(c);
  }

  return { root, setLook, setPose, update, setMoodColor, get pose() { return pose; } };
}
