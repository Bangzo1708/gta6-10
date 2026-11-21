// combat.js — shooting, punching and the bullets that fly. The player carries a pistol;
// mission crews carry their own. Bullets are simple hitscan-light projectiles with a
// tracer, a muzzle flash and a little kick, so a firefight reads on screen at a glance.

export function makeBullets() {
  return [];
}

/** Fire one shot from (x, y) toward angle. Returns the bullet, or null when out of ammo. */
export function fireBullet(bullets, x, y, angle, opts = {}) {
  if (opts.ammo !== undefined && opts.ammo <= 0) return null;
  const b = {
    x: x + Math.cos(angle) * 26,
    y: y + Math.sin(angle) * 26,
    vx: Math.cos(angle) * 980,
    vy: Math.sin(angle) * 980,
    life: 0.55,
    fromPlayer: !!opts.fromPlayer,
    damage: opts.damage || 34,
    owner: opts.owner || null,
  };
  bullets.push(b);
  return b;
}

/**
 * Step bullets; test hits against pedestrians, enemies, police cars and the player.
 * targets: { peds, enemies, policeCars, player, playerCar } — each optional.
 * Returns hit events for sound, wanted and mission hooks.
 */
export function stepBullets(bullets, dt, targets) {
  const hits = [];
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    const test = (x, y, r, kind, ref) => {
      if (dead) return false;
      if (Math.hypot(b.x - x, b.y - y) < r) {
        hits.push({ kind, ref, at: { x: b.x, y: b.y }, damage: b.damage, fromPlayer: b.fromPlayer });
        dead = true;
        return true;
      }
      return false;
    };
    if (targets.peds) for (const p of targets.peds) if (p.state !== 'down') test(p.x, p.y, 14, 'ped', p);
    if (targets.enemies) for (const e of targets.enemies) if (e.hp > 0) test(e.x, e.y, 15, 'enemy', e);
    if (targets.policeCars) for (const c of targets.policeCars) test(c.x, c.y, 30, 'policeCar', c);
    if (targets.player && !b.fromPlayer && !targets.player.dead) test(targets.player.x, targets.player.y, 13, 'player', targets.player);
    if (targets.playerCar && b.fromPlayer === false) test(targets.playerCar.x, targets.playerCar.y, 30, 'playerCar', targets.playerCar);
    if (dead) bullets.splice(i, 1);
  }
  return hits;
}

/** A punch: short range, knocks a pedestrian down, draws the law if seen. */
export function punchHit(player, peds, enemies) {
  const px = player.x + Math.cos(player.angle) * 26;
  const py = player.y + Math.sin(player.angle) * 26;
  for (const p of peds) {
    if (p.state !== 'down' && Math.hypot(p.x - px, p.y - py) < 26) {
      p.state = 'down';
      return { kind: 'ped', ref: p, at: { x: p.x, y: p.y } };
    }
  }
  for (const e of enemies || []) {
    if (e.hp > 0 && Math.hypot(e.x - px, e.y - py) < 28) {
      e.hp -= 20;
      return { kind: 'enemy', ref: e, at: { x: e.x, y: e.y } };
    }
  }
  return null;
}

/** Enemy crew member: simple state machine that walks toward the player and shoots. */
export function makeEnemy(x, y, opts = {}) {
  return {
    x, y, angle: 0, hp: 100, speed: 120,
    shootT: 1 + Math.random(), state: 'chase',
    shirt: opts.shirt || '#3a3a3a', skin: opts.skin || '#e8b07d',
    id: Math.random().toString(36).slice(2, 9),
  };
}

export function stepEnemies(enemies, dt, player, bullets, onShoot) {
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const dx = px - e.x; const dy = py - e.y;
    const d = Math.hypot(dx, dy) || 1;
    e.angle = Math.atan2(dy, dx);
    if (d > 240) {
      e.x += (dx / d) * e.speed * dt;
      e.y += (dy / d) * e.speed * dt;
    }
    e.shootT -= dt;
    if (e.shootT <= 0 && d < 460) {
      e.shootT = 1.1 + Math.random() * 0.9;
      const jitter = (Math.random() - 0.5) * 0.22;
      fireBullet(bullets, e.x, e.y, e.angle + jitter, { fromPlayer: false, damage: 9, owner: e });
      if (onShoot) onShoot(e);
    }
  }
}
