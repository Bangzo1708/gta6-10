// pedestrians.js — the people of Port Solano: shoppers, beachgoers, joggers and
// street vendors who stroll the sidewalks, scatter when a car screeches past or a shot
// rings out, and occasionally scream loud enough for the police to notice.

import { WORLD_W, WORLD_H, onRoad, onBeach, resolveBuildingCollision, districtAt } from './city.js';

const SKINS = ['#f2c89b', '#e8b07d', '#c98d5f', '#a06b42', '#8a5a34', '#f7d7b0'];
const SHIRTS = ['#e33f2f', '#2f7fc4', '#f2c230', '#7fb069', '#e08a3c', '#5b2d8e', '#3fa7a0', '#ffffff', '#222831', '#d3547a'];
const PANTS = ['#2b3a4a', '#4a4a4a', '#6b7c93', '#8a6d4b', '#3d5a80'];

export function makePedestrian(x, y) {
  return {
    x, y,
    angle: Math.random() * Math.PI * 2,
    speed: 34 + Math.random() * 30,
    skin: SKINS[(Math.random() * SKINS.length) | 0],
    shirt: SHIRTS[(Math.random() * SHIRTS.length) | 0],
    pants: PANTS[(Math.random() * PANTS.length) | 0],
    walkPhase: Math.random() * Math.PI * 2,
    state: 'walk', // walk | flee | idle | down
    stateT: 0,
    target: null,
    scared: 0,
    id: Math.random().toString(36).slice(2, 9),
  };
}

/** Spawn a pedestrian on a sidewalk near (x, y). */
export function spawnPedestrianNear(x, y) {
  // Sidewalks hug the roads: offset a little off the road centre.
  const px = x + (Math.random() - 0.5) * 700;
  const py = y + (Math.random() - 0.5) * 700;
  const p = makePedestrian(px, py);
  if (onRoad(px, py)) { p.x += 62; }
  if (onBeach(px, py)) p.state = 'idle';
  return p;
}

function pickTarget(p) {
  // Wander to a nearby point on the same sidewalk strip.
  const a = Math.random() * Math.PI * 2;
  const d = 120 + Math.random() * 260;
  return { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d };
}

export function stepPedestrians(peds, dt, world) {
  const { player, cars, gunshotAt } = world;
  for (const p of peds) {
    p.stateT -= dt;
    p.scared = Math.max(0, p.scared - dt);
    if (p.state === 'down') continue;

    // Fear: gunshots and fast cars nearby send them running.
    let threat = null;
    if (gunshotAt && Math.hypot(gunshotAt.x - p.x, gunshotAt.y - p.y) < 420) threat = gunshotAt;
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;
    const pd = Math.hypot(px - p.x, py - p.y);
    const playerSpeed = player.inCar ? Math.abs(player.inCar.speed) : player.speed;
    if (pd < 130 && playerSpeed > 180) threat = { x: px, y: py };
    if (threat) {
      p.state = 'flee';
      p.stateT = 1.6 + Math.random();
      p.scared = 2;
      const a = Math.atan2(p.y - threat.y, p.x - threat.x);
      p.target = { x: p.x + Math.cos(a) * 260, y: p.y + Math.sin(a) * 260 };
    }

    if (p.state === 'flee') {
      p.speed = 190;
      if (p.stateT <= 0) { p.state = 'walk'; p.target = null; }
    } else if (p.state === 'idle') {
      p.speed = 0;
      if (p.stateT <= 0) { p.state = 'walk'; p.stateT = 2 + Math.random() * 4; }
    } else {
      p.speed = 34 + Math.random() * 8;
      if (!p.target || Math.hypot(p.target.x - p.x, p.target.y - p.y) < 18) p.target = pickTarget(p);
    }

    if (p.target && p.speed > 0) {
      const dx = p.target.x - p.x; const dy = p.target.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const want = Math.atan2(dy, dx);
      let diff = want - p.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      p.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
      p.walkPhase += dt * (p.speed / 14);
    }

    // Keep them inside the world and out of buildings; beachgoers stay near the sand.
    resolveBuildingCollision(p, 10);
    if (p.x < 60) p.x = 60;
    if (p.x > WORLD_W - 40) p.x = WORLD_W - 40;
    if (p.y < 40) p.y = 40;
    if (p.y > WORLD_H - 40) p.y = WORLD_H - 40;
    if (onRoad(p.x, p.y) && p.state !== 'flee') {
      // jaywalkers cross quickly, then get back to the sidewalk
      p.x += 62 * (Math.random() < 0.5 ? 1 : -1) * dt * 8;
    }
  }
}

/** Keep the crowd around the player: recycle the far ones, top the count up. */
export function recyclePedestrians(peds, px, py, want) {
  for (let i = peds.length - 1; i >= 0; i--) {
    if (Math.hypot(peds[i].x - px, peds[i].y - py) > 1300) peds.splice(i, 1);
  }
  let guard = 0;
  while (peds.length < want && guard++ < 40) {
    peds.push(spawnPedestrianNear(px, py));
  }
}

export function districtCrowd(district) {
  return district.name;
}
