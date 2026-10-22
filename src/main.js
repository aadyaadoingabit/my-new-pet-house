// My Pet House: a 3D house where you are the pet.
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { state, save, bus, tickNeeds, moodScore, NEEDS, levelInfo } from './state.js';
import { buildWorld, ROOMS, findPath, walkable, clampToRoom, roomAt, labelSprite } from './world.js';
import { createAvatar } from './avatar.js';
import { BOTS } from './ai.js';
import { initPanels, openPanel, closePanel, currentPanel, hooks, timer, timerText, toast, refresh } from './panels.js';

const $ = s => document.querySelector(s);

// ---------- renderer, scene, camera ----------

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
$('#stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(0.5, 11, 14);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 4;
controls.maxDistance = 32;
controls.minPolarAngle = 0.25;
controls.maxPolarAngle = 1.3;
controls.target.set(0.5, 0.8, 5);

const world = buildWorld(scene, BOTS);
world.setWallMode(state.walls);
world.setOwned(state.owned);

const avatar = createAvatar(state.avatar);
avatar.root.position.set(0.5, 0, 5.2);
scene.add(avatar.root);

// destination marker & hover ring
const marker = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0 }));
marker.rotation.x = -Math.PI / 2;
scene.add(marker);
const hoverRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.65, 40), new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.85 }));
hoverRing.rotation.x = -Math.PI / 2;
hoverRing.visible = false;
scene.add(hoverRing);

// thought bubble that shows your most urgent need
let bubble = null, bubbleNeed = null;
function updateBubble() {
  const [k, v] = Object.entries(state.needs).sort((a, b) => a[1] - b[1])[0];
  const want = v < 25 ? k : null;
  if (want === bubbleNeed) return;
  bubbleNeed = want;
  if (bubble) { avatar.root.remove(bubble); bubble.material.map.dispose(); bubble = null; }
  if (want) {
    bubble = labelSprite(`💭 ${NEEDS[want].icon}`, { bg: 'rgba(255,255,255,.95)', fg: '#222', scale: 1.1 });
    bubble.position.set(0.45, 2.45, 0);
    avatar.root.add(bubble);
  }
}

// ---------- moving around ----------

const me = { path: [], target: null, seated: null, speed: 3.4 };

function standUp() {
  if (!me.seated) return;
  const [ax, az] = me.seated.approach;
  avatar.root.position.set(ax, 0, az);
  avatar.setPose('idle');
  me.seated = null;
}

function walkTo(x, z, item = null) {
  if (currentPanel()) closePanel();
  standUp();
  const p = avatar.root.position;
  me.path = findPath(p.x, p.z, x, z);
  me.target = item;
  marker.position.set(x, 0.03, z);
  marker.material.opacity = item ? 0 : 0.9;
}

function goTo(item) {
  const [x, z] = item.approach;
  walkTo(x, z, item);
}

function faceTowards(x, z, instant = false) {
  const p = avatar.root.position;
  const target = Math.atan2(x - p.x, z - p.z);
  let d = target - avatar.root.rotation.y;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  avatar.root.rotation.y += instant ? d : d * 0.25;
}

function arrive(item) {
  me.target = null;
  if (item.seat) {
    const s = item.seat;
    avatar.root.position.set(s.x, s.y, s.z);
    avatar.root.rotation.y = s.ry;
    avatar.setPose(item.pose === 'stand' ? 'idle' : item.pose);
    me.seated = item;
  } else {
    const f = item.face || [item.object.position.x, item.object.position.z];
    faceTowards(f[0], f[1], true);
  }
  openPanel(item.panel);
}

hooks.world = world;
hooks.avatar = avatar;
hooks.onClose = () => { standUp(); avatar.setPose('idle'); };
hooks.goToBot = id => { const it = world.interactables.find(i => i.bot === id); if (it) goTo(it); };
hooks.onChange = full => {
  applyTime();
  if (full) {
    avatar.setLook(state.avatar);
    world.setOwned(state.owned);
    world.setWallMode(state.walls);
  }
  updateHUD();
};

// keyboard walking (WASD / arrows)
const keys = new Set();
window.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, select')) return;
  if (e.key === 'Escape') { closePanel(); return; }
  const k = e.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
    keys.add(k);
    e.preventDefault();
  }
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

function keyboardMove(dt) {
  let fx = 0, fz = 0;
  if (keys.has('w') || keys.has('arrowup')) fz += 1;
  if (keys.has('s') || keys.has('arrowdown')) fz -= 1;
  if (keys.has('a') || keys.has('arrowleft')) fx -= 1;
  if (keys.has('d') || keys.has('arrowright')) fx += 1;
  if (!fx && !fz) return false;
  if (me.seated || currentPanel()) { closePanel(); standUp(); }
  me.path = []; me.target = null;
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  fwd.y = 0; fwd.normalize();
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const dir = fwd.multiplyScalar(fz).add(right.multiplyScalar(fx)).normalize();
  const p = avatar.root.position, step = me.speed * dt;
  const nx = p.x + dir.x * step, nz = p.z + dir.z * step;
  if (walkable(nx, nz)) { p.x = nx; p.z = nz; }
  else if (walkable(nx, p.z)) p.x = nx;
  else if (walkable(p.x, nz)) p.z = nz;
  faceTowards(p.x + dir.x, p.z + dir.z);
  return true;
}

// ---------- clicking & hovering ----------

const raycaster = new THREE.Raycaster();
const shown = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
const ndc = new THREE.Vector2();
function pick(clientX, clientY) {
  ndc.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(scene.children, true);
  for (const h of hits) {
    if (h.object === marker || h.object === hoverRing || h.object.type === 'Points') continue;
    if (!shown(h.object) || avatar.root.getObjectById(h.object.id)) continue;
    if (h.object.userData.interact) return { item: h.object.userData.interact };
    return { point: h.point };
  }
  return {};
}

let down = null;
const canvas = renderer.domElement;
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down = null; return; }
  down = null;
  const hit = pick(e.clientX, e.clientY);
  if (hit.item) goTo(hit.item);
  else if (hit.point) {
    const c = clampToRoom(hit.point.x, hit.point.z);
    if (c) walkTo(c[0], c[1]);
  }
});

let lastHover = 0;
canvas.addEventListener('pointermove', e => {
  const tip = $('#hoverTip');
  if (e.pointerType !== 'mouse' || e.buttons) { tip.style.opacity = 0; return; }
  const now = performance.now();
  if (now - lastHover < 60) return;
  lastHover = now;
  const { item } = pick(e.clientX, e.clientY);
  canvas.style.cursor = item ? 'pointer' : 'default';
  hoverRing.visible = !!item;
  if (item) {
    const o = item.object.position;
    hoverRing.position.set(o.x, 0.04, o.z);
    tip.textContent = `${item.emoji} ${item.name}`;
    tip.style.left = e.clientX + 14 + 'px';
    tip.style.top = e.clientY + 14 + 'px';
    tip.style.opacity = 1;
  } else tip.style.opacity = 0;
});

// ---------- HUD ----------

function updateHUD() {
  const needsHTML = Object.entries(NEEDS).map(([k, n]) => {
    const v = Math.round(state.needs[k]);
    const cls = v >= 60 ? 'good' : v >= 30 ? 'ok' : 'low';
    return `<div class="need" title="${n.label} ${v}/100"><span>${n.icon}</span><div class="need-bar"><i class="${cls}" style="width:${v}%"></i></div></div>`;
  }).join('');
  const score = moodScore();
  const mood = score >= 75 ? 'Thriving' : score >= 55 ? 'Happy' : score >= 35 ? 'Okay' : 'Needs care';
  $('#needs').innerHTML = `<div class="mood-line"><b>${state.name ? state.name : 'You'}</b> · ${mood}</div>${needsHTML}`;
  const lv = levelInfo();
  $('#coins').textContent = `🪙 ${state.coins}`;
  $('#level').innerHTML = `⭐ Lv ${lv.level}`;
  $('#level').title = `${lv.xp} XP · ${lv.toNext} to next level`;
  avatar.setMoodColor(score);
  updateBubble();
}

function updateClock() {
  const d = new Date();
  const icon = world.isNight ? '🌙' : '☀️';
  const mode = state.timeMode === 'real' ? '' : state.timeMode === 'day' ? ' (day mode)' : ' (night mode)';
  $('#clock').textContent = `${icon} ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${mode}`;
}

function applyTime() {
  const d = new Date();
  const hour = state.timeMode === 'day' ? 13 : state.timeMode === 'night' ? 22 : d.getHours() + d.getMinutes() / 60;
  world.setTime(hour);
  updateClock();
}

// "Go to" menu
const goSel = $('#goTo');
const byRoom = {};
for (const it of world.interactables) (byRoom[it.room] ||= []).push(it);
goSel.innerHTML = '<option value="">🚶 Go to…</option>' + Object.entries(ROOMS).filter(([id]) => byRoom[id]).map(([id, r]) =>
  `<optgroup label="${r.emoji} ${r.name}">${byRoom[id].map(it => `<option value="${it.id}">${it.emoji} ${it.name}</option>`).join('')}</optgroup>`).join('');
goSel.addEventListener('change', () => {
  const it = world.interactables.find(i => i.id === goSel.value);
  if (it) {
    if (it.id === 'cat' && !state.owned.includes('cat')) toast('You need to buy a cat in the shop first 🐈');
    else goTo(it);
  }
  goSel.value = '';
});

document.querySelectorAll('[data-hud]').forEach(b => b.addEventListener('click', () => {
  const h = b.dataset.hud;
  if (h === 'walls') {
    state.walls = state.walls === 'up' ? 'cut' : 'up';
    world.setWallMode(state.walls);
    save();
    toast(state.walls === 'up' ? '🧱 Walls up' : '🧱 Cutaway view');
  } else if (h === 'needs') {
    $('#needs').classList.toggle('collapsed');
  } else openPanel(h);
}));

bus.addEventListener('change', updateHUD);

// welcome screen for first visit
if (!state.welcomed) {
  $('#welcome').hidden = false;
  $('#welcomeName').value = state.name;
  $('#welcomeGo').addEventListener('click', () => {
    state.name = $('#welcomeName').value.trim() || state.name;
    state.welcomed = true;
    save();
    $('#welcome').hidden = true;
    toast(`Welcome home${state.name ? ', ' + state.name : ''}! 🏡 Tap something to use it.`);
  });
}

initPanels();

// ---------- loop ----------

const clock = new THREE.Clock();
let acc = 0, accTime = 0, accSave = 0;
const camDelta = new THREE.Vector3();
const viewShift = [0, 0];
let lastRoom = null;

function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  const manual = keyboardMove(dt);
  let moving = manual;
  if (!manual && me.path.length) {
    const p = avatar.root.position;
    const [tx, tz] = me.path[0];
    const dx = tx - p.x, dz = tz - p.z, dist = Math.hypot(dx, dz), step = me.speed * dt;
    if (dist <= step) {
      p.x = tx; p.z = tz;
      me.path.shift();
      if (!me.path.length) { marker.material.opacity = 0; if (me.target) arrive(me.target); }
    } else {
      p.x += (dx / dist) * step;
      p.z += (dz / dist) * step;
      faceTowards(tx, tz);
      moving = true;
    }
  }
  if (marker.material.opacity > 0) marker.scale.setScalar(1 + Math.sin(t * 6) * 0.1);

  avatar.update(dt, t, moving, false);
  world.update(t);

  // bots turn to look at you when you're close
  const ap = avatar.root.position;
  for (const id in world.bots) {
    const b = world.bots[id];
    const bp = b.group.position;
    if (Math.hypot(ap.x - bp.x, ap.z - bp.z) < 4) {
      const target = Math.atan2(ap.x - bp.x, ap.z - bp.z);
      let d = target - b.hover.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      b.hover.rotation.y += d * Math.min(1, dt * 4);
    }
  }

  // TV flicker and study monitor glow
  if (currentPanel() === 'tv') world.tvMat.emissiveIntensity = 0.8 + Math.sin(t * 7) * 0.15 + Math.sin(t * 13) * 0.1;
  world.monitorMat.emissiveIntensity = timer.running ? 1.2 : 0.5;

  // camera follows you
  camDelta.set(ap.x, 0.8 + ap.y * 0.5, ap.z).sub(controls.target).multiplyScalar(Math.min(1, dt * 4));
  controls.target.add(camDelta);
  camera.position.add(camDelta);
  controls.update();

  // keep your character visible next to an open panel
  const panelOpen = !!currentPanel(), mobile = window.innerWidth <= 640;
  const want = panelOpen ? (mobile ? [0, window.innerHeight * 0.3] : [Math.min(420, window.innerWidth - 24) / 2, 0]) : [0, 0];
  viewShift[0] += (want[0] - viewShift[0]) * Math.min(1, dt * 6);
  viewShift[1] += (want[1] - viewShift[1]) * Math.min(1, dt * 6);
  if (Math.abs(viewShift[0]) + Math.abs(viewShift[1]) > 0.5) camera.setViewOffset(window.innerWidth, window.innerHeight, viewShift[0], viewShift[1], window.innerWidth, window.innerHeight);
  else if (camera.view?.enabled) camera.clearViewOffset();

  // room name
  const room = roomAt(ap.x, ap.z);
  if (room !== lastRoom) { lastRoom = room; $('#roomName').textContent = room ? `${ROOMS[room].emoji} ${ROOMS[room].name}` : ''; }

  // timer pill
  const pill = $('#timerPill');
  pill.hidden = !timer.running;
  if (timer.running) pill.textContent = `⏱ ${timerText()} · ${timer.skill}`;

  acc += dt; accTime += dt; accSave += dt;
  if (acc > 2) { acc = 0; tickNeeds(); updateHUD(); }
  if (accTime > 20) { accTime = 0; applyTime(); }
  if (accSave > 30) { accSave = 0; save(); }

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

tickNeeds();
applyTime();
updateHUD();
$('#loading').remove();
loop();

// Tooltips for charts and thinking-trap chips inside panels
document.addEventListener('mousemove', e => {
  const tip = $('#tooltip');
  const target = e.target.closest && e.target.closest('#panel [data-tip]');
  if (!target) { tip.style.opacity = 0; return; }
  tip.textContent = target.getAttribute('data-tip');
  const w = tip.offsetWidth;
  tip.style.left = Math.min(window.innerWidth - w - 8, Math.max(8, e.clientX - w / 2)) + 'px';
  tip.style.top = e.clientY - 40 + 'px';
  tip.style.opacity = 1;
});

window.__petHouse = { world, avatar, me, goTo, openPanel, refresh };
