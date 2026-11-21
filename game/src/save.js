// save.js — Port Solano saves to localStorage: cash earned, jobs finished, the best
// wanted level survived, and where Rico was standing. Loading puts the player back in
// the city with their progress intact. Nothing leaves the browser.

const KEY = 'port-solano-save-v1';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      savedAt: Date.now(),
      cash: state.player.cash,
      missionIndex: state.missions.index,
      paidTotal: state.missions.paidTotal,
      bestWanted: state.stats.bestWanted,
      carsStolen: state.stats.carsStolen,
      missionsDone: state.missions.index,
      x: state.player.inCar ? state.player.inCar.x : state.player.x,
      y: state.player.inCar ? state.player.inCar.y : state.player.y,
    };
    window.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch (e) { /* storage unavailable */ }
}

export function hasSave() {
  return loadGame() !== null;
}
