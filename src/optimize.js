// Speed-ups for phones: combine pieces that never move, so the GPU draws far fewer things.
import * as THREE from '../vendor/three.module.min.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';

// Groups marked userData.flatten have their meshes moved up into the parent (keeping where they are),
// then sibling meshes that share a material are merged into one mesh.
// Anything marked userData.dynamic (moves, scales or animates by itself) is left alone.
export function mergeStatic(root) {
  root.updateMatrixWorld(true);

  const flat = [];
  root.traverse(o => { if (o.userData.flatten) flat.push(o); });
  for (const g of flat) {
    const parent = g.parent;
    if (!parent) continue;
    const meshes = [];
    g.traverse(o => { if (o.isMesh) meshes.push(o); });
    for (const m of meshes) parent.attach(m);
    if (!g.children.length) parent.remove(g);
  }

  const parents = new Set();
  root.traverse(o => { if (o.isMesh && o.parent && !o.userData.dynamic) parents.add(o.parent); });

  let before = 0, after = 0;
  for (const parent of parents) {
    const buckets = new Map();
    for (const m of parent.children) {
      if (!m.isMesh || m.userData.dynamic || m.children.length || Array.isArray(m.material) || !m.visible) continue;
      const g = m.geometry;
      const key = [
        m.material.uuid, m.castShadow, m.receiveShadow, m.renderOrder,
        m.userData.interact?.id ?? '', !!m.userData.ground,
        Object.keys(g.attributes).sort().join(','), !!g.index,
      ].join('|');
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(m);
    }
    for (const list of buckets.values()) {
      if (list.length < 2) continue;
      const geos = list.map(m => {
        m.updateMatrix();
        return m.geometry.clone().applyMatrix4(m.matrix);
      });
      const merged = mergeGeometries(geos);
      geos.forEach(g => g.dispose());
      if (!merged) continue;
      const first = list[0];
      const mesh = new THREE.Mesh(merged, first.material);
      mesh.castShadow = first.castShadow;
      mesh.receiveShadow = first.receiveShadow;
      mesh.renderOrder = first.renderOrder;
      mesh.userData = { ...first.userData };
      for (const m of list) parent.remove(m);
      parent.add(mesh);
      before += list.length;
      after += 1;
    }
  }
  return { before, after };
}

// Keeps frames smooth: lowers the render resolution a little when the device struggles,
// and raises it again when there is room.
export function adaptiveQuality(renderer, { min = 1, max = 2 } = {}) {
  let ratio = Math.min(window.devicePixelRatio, max);
  renderer.setPixelRatio(ratio);
  let frames = 0, time = 0, cooldown = 3;
  return dt => {
    frames++; time += dt; cooldown -= dt;
    if (time < 2 || cooldown > 0) return;
    const ms = (time / frames) * 1000;
    frames = 0; time = 0;
    const top = Math.min(window.devicePixelRatio, max);
    if (ms > 24 && ratio > min) ratio = Math.max(min, ratio - 0.25);
    else if (ms < 14 && ratio < top) ratio = Math.min(top, ratio + 0.25);
    else return;
    renderer.setPixelRatio(ratio);
    cooldown = 3;
  };
}
