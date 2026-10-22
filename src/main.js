// My Pet House: a cute 3D house where you are the pet.
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { OutlineEffect } from '../vendor/OutlineEffect.js';
import { state, save, bus, tickNeeds, moodScore, NEEDS, levelInfo } from './state.js';
import { buildWorld, ROOMS, findPath, walkable, clampToRoom, roomAt, labelSprite } from './world.js';
import { createAvatar } from './avatar.js';
import { mergeStatic, adaptiveQuality } from './optimize.js';
import { BOTS } from './ai.js';
import { initPanels, openPanel, closePanel, currentPanel, hooks, timer, timerText, toast, refresh } from './panels.js';

const $ = s => document.querySelector(s);
const touchDevice = matchMedia('(pointer: coarse)').matches;

// Wait (briefly) for the cute font so 3D name tags use it.
await Promise.race([document.fonts?.load('600 44px Fredoka').catch(() => {}), new Promise(r => setTimeout(r, 1500))]);

// ---------- renderer, scene, camera ----------

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
const tuneQuality = adaptiveQuality(renderer, { min: 1, max: 2 });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = touchDevice ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
$('#stage').appendChild(renderer.domElement);
const outline = new OutlineEffect(renderer, { defaultThickness: 0.0042, defaultColor: [0.23, 0.16, 0.25], defaultAlpha: 1 });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 300);
function fitCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;
  camera.fov = aspect < 1 ? Math.min(62, 42 / Math.pow(aspect, 0.6)) : 42;
  camera.updateProjectionMatrix();
}
fitCamera();
camera.position.set(0.5, 7.6, 14.2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.enablePan = false;
controls.minDistance = 4;
controls.maxDistance = 30;
controls.minPolarAngle = 0.3;
controls.maxPolarAngle = 1.3;
controls.rotateSpeed = 0.7;
controls.zoomSpeed = 0.8;
controls.target.set(0.5, 0.8, 5);
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };

const world = buildWorld(scene, BOTS);
world.lowPower = touchDevice;
if (touchDevice) world.sun.shadow.mapSize.set(1024, 1024);
const merged = mergeStatic(scene);
console.info(`My Pet House: combined ${merged.before} still pieces into ${merged.after}`);
world.setWallMode(state.walls);
world.setOwned(state.owned);

const avatar = createAvatar(state.avatar);
avatar.root.position.set(0.5, 0, 5.2);
scene.add(avatar.root);

// destination marker & hover ring
const marker = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.3, 32), new THREE.MeshBasicMaterial({ color: '#ff5fa2', transparent: true, opacity: 0 }));
marker.rotation.x = -Math.PI / 2;
marker.material.userData.outlineParameters = { visible: false };
scene.add(marker);
const hoverRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.66, 40), new THREE.MeshBasicMaterial({ color: '#ffd93d', transparent: true, opacity: 0.9 }));
hoverRing.rotation.x = -Math.PI / 2;
hoverRing.material.userData.outlineParameters = { visible: false };
hoverRing.visible = false;
scene.add(hoverRing);

// thought bubble showing your most urgent need
let bubble = null, bubbleNeed = null;
function updateBubble() {
  const [k, v] = Object.entries(state.needs).sort((a, b) => a[1] - b[1])[0];
  const want = v < 25 ? k : null;
  if (want === bubbleNeed) return;
  bubbleNeed = want;
  if (bubble) { avatar.root.remove(bubble); bubble.material.map.dispose(); bubble = null; }
  if (want) {
    bubble = labelSprite(`💭 ${NEEDS[want].icon}`, { scale: 1.1 });
    bubble.position.set(0.5, 2.5, 0);
    avatar.root.add(bubble);
  }
}

// ---------- moving around (smooth acceleration, curved turns, gentle sitting) ----------

const WALK = 2.3, RUN = 3.7, ACCEL = 7, DECEL = 6;
const me = { path: [], target: null, seated: null, speed: 0, heading: 0, turnRate: 0, tween: null, speedMul: 1 };

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const ease = x => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

function startTween(to, toYaw, dur, onDone) {
  const p = avatar.root.position;
  me.tween = { from: p.clone(), to: new THREE.Vector3(to.x, to.y, to.z), fromYaw: me.heading, toYaw, t: 0, dur, onDone };
}

function standUp(then) {
  if (!me.seated) { then?.(); return; }
  const [ax, az] = me.seated.approach;
  me.seated = null;
  avatar.setPose('idle');
  startTween({ x: ax, y: 0, z: az }, me.heading, 0.45, then);
}

function walkTo(x, z, item = null) {
  if (currentPanel()) closePanel();
  const go = () => {
    const p = avatar.root.position;
    me.path = findPath(p.x, p.z, x, z);
    me.target = item;
  };
  if (me.seated) standUp(go); else { avatar.setPose('idle'); go(); }
  marker.position.set(x, 0.03, z);
  marker.material.opacity = item ? 0 : 0.95;
}

const goTo = item => walkTo(item.approach[0], item.approach[1], item);

function arrive(item) {
  me.target = null;
  me.speed = 0;
  if (item.seat) {
    const s = item.seat;
    const pose = item.pose === 'stand' ? 'idle' : item.pose;
    avatar.setPose(pose);
    me.seated = item;
    startTween(s, s.ry, 0.6, () => openPanel(item.panel));
  } else {
    const f = item.face || [item.object.position.x, item.object.position.z];
    const p = avatar.root.position;
    startTween(p, Math.atan2(f[0] - p.x, f[1] - p.z), 0.3, () => openPanel(item.panel));
  }
}

hooks.world = world;
hooks.avatar = avatar;
hooks.onClose = () => { if (me.seated) standUp(); else avatar.setPose('idle'); };
hooks.onReward = () => { if (!me.seated) avatar.cheer(); };
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

function steer(dt, desiredYaw, targetSpeed) {
  const diff = wrap(desiredYaw - me.heading);
  me.turnRate = THREE.MathUtils.clamp(diff * 7, -8, 8);
  me.heading = wrap(me.heading + me.turnRate * dt);
  const align = Math.max(0.12, Math.cos(Math.min(Math.abs(diff), Math.PI / 2)));
  const want = targetSpeed * align;
  me.speed += THREE.MathUtils.clamp(want - me.speed, -DECEL * dt, ACCEL * dt);
}

function followPath(dt) {
  const p = avatar.root.position;
  const [tx, tz] = me.path[0];
  const dx = tx - p.x, dz = tz - p.z, dist = Math.hypot(dx, dz);
  const last = me.path.length === 1;
  if (!last && dist < 0.45) { me.path.shift(); return; }
  if (last && dist < 0.05) {
    p.x = tx; p.z = tz;
    me.path = [];
    marker.material.opacity = 0;
    if (me.target) arrive(me.target);
    return;
  }
  let remaining = dist;
  for (let i = 1; i < me.path.length; i++) remaining += Math.hypot(me.path[i][0] - me.path[i - 1][0], me.path[i][1] - me.path[i - 1][1]);
  const cruise = (remaining > 7 ? RUN : WALK) * me.speedMul;
  const arriveSpeed = Math.sqrt(2 * DECEL * 0.8 * remaining) + 0.15;
  steer(dt, Math.atan2(dx, dz), Math.min(cruise, arriveSpeed));
  const step = me.speed * dt;
  if (last && dist < 0.35) {
    // final approach: glide straight onto the spot
    const k = Math.min(1, step / dist);
    p.x += dx * k; p.z += dz * k;
  } else {
    p.x += Math.sin(me.heading) * step;
    p.z += Math.cos(me.heading) * step;
  }
}

// keyboard walking (WASD / arrows)
const keys = new Set();
window.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, select')) return;
  if (e.key === 'Escape') { closePanel(); return; }
  const k = e.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
    keys.add(k);
    if (k !== 'shift') e.preventDefault();
  }
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

// on-screen joystick for phones and iPads
const joy = { active: false, x: 0, y: 0, id: null };
const joyEl = $('#joystick'), stickEl = joyEl.querySelector('.stick');
joyEl.hidden = !touchDevice;
function moveJoy(e) {
  const r = joyEl.getBoundingClientRect(), R = r.width / 2, max = R * 0.62;
  let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R);
  const len = Math.hypot(dx, dy);
  if (len > max) { dx *= max / len; dy *= max / len; }
  stickEl.style.transform = `translate(${dx}px, ${dy}px)`;
  joy.x = dx / max; joy.y = dy / max;
}
joyEl.addEventListener('pointerdown', e => {
  joy.active = true; joy.id = e.pointerId;
  joyEl.setPointerCapture(e.pointerId);
  joyEl.classList.add('on');
  moveJoy(e);
});
joyEl.addEventListener('pointermove', e => { if (joy.active && e.pointerId === joy.id) moveJoy(e); });
const endJoy = e => {
  if (e.pointerId !== joy.id) return;
  joy.active = false; joy.x = joy.y = 0;
  stickEl.style.transform = '';
  joyEl.classList.remove('on');
};
joyEl.addEventListener('pointerup', endJoy);
joyEl.addEventListener('pointercancel', endJoy);

function keyboardMove(dt) {
  let fx = 0, fz = 0;
  if (keys.has('w') || keys.has('arrowup')) fz += 1;
  if (keys.has('s') || keys.has('arrowdown')) fz -= 1;
  if (keys.has('a') || keys.has('arrowleft')) fx -= 1;
  if (keys.has('d') || keys.has('arrowright')) fx += 1;
  let run = keys.has('shift'), push = 1;
  if (joy.active) {
    fx += joy.x; fz -= joy.y;
    push = Math.min(1, Math.hypot(joy.x, joy.y));
    run = push > 0.95;
  }
  if (Math.hypot(fx, fz) < 0.15) return false;
  if (me.tween) return true;
  if (me.seated || currentPanel()) { closePanel(); standUp(); return true; }
  me.path = []; me.target = null;
  marker.material.opacity = 0;
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  fwd.y = 0; fwd.normalize();
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const dir = fwd.multiplyScalar(fz).add(right.multiplyScalar(fx)).normalize();
  steer(dt, Math.atan2(dir.x, dir.z), run ? RUN : WALK * Math.max(0.35, push));
  const p = avatar.root.position, step = me.speed * dt;
  const nx = p.x + Math.sin(me.heading) * step, nz = p.z + Math.cos(me.heading) * step;
  if (walkable(nx, nz)) { p.x = nx; p.z = nz; }
  else if (walkable(nx, p.z)) p.x = nx;
  else if (walkable(p.x, nz)) p.z = nz;
  else me.speed *= 0.5;
  return true;
}

// ---------- clicking & hovering ----------

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const shown = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
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

let down = null, pressTimer = null, tipTimer = null;
const canvas = renderer.domElement;
function showTip(item, x, y) {
  const tip = $('#hoverTip');
  tip.textContent = `${item.emoji} ${item.name}`;
  tip.style.left = Math.min(window.innerWidth - tip.offsetWidth - 8, Math.max(8, x - tip.offsetWidth / 2)) + 'px';
  tip.style.top = Math.max(8, y - 64) + 'px';
  tip.style.opacity = 1;
  const o = item.object.position;
  hoverRing.position.set(o.x, 0.04, o.z);
  hoverRing.visible = true;
}
canvas.addEventListener('pointerdown', e => {
  down = { x: e.clientX, y: e.clientY, t: performance.now(), long: false };
  clearTimeout(pressTimer);
  if (e.pointerType === 'touch') {
    pressTimer = setTimeout(() => {
      if (!down) return;
      const { item } = pick(down.x, down.y);
      if (!item) return;
      down.long = true;
      showTip(item, down.x, down.y);
      navigator.vibrate?.(10);
      clearTimeout(tipTimer);
      tipTimer = setTimeout(() => { $('#hoverTip').style.opacity = 0; hoverRing.visible = false; }, 1800);
    }, 450);
  }
});
canvas.addEventListener('pointermove', e => {
  if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) clearTimeout(pressTimer);
});
canvas.addEventListener('pointerup', e => {
  clearTimeout(pressTimer);
  if (!down || down.long || Math.hypot(e.clientX - down.x, e.clientY - down.y) > (e.pointerType === 'touch' ? 12 : 6)) { down = null; return; }
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
  $('#level').textContent = `⭐ Lv ${lv.level}`;
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
  const dayF = world.setTime(hour);
  renderer.toneMappingExposure = 0.62 + 0.38 * dayF;
  updateClock();
}

// "Go to" menu
const goSel = $('#goTo');
const byRoom = {};
for (const it of world.interactables) (byRoom[it.room] ||= []).push(it);
goSel.innerHTML = '<option value="">🚶 Go to…</option>' + Object.entries(ROOMS).filter(([id]) => byRoom[id]).map(([id, r]) =>
  `<optgroup label="${r.emoji} ${r.name}">${byRoom[id].filter((it, i, a) => a.findIndex(o => o.name === it.name) === i).map(it => `<option value="${it.id}">${it.emoji} ${it.name}</option>`).join('')}</optgroup>`).join('');
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
  } else if (h === 'fullscreen') {
    toggleFullscreen();
  } else openPanel(h);
}));

bus.addEventListener('change', updateHUD);

// ---------- landscape + full screen ----------
const docEl = document.documentElement;
const canFullscreen = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
const installedApp = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone;
async function toggleFullscreen() {
  try {
    if (isFullscreen()) await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else {
      await (docEl.requestFullscreen || docEl.webkitRequestFullscreen).call(docEl, { navigationUI: 'hide' });
      await screen.orientation?.lock?.('landscape').catch(() => {});
    }
  } catch (e) { toast('Full screen is not available here. Add it to your Home Screen instead!'); }
}
$('[data-hud="fullscreen"]').hidden = !canFullscreen || installedApp;
const portraitBlock = matchMedia('(pointer: coarse) and (orientation: portrait)');

if (!state.welcomed) {
  $('#welcome').hidden = false;
  $('#welcomeName').value = state.name;
  $('#welcomeGo').addEventListener('click', () => {
    state.name = $('#welcomeName').value.trim() || state.name;
    state.welcomed = true;
    save();
    $('#welcome').hidden = true;
    avatar.cheer();
    toast(`Welcome home${state.name ? ', ' + state.name : ''}! 🏡 Tap something to use it.`);
  });
}

initPanels();

// ---------- loop ----------

const clock = new THREE.Clock();
let acc = 0, accTime = 0, accSave = 0, lastRoom = null;
const viewShift = [0, 0];
const camGoal = new THREE.Vector3();
const camDelta = new THREE.Vector3();

function loop() {
  if (portraitBlock.matches) { clock.getDelta(); requestAnimationFrame(loop); return; } // paused until turned sideways
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const p = avatar.root.position;

  if (me.tween) {
    const tw = me.tween;
    tw.t += dt;
    const k = ease(Math.min(1, tw.t / tw.dur));
    p.lerpVectors(tw.from, tw.to, k);
    me.heading = tw.fromYaw + wrap(tw.toYaw - tw.fromYaw) * k;
    me.speed = 0; me.turnRate = 0;
    if (tw.t >= tw.dur) { me.tween = null; tw.onDone?.(); }
  } else if (!keyboardMove(dt)) {
    if (me.path.length) followPath(dt);
    else { me.speed = Math.max(0, me.speed - DECEL * dt); me.turnRate *= 0.8; }
  }
  avatar.root.rotation.y = me.heading;
  if (marker.material.opacity > 0) marker.scale.setScalar(1 + Math.sin(t * 6) * 0.12);

  avatar.update(dt, t, me.speed, me.turnRate);
  world.update(t, dt);

  // helpers turn to look at you when you're close
  for (const id in world.bots) {
    const b = world.bots[id], bp = b.group.position;
    if (Math.hypot(p.x - bp.x, p.z - bp.z) < 4) {
      const d = wrap(Math.atan2(p.x - bp.x, p.z - bp.z) - b.hover.rotation.y);
      b.hover.rotation.y += d * Math.min(1, dt * 4);
    }
  }

  if (currentPanel() === 'tv') world.tvMat.color.setHSL((t * 0.1) % 1, 0.6, 0.7 + Math.sin(t * 9) * 0.05);
  else world.tvMat.color.set('#3a3346');
  world.monitorMat.color.set(timer.running ? '#ffd93d' : '#7fd4ff');

  // camera glides after you, looking slightly ahead
  camGoal.set(p.x + Math.sin(me.heading) * me.speed * 0.35, 0.8 + p.y * 0.4, p.z + Math.cos(me.heading) * me.speed * 0.35);
  camDelta.copy(camGoal).sub(controls.target).multiplyScalar(1 - Math.exp(-dt * 4));
  controls.target.add(camDelta);
  camera.position.add(camDelta);
  controls.update();

  // keep your character visible next to an open panel
  const mobile = window.innerWidth <= 640;
  const want = currentPanel() ? (mobile ? [0, window.innerHeight * 0.3] : [$('#panel').offsetWidth / 2, 0]) : [0, 0];
  viewShift[0] += (want[0] - viewShift[0]) * Math.min(1, dt * 6);
  viewShift[1] += (want[1] - viewShift[1]) * Math.min(1, dt * 6);
  if (Math.abs(viewShift[0]) + Math.abs(viewShift[1]) > 0.5) camera.setViewOffset(window.innerWidth, window.innerHeight, viewShift[0], viewShift[1], window.innerWidth, window.innerHeight);
  else if (camera.view?.enabled) camera.clearViewOffset();

  const room = roomAt(p.x, p.z);
  if (room !== lastRoom) { lastRoom = room; $('#roomName').textContent = room ? `${ROOMS[room].emoji} ${ROOMS[room].name}` : ''; }

  const pill = $('#timerPill');
  pill.hidden = !timer.running;
  if (timer.running) pill.textContent = `⏱ ${timerText()} · ${timer.skill}`;

  acc += dt; accTime += dt; accSave += dt;
  if (acc > 2) { acc = 0; tickNeeds(); updateHUD(); }
  if (accTime > 20) { accTime = 0; applyTime(); }
  if (accSave > 30) { accSave = 0; save(); }

  tuneQuality(dt);
  outline.render(scene, camera);
  requestAnimationFrame(loop);
}

window.addEventListener('resize', () => {
  fitCamera();
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

// home-screen app: offline support and an install hint
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installPrompt = e;
  showInstallHint(true);
});
function showInstallHint(canPrompt) {
  if (state.installHintSeen) return;
  const el = $('#installHint');
  el.querySelector('.install-text').innerHTML = canPrompt
    ? 'Install <b>My Pet House</b> as an app on this device?'
    : 'Make this an app: tap <b>Share</b> <span aria-hidden="true">⬆️</span> then <b>Add to Home Screen</b>';
  el.querySelector('[data-install]').hidden = !canPrompt;
  el.hidden = false;
}
$('#installHint').addEventListener('click', async e => {
  if (e.target.closest('[data-install]') && installPrompt) {
    installPrompt.prompt();
    await installPrompt.userChoice.catch(() => {});
    installPrompt = null;
  }
  if (e.target.closest('[data-install], [data-dismiss]')) {
    $('#installHint').hidden = true;
    state.installHintSeen = true;
    save();
  }
});
const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone;
const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
if (iOS && !standalone && state.welcomed) setTimeout(() => showInstallHint(false), 4000);

window.__petHouse = { world, avatar, me, goTo, openPanel, refresh, renderer, scene };
