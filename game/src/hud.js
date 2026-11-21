// hud.js — the HUD and the live minimap. The HUD is drawn on the canvas so it shows
// in every screenshot: health bar, cash, debt, wanted stars, speed, ammo and the mission
// tracker. The minimap (bottom-right) draws the real road network, the beach, the
// player's arrow, police blips, the mission marker and the north compass.

import { WORLD_W, WORLD_H, ROAD_SEGMENTS, SEA_X, BUILDINGS, districtAt } from './city.js';
import { currentMission, currentObjective, debtLeft, missionProgress } from './missions.js';

const MAP_W = 218;
const MAP_H = 158;
const MAP_PAD = 16;

export function drawHUD(ctx, view, game) {
  const { player, police, missions, stats } = game;
  const W = view.w; const H = view.h;

  // --- top-left: health + cash + debt -------------------------------------
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  // Health bar
  ctx.fillStyle = 'rgba(5,18,30,0.72)';
  roundRect(ctx, 16, 54, 220, 62, 8); ctx.fill();
  ctx.fillStyle = '#101418';
  roundRect(ctx, 26, 64, 160, 12, 6); ctx.fill();
  const hp = Math.max(0, player.health / player.maxHealth);
  ctx.fillStyle = hp > 0.5 ? '#57d977' : hp > 0.25 ? '#ffd23e' : '#ff5a5a';
  roundRect(ctx, 26, 64, 160 * hp, 12, 6); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px "Trebuchet MS", sans-serif';
  ctx.fillText('RICO VEGA', 26, 92);
  ctx.font = '12px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#9be7ff';
  ctx.fillText(`$${player.cash.toLocaleString('en-US')}  ·  DEBT $${debtLeft(missions).toLocaleString('en-US')}`, 26, 108);

  // Wanted stars, top-right.
  const stars = police.wanted;
  ctx.font = '28px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#ffd23e' : 'rgba(255,255,255,0.25)';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    const sx = W - 26 - i * 34;
    ctx.strokeText('★', sx, 44);
    ctx.fillText('★', sx, 44);
    if (i < stars && Math.floor(game.time * 3) % 2 === 0 && stars >= 3) {
      ctx.fillStyle = 'rgba(255,210,62,0.35)';
      ctx.beginPath(); ctx.arc(sx - 9, 34, 16, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.textAlign = 'left';
  ctx.font = 'bold 12px "Trebuchet MS", sans-serif';
  ctx.fillStyle = stars > 0 ? '#ffb3b3' : '#cfe8f5';
  ctx.textAlign = 'right';
  ctx.fillText(stars > 0 ? 'SOLANO PD ON YOUR TAIL' : 'CLEAN', W - 26, 64);
  ctx.textAlign = 'left';

  // --- bottom-left: speed / ammo ------------------------------------------
  ctx.fillStyle = 'rgba(5,18,30,0.72)';
  roundRect(ctx, 16, H - 76, 150, 60, 8); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px "Trebuchet MS", sans-serif';
  const speed = player.inCar ? Math.round(Math.abs(player.inCar.speed) * 0.24) : Math.round(player.speed * 0.24);
  ctx.fillText(`${speed}`, 30, H - 38);
  ctx.font = '11px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#9be7ff';
  ctx.fillText(player.inCar ? 'KM/H · ' + player.inCar.model.name.toUpperCase() : 'KM/H · ON FOOT', 72, H - 38);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 12px "Trebuchet MS", sans-serif';
  ctx.fillText(`AMMO ${player.ammo}   ·   ${districtAt(player.inCar ? player.inCar.x : player.x, player.inCar ? player.inCar.y : player.y).name.toUpperCase()}`, 30, H - 24);

  // --- mission tracker (DOM objective panel mirrors this) ------------------
  const m = currentMission(missions);
  const prog = missionProgress(missions);
  if (m) {
    ctx.fillStyle = 'rgba(5,18,30,0.72)';
    roundRect(ctx, 16, 122, 250, 52, 8); ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 12px "Trebuchet MS", sans-serif';
    ctx.fillText(`${m.title}  (${prog.obj}/${prog.objTotal})`, 28, 140);
    ctx.fillStyle = '#fff';
    ctx.font = '12px "Trebuchet MS", sans-serif';
    wrapText(ctx, (currentObjective(missions) || {}).text || '', 28, 158, 226, 15);
  } else if (missions.done) {
    ctx.fillStyle = 'rgba(5,18,30,0.72)';
    roundRect(ctx, 16, 122, 250, 52, 8); ctx.fill();
    ctx.fillStyle = '#57d977';
    ctx.font = 'bold 13px "Trebuchet MS", sans-serif';
    ctx.fillText('DEBT CLEARED — FREE ROAM', 28, 142);
    ctx.fillStyle = '#fff';
    ctx.font = '12px "Trebuchet MS", sans-serif';
    ctx.fillText('Port Solano is yours, Rico.', 28, 160);
  }

  // --- stats strip (bottom-centre, subtle) ---------------------------------
  ctx.font = '11px "Trebuchet MS", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.textAlign = 'center';
  ctx.fillText(`JOBS ${missions.index}/5   ·   CARS STOLEN ${stats.carsStolen}   ·   BEST WANTED ${'★'.repeat(stats.bestWanted) || '—'}`, W / 2, H - 12);
  ctx.textAlign = 'left';

  drawMinimap(ctx, view, game);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = String(text).split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}

/** Live minimap: roads, sea, buildings, player arrow, police, mission marker. */
export function drawMinimap(ctx, view, game) {
  const { player, police, missions, cars, peds } = game;
  const W = view.w; const H = view.h;
  const mx = W - MAP_W - MAP_PAD;
  const my = H - MAP_H - MAP_PAD;
  const sx = MAP_W / WORLD_W;
  const sy = MAP_H / WORLD_H;
  const X = (x) => mx + x * sx;
  const Y = (y) => my + y * sy;

  ctx.save();
  ctx.fillStyle = 'rgba(5,18,30,0.78)';
  roundRect(ctx, mx - 6, my - 6, MAP_W + 12, MAP_H + 12, 10); ctx.fill();
  ctx.beginPath();
  roundRect(ctx, mx, my, MAP_W, MAP_H, 8); ctx.clip();

  // Land, sea and sand.
  ctx.fillStyle = '#3f7d5a';
  ctx.fillRect(mx, my, MAP_W, MAP_H);
  ctx.fillStyle = '#2b6cb0';
  ctx.fillRect(mx, my, SEA_X * sx, MAP_H);
  ctx.fillStyle = '#e8d9a8';
  ctx.fillRect(mx + SEA_X * sx - 14 * sx, my, 14 * sx + 40 * sx, MAP_H);

  // Buildings as faint blocks.
  ctx.fillStyle = 'rgba(30,42,54,0.55)';
  for (const b of BUILDINGS) {
    ctx.fillRect(X(b.x), Y(b.y), Math.max(1, b.w * sx), Math.max(1, b.h * sy));
  }
  // Roads.
  ctx.strokeStyle = '#c8cdd4';
  ctx.lineWidth = 3;
  for (const s of ROAD_SEGMENTS) {
    ctx.beginPath();
    ctx.moveTo(X(s.x0), Y(s.y0));
    ctx.lineTo(X(s.x1), Y(s.y1));
    ctx.stroke();
  }
  ctx.strokeStyle = '#f2c230';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  for (const s of ROAD_SEGMENTS) {
    ctx.beginPath();
    ctx.moveTo(X(s.x0), Y(s.y0));
    ctx.lineTo(X(s.x1), Y(s.y1));
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Mission marker (pulsing yellow diamond).
  const obj = currentObjective(missions);
  if (obj && obj.x) {
    const pulse = 5 + Math.sin(game.time * 4) * 2;
    ctx.fillStyle = '#ffd23e';
    ctx.strokeStyle = '#1a1200';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(X(obj.x), Y(obj.y) - pulse);
    ctx.lineTo(X(obj.x) + pulse, Y(obj.y));
    ctx.lineTo(X(obj.x), Y(obj.y) + pulse);
    ctx.lineTo(X(obj.x) - pulse, Y(obj.y));
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }

  // Police blips (blue flashing) and the helicopter.
  const blink = Math.floor(game.time * 2.5) % 2 === 0;
  if (blink) {
    ctx.fillStyle = '#4da3ff';
    for (const c of police.cars) {
      ctx.beginPath(); ctx.arc(X(c.x), Y(c.y), 3.5, 0, Math.PI * 2); ctx.fill();
    }
    if (police.heli) {
      ctx.beginPath(); ctx.arc(X(police.heli.x), Y(police.heli.y), 4.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Roadblocks.
  ctx.fillStyle = '#ff5a5a';
  for (const rb of police.roadblocks) {
    ctx.fillRect(X(rb.x) - 3, Y(rb.y) - 3, 6, 6);
  }

  // Player arrow (white, points along heading).
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  const pa = player.inCar ? player.inCar.angle : player.angle;
  ctx.save();
  ctx.translate(X(px), Y(py));
  ctx.rotate(pa);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#1a1200';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-3, 0); ctx.lineTo(-6, 5);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();

  // Compass + label.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 11px "Trebuchet MS", sans-serif';
  ctx.fillText('N', mx + MAP_W / 2 - 4, my + 12);
  ctx.font = '10px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#9be7ff';
  ctx.fillText('PORT SOLANO', mx + 4, my + MAP_H - 6);
  ctx.restore();
}
