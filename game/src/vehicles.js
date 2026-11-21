// vehicles.js — cars: the player's ride, stealable street cars, and ambient traffic.
// One simple arcade model drives them all: throttle, steering that scales with speed,
// a handbrake that breaks grip, and soft collisions with buildings, cars and kerbs.

import { AVENUES, STREETS, ROAD_W, WORLD_W, WORLD_H, onRoad, resolveBuildingCollision, nearestRoadPoint } from './city.js';

export const CAR_MODELS = [
  { name: 'Vento GT', color: '#e33f2f', top: 430, accel: 300, grip: 3.4, len: 52, wid: 26, sport: true },
  { name: 'Solano Cruiser', color: '#2f7fc4', top: 330, accel: 230, grip: 3.0, len: 54, wid: 27, sport: false },
  { name: 'Marina Taxi', color: '#f2c230', top: 310, accel: 210, grip: 3.0, len: 54, wid: 27, sport: false, taxi: true },
  { name: 'Palm Sedan', color: '#7fb069', top: 320, accel: 220, grip: 3.0, len: 52, wid: 26, sport: false },
  { name: 'Dune Buggy', color: '#e08a3c', top: 360, accel: 260, grip: 2.6, len: 50, wid: 28, sport: true },
  { name: 'Harbor Van', color: '#8d99ae', top: 280, accel: 190, grip: 2.7, len: 60, wid: 28, sport: false },
  { name: 'Night Coupe', color: '#5b2d8e', top: 410, accel: 280, grip: 3.3, len: 52, wid: 26, sport: true },
  { name: 'Beach Pickup', color: '#3fa7a0', top: 340, accel: 240, grip: 2.9, len: 58, wid: 27, sport: false },
];

export function makeCar(x, y, angle, modelIdx, opts = {}) {
  const m = CAR_MODELS[modelIdx % CAR_MODELS.length];
  return {
    x, y, angle, speed: 0, model: m, modelIdx,
    vx: 0, vy: 0, // velocity components, for drift feel
    traffic: !!opts.traffic,
    police: !!opts.police,
    stolen: false,
    parked: !!opts.parked,
    driver: opts.traffic ? { patience: 0 } : null,
    // traffic AI state
    route: null, routeIdx: 0, cruise: 150 + Math.random() * 90,
    stopped: 0, skid: 0, smoke: 0,
    id: Math.random().toString(36).slice(2, 9),
  };
}

/** A random street car, parked or cruising, for the player to find and steal. */
export function randomStreetCar() {
  const ax = AVENUES[(Math.random() * AVENUES.length) | 0];
  const sy = STREETS[(Math.random() * STREETS.length) | 0];
  const onAvenue = Math.random() < 0.5;
  const x = onAvenue ? ax + (Math.random() < 0.5 ? -22 : 22) : ax + (Math.random() - 0.5) * 300;
  const y = onAvenue ? sy + (Math.random() - 0.5) * 300 : sy + (Math.random() < 0.5 ? -22 : 22);
  const angle = onAvenue ? (Math.random() < 0.5 ? 0 : Math.PI) : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
  return makeCar(x, y, angle, (Math.random() * CAR_MODELS.length) | 0, { parked: Math.random() < 0.45, traffic: Math.random() >= 0.45 });
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

/**
 * Step one car for dt seconds.
 * input: { throttle: -1..1, steer: -1..1, brake: bool } for the player; traffic cars
 * drive themselves. Returns a small event bag (collided, offroad) for sound and wanted.
 */
export function stepCar(car, dt, input, others) {
  const m = car.model;
  const events = { collided: false, offroad: false, scrape: false };
  let throttle = 0;
  let steer = 0;
  let brake = false;

  if (car.traffic) {
    const t = trafficDrive(car, dt);
    throttle = t.throttle; steer = t.steer; brake = t.brake;
  } else if (input) {
    throttle = input.throttle; steer = input.steer; brake = input.brake;
  }

  const forward = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
  const speedAlong = car.vx * forward.x + car.vy * forward.y;
  const accel = m.accel * (throttle > 0 ? 1 : 0.62);
  car.speed = clamp(car.speed + accel * throttle * dt - (brake ? 520 * dt * Math.sign(car.speed) : 0) - Math.sign(car.speed) * 26 * dt, -m.top * 0.45, m.top);

  // Steering bites harder at low speed, less at top speed; handbrake loosens the rear.
  const steerAuthority = clamp(Math.abs(car.speed) / 60, 0, 1) * (1 - clamp(Math.abs(car.speed) / m.top, 0, 0.72));
  car.angle += steer * steerAuthority * (brake ? 3.4 : 2.4) * dt * Math.sign(car.speed || 1);

  // Rebuild velocity from the new heading, keeping a drift component.
  const grip = brake ? 1.6 : m.grip;
  const nx = Math.cos(car.angle); const ny = Math.sin(car.angle);
  const along = car.vx * nx + car.vy * ny;
  const sideX = car.vx - along * nx; const sideY = car.vy - along * ny;
  const decay = Math.exp(-grip * dt);
  car.vx = along * nx + sideX * decay;
  car.vy = along * ny + sideY * decay;
  // Blend in the target speed along the heading.
  car.vx += (nx * car.speed - car.vx) * Math.min(1, 6 * dt);
  car.vy += (ny * car.speed - car.vy) * Math.min(1, 6 * dt);

  car.x += car.vx * dt;
  car.y += car.vy * dt;
  if (Math.abs(sideX) + Math.abs(sideY) > 60 && Math.abs(car.speed) > 120) car.skid = 0.25;
  else car.skid = Math.max(0, car.skid - dt);

  // Buildings: slide along them, lose speed, report the bump.
  const before = { x: car.x, y: car.y };
  if (resolveBuildingCollision(car, 24)) {
    const dx = car.x - before.x; const dy = car.y - before.y;
    if (Math.abs(car.speed) > 90) events.collided = true;
    car.speed *= 0.55;
    car.vx *= 0.5; car.vy *= 0.5;
    void dx; void dy;
  }
  if (car.x < 120) { car.x = 120; car.speed *= 0.4; } // the sea wall: no driving into the surf
  if (car.x > WORLD_W - 20) { car.x = WORLD_W - 20; car.speed *= 0.4; }
  if (car.y < 20) { car.y = 20; car.speed *= 0.4; }
  if (car.y > WORLD_H - 20) { car.y = WORLD_H - 20; car.speed *= 0.4; }
  if (!onRoad(car.x, car.y)) {
    car.speed = clamp(car.speed, -m.top * 0.3, m.top * 0.55); // off-road drag
    events.offroad = true;
  }

  // Soft car-to-car bumps.
  if (others) {
    for (const o of others) {
      if (o === car) continue;
      const dx = o.x - car.x; const dy = o.y - car.y;
      const d = Math.hypot(dx, dy);
      const min = 44;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const ux = dx / d; const uy = dy / d;
        car.x -= ux * push; car.y -= uy * push;
        if (!o.traffic || o.parked) { o.x += ux * push; o.y += uy * push; }
        if (Math.abs(car.speed) > 110) events.collided = true;
        car.speed *= 0.92;
      }
    }
  }
  return events;
}

/** Traffic AI: pick a route along avenues/streets, follow it, stop for cars ahead. */
function trafficDrive(car, dt) {
  if (!car.route || car.routeIdx >= car.route.length) {
    car.route = buildRoute(car);
    car.routeIdx = 0;
  }
  const target = car.route[car.routeIdx];
  const dx = target.x - car.x; const dy = target.y - car.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 26) { car.routeIdx++; return { throttle: 0.4, steer: 0, brake: false }; }
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = clamp(diff * 2.2, -1, 1);
  const speedTarget = car.cruise;
  const throttle = car.speed < speedTarget ? 0.7 : 0.05;
  return { throttle, steer, brake: Math.abs(diff) > 1.4 && car.speed > 60 };
}

/** A route is a short chain of road junctions: straight, one turn, straight. */
function buildRoute(car) {
  const pts = [];
  const p = nearestRoadPoint(car.x, car.y);
  let cx = p.x; let cy = p.y;
  pts.push({ x: cx, y: cy });
  const hops = 2 + ((Math.random() * 2) | 0);
  for (let h = 0; h < hops; h++) {
    if (Math.random() < 0.5) {
      const ax = AVENUES[(Math.random() * AVENUES.length) | 0];
      pts.push({ x: ax, y: cy });
      cx = ax;
    } else {
      const sy = STREETS[(Math.random() * STREETS.length) | 0];
      pts.push({ x: cx, y: sy });
      cy = sy;
    }
  }
  return pts;
}

/** Keep traffic near the player: recycle cars that drift too far away. */
export function recycleTraffic(cars, px, py, spawnFn) {
  for (let i = cars.length - 1; i >= 0; i--) {
    const c = cars[i];
    if (!c.traffic || c.police) continue;
    if (Math.hypot(c.x - px, c.y - py) > 1500) {
      cars.splice(i, 1);
      const fresh = spawnFn();
      if (fresh) cars.push(fresh);
    }
  }
}

export function carBounds(car) {
  return { x: car.x, y: car.y, len: car.model.len, wid: car.model.wid, angle: car.angle };
}
