// scenes.js — staged photo setups for the game's screenshots. Each scene drops Rico
// into a living moment of the city (a chase, a street on foot, a mission drop, a
// five-star siege) and lets the simulation run, so the screenshots are real renders of
// the game, not composites. Open the game with ?shot=cover|street|drop|siege to stage one.

import { makeCar, CAR_MODELS } from './vehicles.js';
import { startMission, currentMission } from './missions.js';

function placePlayerCar(game, x, y, angle, modelIdx) {
  const car = makeCar(x, y, angle, modelIdx, {});
  game.cars.push(car);
  game.player.x = x; game.player.y = y;
  game.player.inCar = car;
  car.traffic = false; car.parked = false;
  game.camera.x = x; game.camera.y = y;
  return car;
}

function spawnChasers(game, n) {
  for (let i = 0; i < n; i++) {
    const px = game.player.x; const py = game.player.y;
    const a = Math.random() * Math.PI * 2;
    const d = 320 + i * 130;
    const c = makeCar(px + Math.cos(a) * d, py + Math.sin(a) * d, 0, 0, { police: true });
    c.model = { name: 'Solano PD Interceptor', color: '#1c2733', top: 400, accel: 300, grip: 3.5, len: 54, wid: 27, sport: true };
    c.cruise = 420;
    game.police.cars.push(c);
  }
}

export const SCENES = {
  // Cover: Rico mid-chase in the red Vento GT, three stars, cruisers behind,
  // a mission marker ahead, Downtown towers and the beach in frame.
  cover(game) {
    placePlayerCar(game, 2220, 1500, 0, 0);
    game.player.inCar.speed = 260;
    game.setWanted(3);
    spawnChasers(game, 2);
    startMission(game.missions, game);
    game.autopilot = { throttle: 0.85, steer: 0, brake: false, until: 14 };
    game.toast('PORT SOLANO — the chase is on. Three stars, and Otto wants his car back.');
  },

  // Street: Rico on foot on The Strip, pedestrians around, a taxi to steal.
  street(game) {
    game.player.x = 1420; game.player.y = 1900;
    game.player.angle = Math.PI / 4;
    game.camera.x = 1420; game.camera.y = 1900;
    const taxi = makeCar(1500, 1900, 0, 2, { parked: true });
    game.cars.push(taxi);
    game.missions.index = 0;
    game.hint('Press E to steal the taxi — the meter is already running.');
  },

  // Drop: mission 3 in progress — the package run at the harbor, two stars.
  drop(game) {
    game.missions.index = 2;
    placePlayerCar(game, 3820, 2300, Math.PI, 7);
    game.player.inCar.speed = 200;
    game.setWanted(2);
    spawnChasers(game, 1);
    startMission(game.missions, game);
    game.missions.objIndex = 1; // the escape leg
    game.autopilot = { throttle: 0.8, steer: 0, brake: false, until: 14 };
    game.toast('JOB 3 — GETAWAY DRIVER: lose the tail, then bring the package to South Beach.');
  },

  // Siege: the five-star finale at Lighthouse Hill — roadblock, chopper, night coupe.
  siege(game) {
    game.missions.index = 4;
    placePlayerCar(game, 4620, 3100, -Math.PI / 2, 6);
    game.player.inCar.speed = 300;
    game.setWanted(5);
    spawnChasers(game, 3);
    startMission(game.missions, game);
    game.autopilot = { throttle: 0.9, steer: 0, brake: false, until: 14 };
    game.toast('JOB 5 — THE FIVE-STAR RUN: every cop in Solano is coming. Get the ledger home.');
  },
};

/** Stage a named scene, if the URL asked for one. Returns the scene name or null. */
export function applyShotParam(game) {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot && SCENES[shot]) {
    SCENES[shot](game);
    game.photoMode = true;
    return shot;
  }
  return null;
}
