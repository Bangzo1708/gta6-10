// player.js — Rico Vega on foot: walk, run, punch, shoot, and get in and out of cars.
// On foot the camera sits closer and the world feels bigger; in a car it pulls back.

import { resolveBuildingCollision, inSea } from './city.js';

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, // facing north
    vx: 0, vy: 0,
    health: 100, maxHealth: 100,
    inCar: null,
    cash: 0,
    ammo: 24,
    punching: 0,
    shooting: 0,
    speed: 0,
    runStamina: 100,
    dead: false,
    swimSlow: false,
  };
}

const WALK_SPEED = 150;
const RUN_SPEED = 235;

export function stepPlayer(p, dt, input, cars) {
  if (p.dead) return { moved: false };
  let mx = 0; let my = 0;
  if (input.up) my -= 1;
  if (input.down) my += 1;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  const len = Math.hypot(mx, my) || 1;
  mx /= len; my /= len;

  const running = input.run && p.runStamina > 5;
  const target = (running ? RUN_SPEED : WALK_SPEED) * (inSea(p.x, p.y) ? 0.45 : 1);
  p.swimSlow = inSea(p.x, p.y);
  p.vx += (mx * target - p.vx) * Math.min(1, 12 * dt);
  p.vy += (my * target - p.vy) * Math.min(1, 12 * dt);
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.speed = Math.hypot(p.vx, p.vy);
  if (p.speed > 12) p.angle = Math.atan2(p.vy, p.vx);
  p.runStamina = running && p.speed > 100 ? Math.max(0, p.runStamina - 22 * dt) : Math.min(100, p.runStamina + 14 * dt);
  resolveBuildingCollision(p, 13);

  // Soft-push cars so the player cannot walk through them.
  for (const c of cars) {
    const dx = p.x - c.x; const dy = p.y - c.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.01 && d < 34) {
      p.x = c.x + (dx / d) * 34;
      p.y = c.y + (dy / d) * 34;
    }
  }
  p.punching = Math.max(0, p.punching - dt);
  p.shooting = Math.max(0, p.shooting - dt);
  return { moved: p.speed > 20 };
}

/** The nearest car the player can enter (within reach of its door). */
export function nearestEnterableCar(p, cars) {
  let best = null; let bd = 78;
  for (const c of cars) {
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

/** Put the player into a car; returns whether the car was stolen (it had an owner). */
export function enterCar(p, car) {
  const stolen = car.traffic || car.parked;
  p.inCar = car;
  car.traffic = false;
  car.parked = false;
  car.driver = null;
  car.stolen = stolen;
  return stolen;
}

export function exitCar(p) {
  const car = p.inCar;
  if (!car) return null;
  const side = { x: Math.cos(car.angle + Math.PI / 2), y: Math.sin(car.angle + Math.PI / 2) };
  p.x = car.x + side.x * 34;
  p.y = car.y + side.y * 34;
  p.angle = car.angle;
  p.vx = 0; p.vy = 0;
  p.inCar = null;
  resolveBuildingCollision(p, 13);
  return car;
}

export function damagePlayer(p, amount) {
  if (p.dead) return;
  p.health -= amount;
  if (p.health <= 0) { p.health = 0; p.dead = true; }
}

export function healPlayer(p, amount) {
  p.health = Math.min(p.maxHealth, p.health + amount);
}
