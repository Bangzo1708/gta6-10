// render.js — draws Port Solano from above with a warm noon sun: the sea and beach
// on the west, the road grid with lane paint, extruded buildings (roof + sunlit walls),
// palms, the pier and the lighthouse, then every car, pedestrian, cop, bullet and
// particle. A soft camera follows the player and zooms out in a car.

import { WORLD_W, WORLD_H, ROAD_W, AVENUES, STREETS, SEA_X, BUILDINGS, PROPS, districtAt } from './city.js';
import { currentObjective } from './missions.js';

export function makeCamera() {
  return { x: 0, y: 0, zoom: 1, targetZoom: 1 };
}

export function updateCamera(cam, focusX, focusY, inCar, dt) {
  cam.targetZoom = (inCar ? 0.82 : 1.05) * (cam.zoomMul || 1);
  cam.zoom += (cam.targetZoom - cam.zoom) * Math.min(1, 3 * dt);
  cam.x += (focusX - cam.x) * Math.min(1, 6 * dt);
  cam.y += (focusY - cam.y) * Math.min(1, 6 * dt);
}

export function drawWorld(ctx, view, game) {
  const cam = game.camera;
  const W = view.w; const H = view.h;
  ctx.save();
  ctx.clearRect(0, 0, W, H);

  // Sky-tinted backdrop for the off-map edges.
  ctx.fillStyle = '#bfe3ee';
  ctx.fillRect(0, 0, W, H);

  ctx.translate(W / 2, H / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  const vx0 = cam.x - W / 2 / cam.zoom - 80;
  const vy0 = cam.y - H / 2 / cam.zoom - 80;
  const vx1 = cam.x + W / 2 / cam.zoom + 80;
  const vy1 = cam.y + H / 2 / cam.zoom + 80;
  const visible = (x, y, m = 100) => x > vx0 - m && x < vx1 + m && y > vy0 - m && y < vy1 + m;

  drawGround(ctx, view, game, vx0, vy0, vx1, vy1);
  drawRoads(ctx, vx0, vy0, vx1, vy1);
  drawProps(ctx, game, visible);
  drawBuildings(ctx, game, visible);
  drawSkids(ctx, game);
  drawMissionMarker(ctx, game);
  drawCars(ctx, game, visible);
  drawPedestrians(ctx, game, visible);
  drawPlayer(ctx, game);
  drawEnemies(ctx, game, visible);
  drawBullets(ctx, game);
  drawParticles(ctx, game);
  drawHelicopter(ctx, game);
  ctx.restore();
}

function drawGround(ctx, view, game, vx0, vy0, vx1, vy1) {
  const t = game.time;
  // Sea: deep blue with slow moving wave bands.
  ctx.fillStyle = '#2b6cb0';
  ctx.fillRect(vx0, vy0, SEA_X - vx0 > 0 ? SEA_X - vx0 : 0, vy1 - vy0);
  if (vx0 < SEA_X) {
    ctx.fillStyle = '#2b6cb0';
    ctx.fillRect(vx0, vy0, SEA_X - vx0, vy1 - vy0);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      const wx = 60 + i * 22 + Math.sin(t * 0.7 + i * 1.7) * 8;
      ctx.beginPath();
      ctx.moveTo(wx, vy0);
      ctx.lineTo(wx, vy1);
      ctx.stroke();
    }
  }
  // Sand.
  ctx.fillStyle = '#ecd9a0';
  ctx.fillRect(Math.max(vx0, SEA_X), vy0, Math.min(vx1, WORLD_W) - Math.max(vx0, SEA_X), vy1 - vy0);
  // Grass / city ground.
  ctx.fillStyle = '#8fae6b';
  ctx.fillRect(Math.max(vx0, SEA_X + 130), vy0, Math.min(vx1, WORLD_W) - Math.max(vx0, SEA_X + 130), vy1 - vy0);
  // Block ground tint per district.
  for (let ai = 0; ai < AVENUES.length - 1; ai++) {
    for (let si = 0; si < STREETS.length - 1; si++) {
      const x0 = AVENUES[ai] + ROAD_W / 2;
      const x1 = AVENUES[ai + 1] - ROAD_W / 2;
      const y0 = STREETS[si] + ROAD_W / 2;
      const y1 = STREETS[si + 1] - ROAD_W / 2;
      if (x1 < vx0 || x0 > vx1 || y1 < vy0 || y0 > vy1) continue;
      const d = districtAt((x0 + x1) / 2, (y0 + y1) / 2);
      ctx.fillStyle = d.tone;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }
}

function drawRoads(ctx, vx0, vy0, vx1, vy1) {
  ctx.fillStyle = '#3a3f46';
  for (const ax of AVENUES) {
    if (ax + ROAD_W / 2 < vx0 || ax - ROAD_W / 2 > vx1) continue;
    ctx.fillRect(ax - ROAD_W / 2, vy0, ROAD_W, vy1 - vy0);
  }
  for (const sy of STREETS) {
    if (sy + ROAD_W / 2 < vy0 || sy - ROAD_W / 2 > vy1) continue;
    ctx.fillRect(vx0, sy - ROAD_W / 2, vx1 - vx0, ROAD_W);
  }
  // Sidewalks: lighter strips along the road edges.
  ctx.fillStyle = '#c9c2b2';
  for (const ax of AVENUES) {
    if (ax + ROAD_W / 2 < vx0 || ax - ROAD_W / 2 > vx1) continue;
    ctx.fillRect(ax - ROAD_W / 2 - 10, vy0, 10, vy1 - vy0);
    ctx.fillRect(ax + ROAD_W / 2, vy0, 10, vy1 - vy0);
  }
  for (const sy of STREETS) {
    if (sy + ROAD_W / 2 < vy0 || sy - ROAD_W / 2 > vy1) continue;
    ctx.fillRect(vx0, sy - ROAD_W / 2 - 10, vx1 - vx0, 10);
    ctx.fillRect(vx0, sy + ROAD_W / 2, vx1 - vx0, 10);
  }
  // Centre dashes.
  ctx.strokeStyle = '#f2c230';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  for (const ax of AVENUES) {
    if (ax + ROAD_W / 2 < vx0 || ax - ROAD_W / 2 > vx1) continue;
    ctx.beginPath(); ctx.moveTo(ax, vy0); ctx.lineTo(ax, vy1); ctx.stroke();
  }
  for (const sy of STREETS) {
    if (sy + ROAD_W / 2 < vy0 || sy - ROAD_W / 2 > vy1) continue;
    ctx.beginPath(); ctx.moveTo(vx0, sy); ctx.lineTo(vx1, sy); ctx.stroke();
  }
  ctx.setLineDash([]);
  // Crosswalks at every junction.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const ax of AVENUES) {
    for (const sy of STREETS) {
      if (ax < vx0 - 80 || ax > vx1 + 80 || sy < vy0 - 80 || sy > vy1 + 80) continue;
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(ax - ROAD_W / 2 + 6, sy - 34 + i * 10, 12, 5);
        ctx.fillRect(ax - ROAD_W / 2 + 6, sy + 22 + i * 10, 12, 5);
      }
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(ax - 34 + i * 10, sy - ROAD_W / 2 + 6, 5, 12);
      }
    }
  }
}

function drawProps(ctx, game, visible) {
  for (const p of PROPS) {
    if (!visible(p.x, p.y, 160)) continue;
    if (p.kind === 'palm') {
      ctx.strokeStyle = '#7a5a34';
      ctx.lineWidth = 5 * p.s;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 4 * p.s, p.y - 26 * p.s); ctx.stroke();
      ctx.fillStyle = '#3f9e4d';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + game.time * 0.05;
        ctx.beginPath();
        ctx.ellipse(p.x + 4 * p.s + Math.cos(a) * 14 * p.s, p.y - 26 * p.s + Math.sin(a) * 10 * p.s, 15 * p.s, 5 * p.s, a, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (p.kind === 'umbrella') {
      ctx.fillStyle = '#e33f2f';
      ctx.beginPath(); ctx.arc(p.x, p.y, 16 * p.s, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(p.x, p.y, 16 * p.s, Math.PI, Math.PI * 1.5); ctx.fill();
      ctx.fillStyle = '#f2c230';
      ctx.beginPath(); ctx.arc(p.x, p.y, 16 * p.s, Math.PI * 1.5, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7a5a34';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + 14 * p.s); ctx.stroke();
    } else if (p.kind === 'pier') {
      ctx.fillStyle = '#8a6d4b';
      ctx.fillRect(p.x - 210, p.y - 20, 420, 40);
      ctx.fillStyle = '#6b543a';
      for (let i = 0; i < 9; i++) ctx.fillRect(p.x - 200 + i * 48, p.y - 20, 4, 40);
      ctx.fillStyle = '#2b6cb0';
      ctx.fillRect(p.x - 210, p.y + 20, 420, 6);
    } else if (p.kind === 'lighthouse') {
      // White-and-red tower on the hill, with a rotating beam at dusk hours.
      ctx.fillStyle = '#e8e4da';
      ctx.fillRect(p.x - 14, p.y - 90, 28, 90);
      ctx.fillStyle = '#e33f2f';
      ctx.fillRect(p.x - 14, p.y - 70, 28, 14);
      ctx.fillRect(p.x - 14, p.y - 38, 28, 14);
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath(); ctx.arc(p.x, p.y - 96, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,210,62,0.18)';
      const beam = game.time * 0.6;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 96);
      ctx.lineTo(p.x + Math.cos(beam) * 320, p.y - 96 + Math.sin(beam) * 320);
      ctx.lineTo(p.x + Math.cos(beam + 0.12) * 320, p.y - 96 + Math.sin(beam + 0.12) * 320);
      ctx.closePath(); ctx.fill();
    }
  }
}

function drawBuildings(ctx, game, visible) {
  // South-to-north so nearer roofs overlap farther walls correctly.
  const sorted = BUILDINGS.filter((b) => visible(b.x + b.w / 2, b.y + b.h / 2, 200)).sort((a, b) => (a.y + a.h) - (b.y + b.h));
  for (const b of sorted) {
    const h = Math.min(b.height, 150);
    const lift = h * 0.42;
    // Sunlit south + east walls (extrusion).
    ctx.fillStyle = shade(b.wall, -28);
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.h);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.lineTo(b.x + b.w, b.y + b.h - lift);
    ctx.lineTo(b.x, b.y + b.h - lift);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(b.wall, -52);
    ctx.beginPath();
    ctx.moveTo(b.x + b.w, b.y);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.lineTo(b.x + b.w, b.y + b.h - lift);
    ctx.lineTo(b.x + b.w, b.y - lift);
    ctx.closePath(); ctx.fill();
    // Roof.
    ctx.fillStyle = b.roof;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y - lift);
    ctx.lineTo(b.x + b.w, b.y - lift);
    ctx.lineTo(b.x + b.w, b.y + b.h - lift);
    ctx.lineTo(b.x, b.y + b.h - lift);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Roof details: AC units, pools, helipads on the tall ones.
    if (b.pool) {
      ctx.fillStyle = '#4db2e8';
      ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.25 - lift, b.w * 0.3, b.h * 0.3);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.strokeRect(b.x + b.w * 0.2, b.y + b.h * 0.25 - lift, b.w * 0.3, b.h * 0.3);
    }
    if (b.windows && b.h > 60) {
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      const cols = Math.floor(b.w / 26);
      const rows = Math.floor(b.h / 24);
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        if ((i * 7 + j * 13) % 5 === 0) continue;
        ctx.fillRect(b.x + 8 + i * 26, b.y + 8 + j * 24 - lift, 12, 10);
      }
    }
    if (b.height > 120) {
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2 - lift, 5, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

function drawSkids(ctx, game) {
  ctx.strokeStyle = 'rgba(20,20,20,0.4)';
  ctx.lineWidth = 4;
  for (const s of game.skids) {
    ctx.globalAlpha = Math.max(0, s.life / 6);
    ctx.beginPath();
    ctx.moveTo(s.x0, s.y0);
    ctx.lineTo(s.x1, s.y1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawMissionMarker(ctx, game) {
  const obj = currentObjective(game.missions);
  if (!obj || !obj.x || !game.missions.active) return;
  const pulse = 1 + Math.sin(game.time * 4) * 0.12;
  const x = obj.x; const y = obj.y;
  // Ground ring + floating beacon.
  ctx.strokeStyle = '#ffd23e';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(x, y, 42 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,210,62,0.25)';
  ctx.beginPath(); ctx.arc(x, y, 42 * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.moveTo(x, y - 96);
  ctx.lineTo(x + 14, y - 70);
  ctx.lineTo(x - 14, y - 70);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1a1200';
  ctx.font = 'bold 16px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('!', x, y - 74);
  ctx.textAlign = 'left';
  // A light beam so the target reads from far away.
  const grad = ctx.createLinearGradient(x, y - 200, x, y);
  grad.addColorStop(0, 'rgba(255,210,62,0)');
  grad.addColorStop(1, 'rgba(255,210,62,0.28)');
  ctx.fillStyle = grad;
  ctx.fillRect(x - 10, y - 200, 20, 200);
}

function drawCarShape(ctx, car, isPlayer) {
  const m = car.model;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(-m.len / 2 + 4, -m.wid / 2 + 5, m.len, m.wid);
  // Body.
  ctx.fillStyle = m.color;
  roundRectPath(ctx, -m.len / 2, -m.wid / 2, m.len, m.wid, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Cabin + windshield.
  ctx.fillStyle = 'rgba(20,30,44,0.85)';
  roundRectPath(ctx, -m.len * 0.18, -m.wid * 0.36, m.len * 0.34, m.wid * 0.72, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(160,220,255,0.5)';
  ctx.fillRect(m.len * 0.16, -m.wid * 0.3, 4, m.wid * 0.6);
  // Headlights / taillights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(m.len / 2 - 3, -m.wid / 2 + 3, 3, 6);
  ctx.fillRect(m.len / 2 - 3, m.wid / 2 - 9, 3, 6);
  ctx.fillStyle = '#ff2e2e';
  ctx.fillRect(-m.len / 2, -m.wid / 2 + 3, 3, 6);
  ctx.fillRect(-m.len / 2, m.wid / 2 - 9, 3, 6);
  // Taxi sign / police livery.
  if (m.taxi) {
    ctx.fillStyle = '#ffd23e';
    ctx.fillRect(-8, -m.wid / 2 - 2, 16, 5);
    ctx.fillStyle = '#1a1200';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, -m.wid / 2 + 2);
    ctx.textAlign = 'left';
  }
  if (car.police) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-m.len * 0.1, -m.wid / 2, m.len * 0.2, m.wid);
    ctx.fillStyle = '#1c2733';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
    ctx.textAlign = 'left';
    // Flashing light bar.
    const on = Math.floor(gameTimeNow() * 6) % 2 === 0;
    ctx.fillStyle = on ? '#ff2e2e' : '#2e7dff';
    ctx.beginPath(); ctx.arc(-4, -m.wid / 2 - 2, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = on ? '#2e7dff' : '#ff2e2e';
    ctx.beginPath(); ctx.arc(6, -m.wid / 2 - 2, 4, 0, Math.PI * 2); ctx.fill();
  }
  if (isPlayer) {
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 2.5;
    roundRectPath(ctx, -m.len / 2 - 4, -m.wid / 2 - 4, m.len + 8, m.wid + 8, 10);
    ctx.stroke();
  }
  ctx.restore();
}

let _now = 0;
function gameTimeNow() { return _now; }

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCars(ctx, game, visible) {
  _now = game.time;
  const all = [...game.cars, ...game.police.cars];
  for (const rb of game.police.roadblocks) for (const c of rb.cars) all.push(c);
  for (const c of all) {
    if (!visible(c.x, c.y, 90)) continue;
    drawCarShape(ctx, c, game.player.inCar === c);
    if (c.skid > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(c.x - Math.cos(c.angle) * 26, c.y - Math.sin(c.angle) * 26, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPedestrians(ctx, game, visible) {
  for (const p of game.peds) {
    if (!visible(p.x, p.y, 40)) continue;
    const bob = p.state === 'walk' || p.state === 'flee' ? Math.sin(p.walkPhase) * 2 : 0;
    ctx.save();
    ctx.translate(p.x, p.y + bob * 0.3);
    ctx.rotate(p.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 3, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
    if (p.state === 'down') {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = p.shirt;
      ctx.fillRect(-9, -5, 18, 10);
      ctx.fillStyle = p.skin;
      ctx.beginPath(); ctx.arc(12, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      continue;
    }
    // Legs (two-step walk cycle).
    ctx.fillStyle = p.pants;
    const step = Math.sin(p.walkPhase) * 4;
    ctx.fillRect(-3 + step, -4, 5, 8);
    ctx.fillRect(-3 - step, -4, 5, 8);
    // Body.
    ctx.fillStyle = p.shirt;
    ctx.fillRect(-6, -7, 12, 14);
    // Head.
    ctx.fillStyle = p.skin;
    ctx.beginPath(); ctx.arc(10, 0, 5.5, 0, Math.PI * 2); ctx.fill();
    // Scared mark.
    if (p.scared > 0) {
      ctx.fillStyle = '#ff5a5a';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', 10, -14);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }
}

function drawPlayer(ctx, game) {
  const p = game.player;
  if (p.inCar || p.dead) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 4, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
  // Rico: red jacket, dark jeans, the stunt driver's stance.
  const step = Math.sin(game.time * 10) * (p.speed > 20 ? 4 : 0);
  ctx.fillStyle = '#1c2733';
  ctx.fillRect(-3 + step, -4, 5, 8);
  ctx.fillRect(-3 - step, -4, 5, 8);
  ctx.fillStyle = '#c22f22';
  ctx.fillRect(-6, -7, 12, 14);
  ctx.fillStyle = '#ffd23e';
  ctx.fillRect(-6, -1, 12, 3);
  ctx.fillStyle = '#e8b07d';
  ctx.beginPath(); ctx.arc(10, 0, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1c2733';
  ctx.fillRect(6, -5.5, 8, 4); // cap
  if (p.punching > 0) {
    ctx.strokeStyle = '#e8b07d';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(24, 0); ctx.stroke();
  }
  if (p.shooting > 0) {
    ctx.fillStyle = '#222831';
    ctx.fillRect(8, -2, 16, 4);
    ctx.fillStyle = '#ffe9a0';
    ctx.beginPath(); ctx.arc(26, 0, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Aim line while the mouse is down.
  if (game.aiming) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * 160, p.y + Math.sin(p.angle) * 160);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawEnemies(ctx, game, visible) {
  for (const e of game.enemies) {
    if (e.hp <= 0 || !visible(e.x, e.y, 40)) continue;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 4, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b3a4a';
    ctx.fillRect(-6, -7, 12, 14);
    ctx.fillStyle = e.shirt;
    ctx.fillRect(-6, -7, 12, 6);
    ctx.fillStyle = e.skin;
    ctx.beginPath(); ctx.arc(10, 0, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222831';
    ctx.fillRect(8, -2, 15, 4);
    ctx.restore();
    // Health bar.
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(e.x - 14, e.y - 24, 28, 5);
    ctx.fillStyle = '#ff5a5a';
    ctx.fillRect(e.x - 14, e.y - 24, 28 * (e.hp / 100), 5);
  }
}

function drawBullets(ctx, game) {
  ctx.strokeStyle = '#ffe9a0';
  ctx.lineWidth = 2.5;
  for (const b of game.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function drawParticles(ctx, game) {
  for (const pt of game.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHelicopter(ctx, game) {
  const h = game.police.heli;
  if (!h) return;
  ctx.save();
  ctx.translate(h.x, h.y);
  // Searchlight cone on the ground.
  ctx.fillStyle = 'rgba(255,244,180,0.14)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-70, 150);
  ctx.lineTo(70, 150);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,244,180,0.35)';
  ctx.beginPath(); ctx.arc(0, 140, 46, 0, Math.PI * 2); ctx.fill();
  // Body + rotor.
  ctx.rotate(h.angle);
  ctx.fillStyle = '#1c2733';
  ctx.beginPath(); ctx.ellipse(0, 0, 26, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4da3ff';
  ctx.fillRect(12, -5, 10, 10);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 3;
  const r = h.rotor;
  ctx.beginPath();
  ctx.moveTo(Math.cos(r) * 34, Math.sin(r) * 34);
  ctx.lineTo(-Math.cos(r) * 34, -Math.sin(r) * 34);
  ctx.moveTo(Math.cos(r + Math.PI / 2) * 34, Math.sin(r + Math.PI / 2) * 34);
  ctx.lineTo(-Math.cos(r + Math.PI / 2) * 34, -Math.sin(r + Math.PI / 2) * 34);
  ctx.stroke();
  ctx.fillStyle = '#ff2e2e';
  ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
