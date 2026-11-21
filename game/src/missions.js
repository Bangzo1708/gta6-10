// missions.js — the story of Port Solano: five jobs for the fixer Otto Vane, each one a
// chain of objectives the player drives or walks to. The mission state is plain data, so
// the HUD, the minimap and the save file all read the same truth. Completing all five
// clears Rico's $40,000 debt and opens free roam with the city as a playground.

export const DEBT_TOTAL = 40000;

export const MISSIONS = [
  {
    id: 'm1',
    title: 'JOB 1 — BORROWED WHEELS',
    brief: 'Otto Vane: "First job, Rico. A Vento GT, cherry red, parked outside the Marina Bay hotel. Bring it to my garage on The Strip — and try not to scratch it."',
    pay: 4000,
    objectives: [
      { type: 'steal', text: 'Steal the red Vento GT at the Marina Bay hotel', x: 900, y: 700, r: 90, car: { model: 0, x: 905, y: 640, angle: Math.PI / 2 } },
      { type: 'goto', text: 'Deliver the Vento to Otto\'s garage on The Strip', x: 1420, y: 1900, r: 90, needCar: true },
    ],
  },
  {
    id: 'm2',
    title: 'JOB 2 — FOOTWORK',
    brief: 'Otto Vane: "Cash drops, three of them, scattered through Old Town market. On foot — a car draws eyes. The cops are jumpy tonight, so keep your head down."',
    pay: 6000,
    objectives: [
      { type: 'collect', text: 'Pick up cash drop 1 of 3 — Old Town market', x: 1620, y: 500, r: 60, onFoot: true },
      { type: 'collect', text: 'Pick up cash drop 2 of 3 — Little Havana Row', x: 2420, y: 2100, r: 60, onFoot: true },
      { type: 'collect', text: 'Pick up cash drop 3 of 3 — Harbor Yards', x: 4020, y: 1900, r: 60, onFoot: true },
      { type: 'goto', text: 'Return the cash to Otto\'s garage', x: 1420, y: 1900, r: 90 },
    ],
  },
  {
    id: 'm3',
    title: 'JOB 3 — GETAWAY DRIVER',
    brief: 'Otto Vane: "My boys hit the Meridian courier. You drive. Lose the tail, ditch the heat, and bring the package to the South Beach lifeguard post. Do not stop."',
    pay: 8000,
    objectives: [
      { type: 'goto', text: 'Pick up the package at the Harbor Yards warehouse', x: 3820, y: 2300, r: 90 },
      { type: 'escape', text: 'Lose the police — stay out of sight until the stars fade', x: 0, y: 0, r: 0, wantedAtStart: 3 },
      { type: 'goto', text: 'Deliver the package to the South Beach lifeguard post', x: 700, y: 3300, r: 90 },
    ],
  },
  {
    id: 'm4',
    title: 'JOB 4 — THE YACHT SWAP',
    brief: 'Otto Vane: "A buyer at the marina wants a Night Coupe, and he pays in boat keys. Take the coupe from Downtown, swap it at the pier, and bring me the keys. His crew will not wave you through."',
    pay: 10000,
    objectives: [
      { type: 'steal', text: 'Take the Night Coupe from the Downtown tower lot', x: 3220, y: 900, r: 90, car: { model: 6, x: 3220, y: 860, angle: 0 }, guards: 2 },
      { type: 'goto', text: 'Drive the coupe to the Marina Bay pier', x: 640, y: 300, r: 100, needCar: true },
      { type: 'goto', text: 'Bring the boat keys back to Otto\'s garage', x: 1420, y: 1900, r: 90 },
    ],
  },
  {
    id: 'm5',
    title: 'JOB 5 — THE FIVE-STAR RUN',
    brief: 'Otto Vane: "Last one, Rico. The Meridian ledger is at the lighthouse — and every cop in Solano knows it. Five stars, roadblocks, the chopper. Get the ledger to my garage and your debt is gone. Drive like your life depends on it — it does."',
    pay: 12000,
    objectives: [
      { type: 'goto', text: 'Reach the Lighthouse Hill roadblock run — grab the ledger', x: 4980, y: 3400, r: 110, wantedAtStart: 5, guards: 3 },
      { type: 'goto', text: 'Escape with the ledger — bring it to Otto\'s garage', x: 1420, y: 1900, r: 110, needCar: false },
    ],
  },
];

export function makeMissionState() {
  return {
    index: 0, // which mission is active; MISSIONS.length means the story is done
    objIndex: 0,
    active: false,
    startedAt: 0,
    collected: 0,
    missionCar: null,
    guards: [],
    done: false,
    failed: false,
    failReason: '',
    timer: 0,
    paidTotal: 0,
  };
}

export function currentMission(state) {
  return state.index < MISSIONS.length ? MISSIONS[state.index] : null;
}

export function currentObjective(state) {
  const m = currentMission(state);
  if (!m) return null;
  return m.objectives[state.objIndex] || null;
}

export function missionProgress(state) {
  const m = currentMission(state);
  if (!m) return { mission: MISSIONS.length, total: MISSIONS.length, obj: 0, objTotal: 0 };
  return { mission: state.index + 1, total: MISSIONS.length, obj: state.objIndex + 1, objTotal: m.objectives.length };
}

/** Start the next mission: returns the mission, or null when the story is finished. */
export function startMission(state, world) {
  const m = currentMission(state);
  if (!m) return null;
  state.active = true;
  state.objIndex = 0;
  state.collected = 0;
  state.startedAt = world.time;
  state.failed = false;
  state.failReason = '';
  state.guards = [];
  const obj = m.objectives[0];
  if (obj && obj.car) {
    const c = world.spawnMissionCar(obj.car);
    state.missionCar = c;
  }
  if (obj && obj.guards) {
    state.guards = world.spawnGuards(obj.x, obj.y, obj.guards);
  }
  if (obj && obj.wantedAtStart) world.setWanted(obj.wantedAtStart);
  return m;
}

/** Advance one objective; returns { done: bool, missionDone: bool } for the caller. */
export function advanceObjective(state, world) {
  const m = currentMission(state);
  if (!m) return { done: false, missionDone: false };
  state.objIndex++;
  if (state.objIndex >= m.objectives.length) {
    // Mission complete: pay the player, clear the heat, move to the next job.
    state.paidTotal += m.pay;
    world.player.cash += m.pay;
    world.clearWanted();
    state.active = false;
    state.index++;
    state.objIndex = 0;
    if (state.index >= MISSIONS.length) state.done = true;
    return { done: true, missionDone: true, pay: m.pay, next: currentMission(state) };
  }
  const obj = m.objectives[state.objIndex];
  if (obj.car) state.missionCar = world.spawnMissionCar(obj.car);
  if (obj.guards) state.guards = world.spawnGuards(obj.x, obj.y, obj.guards);
  if (obj.wantedAtStart) world.setWanted(obj.wantedAtStart);
  return { done: true, missionDone: false };
}

export function failMission(state, reason) {
  state.active = false;
  state.failed = true;
  state.failReason = reason;
}

/** Restart the current mission from its first objective (keeps the story index). */
export function retryMission(state, world) {
  state.active = false;
  state.failed = false;
  state.guards = [];
  return startMission(state, world);
}

export function debtLeft(state) {
  return Math.max(0, DEBT_TOTAL - state.paidTotal);
}
