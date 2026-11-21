// main.js — Port Solano: boot, game loop, input, missions, wanted heat, dialogue and
// save. The whole game is one plain object ("game") that every system reads and writes,
// so the renderer, the HUD and the minimap always agree about the world.

import { WORLD_W, WORLD_H, AVENUES, STREETS, nearestRoadPoint, districtAt } from './city.js';
import { makeCar, stepCar, randomStreetCar, recycleTraffic, CAR_MODELS } from './vehicles.js';
import { makePlayer, stepPlayer, nearestEnterableCar, enterCar, exitCar, damagePlayer, healPlayer } from './player.js';
import { makePedestrian, spawnPedestrianNear, stepPedestrians, recyclePedestrians } from './pedestrians.js';
import { makePoliceState, commitCrime, stepPolice, clearWanted, MAX_WANTED } from './police.js';
import { makeBullets, fireBullet, stepBullets, punchHit, makeEnemy, stepEnemies } from './combat.js';
import {
  makeMissionState, MISSIONS, currentMission, currentObjective, startMission,
  advanceObjective, failMission, retryMission, debtLeft,
} from './missions.js';
import { drawWorld, makeCamera, updateCamera } from './render.js';
import { drawHUD } from './hud.js';
import { makeAudio, ensureAudio, setEngine, setSiren, playShot, playPickup, playMissionComplete, playCrash, playBusted, setMuted } from './audio.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { applyShotParam } from './scenes.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const $ = (id) => document.getElementById(id);
const menuEl = $('menu');
const toastEl = $('toast');
const dialogEl = $('dialog');
const hintEl = $('hint');
const objectiveEl = $('objective');
const pausedEl = $('paused');
const overEl = $('over');

/** The whole game state, in one place. */
const game = {
  time: 0,
  state: 'menu', // menu | playing | paused | over
  player: makePlayer(1420, 1900),
  cars: [],
  peds: [],
  police: makePoliceState(),
  missions: makeMissionState(),
  enemies: [],
  bullets: makeBullets(),
  particles: [],
  skids: [],
  camera: makeCamera(),
  audio: makeAudio(),
  events: [],
  gunshotAt: null,
  aiming: false,
  mouse: { x: 0, y: 0, worldX: 0, worldY: 0, down: false },
  keys: {},
  stats: { carsStolen: 0, bestWanted: 0, shotsFired: 0, missionsDone: 0 },
  autopilot: null,
  photoMode: false,
  zoomMul: 1,
  saveTimer: 0,
  dialogTimer: 0,
  toastTimer: 0,
  hintTimer: 0,
  lastObjectiveKey: '',
  crashCooldown: 0,
  ramCooldown: 0,
};

// ------------------------------------------------------------------ helpers

export function toast(text, seconds = 4) {
  toastEl.textContent = text;
  toastEl.style.display = 'block';
  game.toastTimer = seconds;
}

export function showDialog(who, text, seconds = 5) {
  $('dlgWho').textContent = who + ':';
  $('dlgText').textContent = text;
  dialogEl.style.display = 'block';
  game.dialogTimer = seconds;
}

export function showHint(text, seconds = 5) {
  hintEl.textContent = text;
  hintEl.style.display = 'block';
  game.hintTimer = seconds;
}

// The scene presets (scenes.js) call these through the game object.
game.toast = toast;
game.showDialog = showDialog;
game.hint = showHint;

export function addParticles(x, y, color, n, speed = 160) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.8);
    game.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.5 + Math.random() * 0.5, max: 1,
      size: 2 + Math.random() * 3, color,
    });
  }
}

// World helpers the mission module calls back into.
game.spawnMissionCar = function (spec) {
  const car = makeCar(spec.x, spec.y, spec.angle, spec.model, { parked: true });
  game.cars.push(car);
  return car;
};
game.spawnGuards = function (x, y, n) {
  const guards = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const e = makeEnemy(x + Math.cos(a) * 90, y + Math.sin(a) * 90, { shirt: '#5b2d8e' });
    guards.push(e);
    game.enemies.push(e);
  }
  return guards;
};
game.setWanted = function (stars) {
  const heatFor = [0, 10, 22, 42, 62, 85];
  game.police.heat = heatFor[Math.min(MAX_WANTED, Math.max(0, stars))];
  game.police.wanted = stars;
  game.police.calmTimer = 0;
};
game.clearWanted = function () { clearWanted(game.police); };

// ------------------------------------------------------------------ world setup

function spawnTrafficNear(px, py) {
  // A car on a road 500-900 px from the player, already rolling.
  const a = Math.random() * Math.PI * 2;
  const d = 500 + Math.random() * 400;
  const p = nearestRoadPoint(px + Math.cos(a) * d, py + Math.sin(a) * d);
  const vertical = p.vertical;
  const car = makeCar(p.x, p.y, vertical ? (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (Math.random() < 0.5 ? 0 : Math.PI), (Math.random() * CAR_MODELS.length) | 0, { traffic: true });
  car.speed = 120 + Math.random() * 80;
  return car;
}

function seedWorld() {
  // Rico starts on The Strip, next to Otto's garage, with his own beater.
  game.player = makePlayer(1420, 1900);
  const starter = makeCar(1460, 1900, 0, 3, { parked: true });
  game.cars = [starter];
  for (let i = 0; i < 13; i++) game.cars.push(spawnTrafficNear(1420, 1900));
  game.peds = [];
  for (let i = 0; i < 24; i++) game.peds.push(spawnPedestrianNear(1420, 1900));
  game.camera.x = 1420; game.camera.y = 1900;
  game.camera.zoom = 1;
}

function applySave(data) {
  game.player.cash = data.cash || 0;
  game.missions.index = Math.min(data.missionIndex || 0, MISSIONS.length);
  game.missions.paidTotal = data.paidTotal || 0;
  game.stats.bestWanted = data.bestWanted || 0;
  game.stats.carsStolen = data.carsStolen || 0;
  game.player.x = data.x || 1420;
  game.player.y = data.y || 1900;
  game.camera.x = game.player.x;
  game.camera.y = game.player.y;
  toast(`Welcome back, Rico. Debt left: $${debtLeft(game.missions).toLocaleString('en-US')}.`);
}

// ------------------------------------------------------------------ input

const keyMap = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  Space: 'brake',
};

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') e.preventDefault();
  const k = keyMap[e.code];
  if (k) game.keys[k] = true;
  if (e.code === 'KeyE' && game.state === 'playing') tryEnterExitCar();
  if (e.code === 'KeyF' && game.state === 'playing') tryPunch();
  if (e.code === 'KeyR' && game.state === 'playing') retryCurrentMission();
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  if (e.code === 'KeyM') {
    setMuted(game.audio, !game.audio.muted);
    toast(game.audio.muted ? 'Sound muted.' : 'Sound on.');
  }
  if (e.code === 'KeyC') {
    game.zoomMul = game.zoomMul === 1 ? 0.72 : game.zoomMul === 0.72 ? 1.3 : 1;
  }
});
window.addEventListener('keyup', (e) => {
  const k = keyMap[e.code];
  if (k) game.keys[k] = false;
});

canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  game.mouse.x = e.clientX - r.left;
  game.mouse.y = e.clientY - r.top;
  game.aiming = true;
});
canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  game.mouse.down = true;
  ensureAudio(game.audio);
  if (game.state === 'playing') tryShoot();
});
window.addEventListener('mouseup', () => { game.mouse.down = false; });

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// ------------------------------------------------------------------ actions

function tryEnterExitCar() {
  const p = game.player;
  if (p.inCar) {
    exitCar(p);
    showHint('On foot — WASD to walk, F to punch, click to shoot.');
    return;
  }
  const car = nearestEnterableCar(p, game.cars);
  if (!car) return;
  const stolen = enterCar(p, car);
  if (stolen) {
    game.stats.carsStolen++;
    commitCrime(game.police, 'steal');
    toast(`You stole the ${car.model.name}. The owner is yelling — and so is the radio.`);
    addParticles(car.x, car.y, '#ffd23e', 10, 120);
  } else {
    showHint(`In the ${car.model.name}. W/S to drive, SPACE to handbrake.`);
  }
  ensureAudio(game.audio);
}

function tryPunch() {
  const p = game.player;
  if (p.inCar || p.punching > 0) return;
  p.punching = 0.28;
  const hit = punchHit(p, game.peds, game.enemies);
  if (hit) {
    addParticles(hit.at.x, hit.at.y, '#ff5a5a', 8, 140);
    if (hit.kind === 'ped') {
      commitCrime(game.police, 'hitPed');
      toast('You knocked a pedestrian flat. Someone called it in.');
    }
  }
}

function tryShoot() {
  const p = game.player;
  if (p.inCar || p.dead) return;
  if (p.ammo <= 0) {
    toast('Out of ammo — your fists will have to do for now (F to punch).');
    return;
  }
  p.ammo--;
  game.stats.shotsFired++;
  p.shooting = 0.18;
  p.angle = Math.atan2(game.mouse.worldY - p.y, game.mouse.worldX - p.x);
  fireBullet(game.bullets, p.x, p.y, p.angle, { fromPlayer: true });
  game.gunshotAt = { x: p.x, y: p.y };
  commitCrime(game.police, 'shoot');
  playShot(game.audio);
  addParticles(p.x + Math.cos(p.angle) * 30, p.y + Math.sin(p.angle) * 30, '#ffe9a0', 5, 200);
}

function retryCurrentMission() {
  const m = currentMission(game.missions);
  if (!m) return;
  retryMission(game.missions, game);
  toast(`${m.title} — restarted.`);
  showDialog('OTTO VANE', m.brief, 7);
}

function togglePause() {
  if (game.state === 'playing') {
    game.state = 'paused';
    pausedEl.style.display = 'flex';
    $('pauseStats').innerHTML =
      `Cash $${game.player.cash.toLocaleString('en-US')} &nbsp;·&nbsp; Debt $${debtLeft(game.missions).toLocaleString('en-US')}<br>` +
      `Jobs done ${game.missions.index}/5 &nbsp;·&nbsp; Cars stolen ${game.stats.carsStolen} &nbsp;·&nbsp; Best wanted ${'★'.repeat(game.stats.bestWanted) || '—'}<br>` +
      `Progress saved. Press P or RESUME to keep driving.`;
    saveGame(game);
  } else if (game.state === 'paused') {
    game.state = 'playing';
    pausedEl.style.display = 'none';
  }
}

function gameOver(kind) {
  game.state = 'over';
  overEl.style.display = 'flex';
  playBusted(game.audio);
  if (kind === 'busted') {
    $('overTitle').textContent = 'BUSTED';
    $('overText').textContent = 'The Solano PD hauled you in. Otto posted bail — but the job is blown and the heat is on. Try the job again, and this time stay out of sight.';
    if (game.missions.active) failMission(game.missions, 'busted');
  } else {
    $('overTitle').textContent = 'WASTED';
    $('overText').textContent = 'Rico wakes up in the South Beach clinic, $500 lighter and twice as stubborn. The debt is still waiting — and so is Otto.';
    game.player.cash = Math.max(0, game.player.cash - 500);
    if (game.missions.active) failMission(game.missions, 'wasted');
  }
  saveGame(game);
}

function respawn() {
  overEl.style.display = 'none';
  const p = game.player;
  p.dead = false;
  p.health = p.maxHealth;
  p.ammo = Math.max(p.ammo, 12);
  if (p.inCar) p.inCar = null;
  p.x = 1420; p.y = 1900; p.vx = 0; p.vy = 0;
  game.police.busted = false;
  clearWanted(game.police);
  game.camera.x = p.x; game.camera.y = p.y;
  if (game.missions.failed) {
    retryMission(game.missions, game);
    const m = currentMission(game.missions);
    if (m) showDialog('OTTO VANE', m.brief, 7);
  }
  game.state = 'playing';
}

// ------------------------------------------------------------------ missions

function checkObjectives() {
  const m = currentMission(game.missions);
  if (!m || !game.missions.active) return;
  const obj = currentObjective(game.missions);
  if (!obj) return;
  const p = game.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;

  let done = false;
  if (obj.type === 'steal') {
    if (p.inCar === game.missions.missionCar) done = true;
  } else if (obj.type === 'goto') {
    const inRange = Math.hypot(obj.x - px, obj.y - py) < obj.r;
    const carOk = !obj.needCar || !!p.inCar;
    if (inRange && carOk) done = true;
  } else if (obj.type === 'collect') {
    if (!p.inCar && Math.hypot(obj.x - p.x, obj.y - p.y) < obj.r) done = true;
  } else if (obj.type === 'escape') {
    if (game.police.wanted === 0) done = true;
  }

  if (done) {
    if (obj.type === 'collect') {
      game.missions.collected++;
      playPickup(game.audio);
      addParticles(obj.x, obj.y, '#57d977', 14, 160);
      toast(`Cash drop secured (${game.missions.collected}/3).`);
    }
    const res = advanceObjective(game.missions, game);
    if (res.missionDone) {
      game.stats.missionsDone++;
      playMissionComplete(game.audio);
      showDialog('OTTO VANE', `Job done, Rico. $${res.pay.toLocaleString('en-US')} off the debt. ${debtLeft(game.missions) > 0 ? `$${debtLeft(game.missions).toLocaleString('en-US')} to go.` : 'Debt cleared. Port Solano is yours.'}`, 7);
      toast(`JOB COMPLETE — $${res.pay.toLocaleString('en-US')} earned.`);
      saveGame(game);
      if (game.missions.done) {
        toast('DEBT CLEARED! You are a free man, Rico. Free roam — enjoy the city.', 8);
      } else {
        const next = currentMission(game.missions);
        if (next) {
          setTimeout(() => { if (game.state === 'playing') showDialog('OTTO VANE', next.brief, 8); }, 4500);
        }
      }
    } else {
      playPickup(game.audio);
    }
  }
}

function updateObjectivePanel() {
  // The canvas HUD already draws the mission tracker; the DOM panel stays hidden
  // so the objective is never shown twice. We only track the key for state changes.
  const m = currentMission(game.missions);
  const key = m ? `${game.missions.index}:${game.missions.objIndex}:${game.missions.active}` : 'done';
  if (key !== game.lastObjectiveKey) {
    game.lastObjectiveKey = key;
    objectiveEl.style.display = 'none';
  }
}

// ------------------------------------------------------------------ collisions

function checkPedestrianHits() {
  const p = game.player;
  if (!p.inCar) return;
  const car = p.inCar;
  if (Math.abs(car.speed) < 120) return;
  for (const ped of game.peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < 30) {
      ped.state = 'down';
      commitCrime(game.police, 'hitPed');
      addParticles(ped.x, ped.y, '#ff5a5a', 12, 180);
      playCrash(game.audio, false);
      toast('You hit a pedestrian! The whole street saw it.');
    }
  }
}

function processEvents() {
  for (const ev of game.events) {
    if (ev.type === 'busted') gameOver('busted');
    else if (ev.type === 'ram') {
      if (game.ramCooldown <= 0) {
        game.ramCooldown = 4;
        commitCrime(game.police, 'ram');
        playCrash(game.audio, true);
        addParticles(ev.at.x, ev.at.y, '#ffb3b3', 10, 160);
      }
    }
  }
  game.events = [];
  game.crashCooldown = Math.max(0, game.crashCooldown - 1 / 60);
  game.ramCooldown = Math.max(0, game.ramCooldown - 1 / 60);
}

function processBulletHits(hits) {
  for (const h of hits) {
    addParticles(h.at.x, h.at.y, '#ff5a5a', 8, 160);
    if (h.kind === 'ped' && h.fromPlayer) {
      h.ref.state = 'down';
      commitCrime(game.police, 'hitPed');
    } else if (h.kind === 'enemy' && h.fromPlayer) {
      h.ref.hp -= h.damage;
      if (h.ref.hp <= 0) {
        addParticles(h.at.x, h.at.y, '#c22f22', 16, 200);
        game.player.cash += 50;
        toast('Crew member down. You pocketed $50.');
      }
    } else if (h.kind === 'policeCar' && h.fromPlayer) {
      commitCrime(game.police, 'kill');
      toast('You shot at a cruiser. Every cop in the city heard that.');
    } else if (h.kind === 'player') {
      damagePlayer(game.player, h.damage);
      addParticles(h.at.x, h.at.y, '#ff5a5a', 8, 160);
      if (game.player.dead) gameOver('wasted');
    }
  }
}

// ------------------------------------------------------------------ main loop

let lastT = 0;

function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
  lastT = t;
  if (game.state !== 'playing') {
    // Still draw the world behind menus, frozen in time.
    drawWorld(ctx, { w: canvas.width, h: canvas.height }, game);
    if (game.state === 'menu' || game.state === 'paused' || game.state === 'over') drawHUD(ctx, { w: canvas.width, h: canvas.height }, game);
    return;
  }
  game.time += dt;
  const p = game.player;

  // Mouse position in world space (for aiming).
  const cam = game.camera;
  game.mouse.worldX = cam.x + (game.mouse.x - canvas.width / 2) / cam.zoom;
  game.mouse.worldY = cam.y + (game.mouse.y - canvas.height / 2) / cam.zoom;

  // --- input ---------------------------------------------------------------
  const input = {
    up: !!game.keys.up, down: !!game.keys.down,
    left: !!game.keys.left, right: !!game.keys.right,
    run: !!game.keys.run, brake: !!game.keys.brake,
  };
  if (game.autopilot && game.time < game.autopilot.until) {
    input.up = true;
    input.left = false; input.right = false;
  } else if (game.autopilot) {
    game.autopilot = null;
  }

  // --- player / car ---------------------------------------------------------
  if (p.inCar) {
    const car = p.inCar;
    const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    const throttle = (input.up ? 1 : 0) + (input.down ? -0.7 : 0);
    const ev = stepCar(car, dt, { throttle, steer, brake: input.brake }, game.cars);
    if (ev.collided && game.crashCooldown <= 0) {
      game.crashCooldown = 0.8;
      playCrash(game.audio, Math.abs(car.speed) > 200);
      addParticles(car.x, car.y, '#cfc9b8', 10, 140);
      if (Math.abs(car.speed) > 200) commitCrime(game.police, 'speeding');
    }
    if (car.skid > 0) {
      const bx = car.x - Math.cos(car.angle) * 24;
      const by = car.y - Math.sin(car.angle) * 24;
      game.skids.push({ x0: bx, y0: by, x1: bx + car.vx * dt, y1: by + car.vy * dt, life: 6 });
    }
    p.x = car.x; p.y = car.y; p.angle = car.angle;
  } else {
    stepPlayer(p, dt, input, game.cars);
    if (input.up || input.down || input.left || input.right) {
      // Face the mouse when aiming, otherwise face where we walk.
      if (game.aiming && game.mouse.down) {
        p.angle = Math.atan2(game.mouse.worldY - p.y, game.mouse.worldX - p.x);
      }
    }
    if (game.mouse.down && game.time - (game.lastShot || 0) > 0.28) {
      game.lastShot = game.time;
      tryShoot();
    }
  }

  // --- traffic, pedestrians, police -----------------------------------------
  for (const c of game.cars) {
    if (c !== p.inCar && c.traffic) stepCar(c, dt, null, game.cars);
  }
  recycleTraffic(game.cars, p.x, p.y, () => spawnTrafficNear(p.x, p.y));
  stepPedestrians(game.peds, dt, { player: p, cars: game.cars, gunshotAt: game.gunshotAt });
  game.gunshotAt = null;
  recyclePedestrians(game.peds, p.x, p.y, 24);
  stepPolice(game.police, dt, { player: p, cars: game.cars, events: game.events });
  if (game.police.wanted > game.stats.bestWanted) game.stats.bestWanted = game.police.wanted;

  // --- combat ----------------------------------------------------------------
  stepEnemies(game.enemies, dt, p, game.bullets, () => playShot(game.audio));
  const hits = stepBullets(game.bullets, dt, {
    peds: game.peds,
    enemies: game.enemies,
    policeCars: game.police.cars,
    player: p,
    playerCar: p.inCar,
  });
  processBulletHits(hits);
  checkPedestrianHits();

  // --- missions ---------------------------------------------------------------
  checkObjectives();
  updateObjectivePanel();

  // --- particles / skids ------------------------------------------------------
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const pt = game.particles[i];
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.vx *= 0.94; pt.vy *= 0.94;
    pt.life -= dt;
    if (pt.life <= 0) game.particles.splice(i, 1);
  }
  for (let i = game.skids.length - 1; i >= 0; i--) {
    game.skids[i].life -= dt;
    if (game.skids[i].life <= 0) game.skids.splice(i, 1);
  }

  // --- audio ------------------------------------------------------------------
  ensureAudio(game.audio);
  const speedNorm = p.inCar ? Math.min(1, Math.abs(p.inCar.speed) / 430) : 0;
  setEngine(game.audio, speedNorm, !!p.inCar);
  const nearestCop = game.police.cars.reduce((m, c) => Math.min(m, Math.hypot(c.x - p.x, c.y - p.y)), Infinity);
  setSiren(game.audio, game.police.wanted > 0, nearestCop < 600);

  // --- camera + draw ------------------------------------------------------------
  updateCamera(cam, p.x, p.y, !!p.inCar, dt);
  cam.zoomMul = game.zoomMul;
  const view = { w: canvas.width, h: canvas.height };
  drawWorld(ctx, view, game);
  drawHUD(ctx, view, game);

  // --- timers ---------------------------------------------------------------------
  if (game.dialogTimer > 0) {
    game.dialogTimer -= dt;
    if (game.dialogTimer <= 0) dialogEl.style.display = 'none';
  }
  if (game.toastTimer > 0) {
    game.toastTimer -= dt;
    if (game.toastTimer <= 0) toastEl.style.display = 'none';
  }
  if (game.hintTimer > 0) {
    game.hintTimer -= dt;
    if (game.hintTimer <= 0) hintEl.style.display = 'none';
  }
  game.saveTimer += dt;
  if (game.saveTimer > 25) {
    game.saveTimer = 0;
    saveGame(game);
  }
  processEvents();
}

// ------------------------------------------------------------------ boot

seedWorld();
if (hasSave()) {
  const data = loadGame();
  if (data) applySave(data);
}

$('playBtn').addEventListener('click', () => {
  ensureAudio(game.audio);
  menuEl.style.display = 'none';
  game.state = 'playing';
  const m = currentMission(game.missions);
  if (m && !game.missions.active && !game.missions.done) {
    startMission(game.missions, game);
    showDialog('OTTO VANE', m.brief, 8);
    showHint('Follow the yellow marker. E to steal a car, WASD to drive.');
  } else if (game.missions.done) {
    toast('Debt cleared — free roam. Port Solano is yours, Rico.');
  }
});
$('resumeBtn').addEventListener('click', togglePause);
$('retryBtn').addEventListener('click', respawn);

// Photo mode: skip the menu and stage the requested scene straight away.
const staged = applyShotParam(game);
if (staged) {
  menuEl.style.display = 'none';
  game.state = 'playing';
  ensureAudio(game.audio);
  game.audio.muted = true;
  setMuted(game.audio, true);
}

requestAnimationFrame(frame);
