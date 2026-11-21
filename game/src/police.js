// police.js — the Solano PD and the wanted system. Stars rise when the player is seen
// committing a crime; they fall when the player stays out of sight. At 1-2 stars a patrol
// car or two gives chase; at 3 the department sets roadblocks; at 4 a helicopter joins;
// at 5 the whole city is after Rico. Getting caught on foot means BUSTED; dying means WASTED.

import { makeCar, stepCar, CAR_MODELS } from './vehicles.js';
import { AVENUES, STREETS, WORLD_W, WORLD_H, nearestRoadPoint } from './city.js';

export const MAX_WANTED = 5;

export function makePoliceState() {
  return {
    wanted: 0,
    heat: 0, // 0..100, the meter behind the stars
    calmTimer: 0,
    cars: [], // pursuing police cars (their own list, stepped like traffic cars)
    heli: null, // { x, y, angle } or null
    roadblocks: [], // { x, y, angle, cars: [...] }
    busted: false,
    sirenT: 0,
    lastSeen: { x: 0, y: 0 },
  };
}

export const POLICE_MODEL = { name: 'Solano PD Interceptor', color: '#1c2733', top: 400, accel: 300, grip: 3.5, len: 54, wid: 27, sport: true };

function addHeat(state, amount, reason) {
  state.heat = Math.min(100, state.heat + amount);
  const stars = state.heat <= 0 ? 0 : state.heat <= 14 ? 1 : state.heat <= 30 ? 2 : state.heat <= 50 ? 3 : state.heat <= 72 ? 4 : 5;
  if (stars > state.wanted) state.calmTimer = 0;
  state.wanted = stars;
  return reason;
}

export function commitCrime(state, kind) {
  // kind: 'steal' | 'hitPed' | 'shoot' | 'speeding' | 'ram' | 'kill'
  switch (kind) {
    case 'steal': return addHeat(state, 12, 'car stolen');
    case 'hitPed': return addHeat(state, 16, 'pedestrian hit');
    case 'shoot': return addHeat(state, 14, 'shots fired');
    case 'kill': return addHeat(state, 30, 'officer down');
    case 'ram': return addHeat(state, 8, 'ramming a cruiser');
    case 'speeding': return addHeat(state, 2, 'reckless driving');
    default: return addHeat(state, 5, 'disturbance');
  }
}

function spawnPoliceCar(state, px, py) {
  // Spawn on a road a little ahead of the player, in the direction they travel.
  const p = nearestRoadPoint(px + (Math.random() - 0.5) * 900, py + (Math.random() - 0.5) * 900);
  const car = makeCar(p.x, p.y, Math.random() * Math.PI * 2, 0, { police: true });
  car.model = POLICE_MODEL;
  car.cruise = 420;
  state.cars.push(car);
  return car;
}

function spawnRoadblock(state, px, py, angle) {
  const p = nearestRoadPoint(px, py);
  const block = { x: p.x, y: p.y, angle, cars: [] };
  for (let i = -1; i <= 1; i++) {
    const off = i * 46;
    const c = makeCar(p.x + Math.cos(angle + Math.PI / 2) * off, p.y + Math.sin(angle + Math.PI / 2) * off, angle, 0, { police: true, parked: true });
    c.model = POLICE_MODEL;
    block.cars.push(c);
  }
  state.roadblocks.push(block);
}

export function stepPolice(state, dt, world) {
  const { player, cars } = world;
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  const playerSpeed = player.inCar ? Math.abs(player.inCar.speed) : player.speed;
  state.sirenT += dt;

  // Wanted decays only when the player is slow and no cruiser can see them.
  const seen = state.cars.some((c) => Math.hypot(c.x - px, c.y - py) < 420) || (state.heli && Math.hypot(state.heli.x - px, state.heli.y - py) < 560);
  if (state.wanted > 0 && !seen && playerSpeed < 60) {
    state.calmTimer += dt;
    if (state.calmTimer > 4) {
      state.heat = Math.max(0, state.heat - dt * 2.2);
      const stars = state.heat <= 0 ? 0 : state.heat <= 14 ? 1 : state.heat <= 30 ? 2 : state.heat <= 50 ? 3 : state.heat <= 72 ? 4 : 5;
      state.wanted = stars;
    }
  } else {
    state.calmTimer = 0;
  }

  // Reinforcements: the department matches the star level.
  const wantCars = state.wanted === 0 ? 0 : state.wanted === 1 ? 1 : state.wanted === 2 ? 2 : state.wanted === 3 ? 3 : 4;
  while (state.cars.length < wantCars) spawnPoliceCar(state, px, py);
  while (state.cars.length > wantCars) state.cars.pop();

  // Roadblocks at 3+ stars, placed ahead on the player's road.
  if (state.wanted >= 3 && state.roadblocks.length < state.wanted - 2) {
    const ahead = player.inCar ? player.inCar.angle : player.angle;
    const bx = px + Math.cos(ahead) * 620;
    const by = py + Math.sin(ahead) * 620;
    spawnRoadblock(state, bx, by, ahead + Math.PI / 2);
  }
  if (state.wanted < 3) state.roadblocks = [];
  for (let i = state.roadblocks.length - 1; i >= 0; i--) {
    if (Math.hypot(state.roadblocks[i].x - px, state.roadblocks[i].y - py) > 1600) state.roadblocks.splice(i, 1);
  }

  // Helicopter at 4+ stars: a spotlight that never loses the player.
  if (state.wanted >= 4 && !state.heli) state.heli = { x: px - 300, y: py - 300, angle: 0, rotor: 0 };
  if (state.wanted < 4) state.heli = null;
  if (state.heli) {
    const h = state.heli;
    h.rotor += dt * 22;
    const dx = px - h.x; const dy = py - h.y;
    const d = Math.hypot(dx, dy) || 1;
    const speed = 260;
    h.x += (dx / d) * speed * dt;
    h.y += (dy / d) * speed * dt;
    h.angle = Math.atan2(dy, dx);
  }

  // Pursuit: each cruiser steers at the player, rams, and slows when it catches up.
  for (const c of state.cars) {
    const dx = px - c.x; const dy = py - c.y;
    const d = Math.hypot(dx, dy) || 1;
    const want = Math.atan2(dy, dx);
    let diff = want - c.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.4));
    const throttle = d > 60 ? 1 : 0.2;
    stepCar(c, dt, { throttle, steer, brake: d < 40 }, cars);
    // A cruiser that touches the player's car hard is a ram; on foot, touching means arrest.
    if (d < 46) {
      if (player.inCar) {
        const impact = Math.abs(c.speed) + Math.abs(player.inCar.speed);
        if (impact > 260) {
          player.inCar.speed *= 0.72;
          c.speed *= 0.5;
          world.events.push({ type: 'ram', at: { x: px, y: py } });
        }
      } else if (!state.busted) {
        state.busted = true;
        world.events.push({ type: 'busted', at: { x: px, y: py } });
      }
    }
  }
  return state;
}

/** A police car the player just rammed hard fights back with more heat. */
export function policeRamHeat(state) {
  commitCrime(state, 'ram');
}

export function wantedStars(state) { return state.wanted; }
export function policeCarCount(state) { return state.cars.length; }

export function clearWanted(state) {
  state.wanted = 0;
  state.heat = 0;
  state.cars = [];
  state.roadblocks = [];
  state.heli = null;
}
