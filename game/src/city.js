// city.js — Port Solano: a sun-soaked coastal city, built from one fixed seed so every
// load draws the same streets, blocks and skyline. The world is a flat grid: avenues run
// north-south, streets east-west, the sea and beach hug the whole west edge, and the
// lighthouse hill sits at the north end. Districts give each corner its own palette.

export const WORLD_W = 5200;
export const WORLD_H = 3800;
export const ROAD_W = 92;
export const BLOCK = 400;
export const SEA_X = 430; // everything west of this is sand, then sea

/** Mulberry32: small deterministic RNG, so the city never changes between loads. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261121);

/** The avenue x-centres and street y-centres that tile the city. */
export const AVENUES = [620, 1020, 1420, 1820, 2220, 2620, 3020, 3420, 3820, 4220, 4620, 5020];
export const STREETS = [300, 700, 1100, 1500, 1900, 2300, 2700, 3100, 3500];

export const DISTRICTS = [
  { name: 'Marina Bay', x0: 430, y0: 0, x1: 1400, y1: 1200, tone: '#e8d9a8', roof: '#c96f4a' },
  { name: 'Old Town', x0: 1400, y0: 0, x1: 2600, y1: 1300, tone: '#e6c98f', roof: '#b85c38' },
  { name: 'Downtown', x0: 2600, y0: 0, x1: 5200, y1: 1600, tone: '#d9d4c8', roof: '#3f6d8e' },
  { name: 'The Strip', x0: 430, y0: 1200, x1: 1800, y1: 2300, tone: '#f2d7a0', roof: '#d3547a' },
  { name: 'Little Havana Row', x0: 1800, y0: 1300, x1: 3300, y1: 2400, tone: '#ecd9a4', roof: '#7a9a4d' },
  { name: 'Harbor Yards', x0: 3300, y0: 1600, x1: 5200, y1: 2600, tone: '#cfc9b8', roof: '#5d6b7a' },
  { name: 'South Beach', x0: 430, y0: 2300, x1: 2400, y1: 3800, tone: '#f4e3b0', roof: '#e08a3c' },
  { name: 'Lighthouse Hill', x0: 2400, y0: 2400, x1: 5200, y1: 3800, tone: '#d8e0c8', roof: '#4d7a5a' },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  }
  return DISTRICTS[2];
}

/** One building: a footprint rect, a height (drawn as an extruded block), a palette. */
export const BUILDINGS = [];
/** Decorative palms, lamps and props that never block movement much. */
export const PROPS = [];
/** Road centre-line segments, for traffic AI and the minimap. */
export const ROAD_SEGMENTS = [];

function addBuilding(x, y, w, h, district, tall) {
  const height = tall ? 60 + rand() * 130 : 14 + rand() * 34;
  const roofs = ['#b85c38', '#c96f4a', '#3f6d8e', '#7a9a4d', '#d3547a', '#8a6d4b', '#5d6b7a', '#e08a3c'];
  const walls = ['#e8dcc0', '#f0e6cc', '#dfe4e8', '#ecd9a4', '#e6c98f', '#d9d4c8'];
  BUILDINGS.push({
    x, y, w, h, height,
    roof: tall ? district.roof : roofs[(rand() * roofs.length) | 0],
    wall: walls[(rand() * walls.length) | 0],
    district: district.name,
    windows: tall,
    pool: rand() < 0.16,
  });
}

function buildCity() {
  // Road segments (for traffic + minimap).
  for (const x of AVENUES) ROAD_SEGMENTS.push({ x0: x, y0: 0, x1: x, y1: WORLD_H, vertical: true });
  for (const y of STREETS) ROAD_SEGMENTS.push({ x0: SEA_X, y0: y, x1: WORLD_W, y1: y, vertical: false });

  // Buildings fill every block between neighbouring avenues/streets.
  for (let ai = 0; ai < AVENUES.length - 1; ai++) {
    for (let si = 0; si < STREETS.length - 1; si++) {
      const x0 = AVENUES[ai] + ROAD_W / 2 + 14;
      const x1 = AVENUES[ai + 1] - ROAD_W / 2 - 14;
      const y0 = STREETS[si] + ROAD_W / 2 + 14;
      const y1 = STREETS[si + 1] - ROAD_W / 2 - 14;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const district = districtAt(cx, cy);
      const downtown = district.name === 'Downtown';
      // Each block gets 1-4 buildings, leaving a plaza or parking lot gap.
      const lots = downtown ? 2 : 1 + ((rand() * 3) | 0);
      const bw = (x1 - x0) / (lots === 1 ? 1 : 2);
      const bh = (y1 - y0) / (lots <= 2 ? 1 : 2);
      for (let li = 0; li < lots; li++) {
        const gx = x0 + (li % 2) * bw;
        const gy = y0 + ((li / 2) | 0) * bh;
        if (rand() < 0.12) continue; // empty lot: parking, park or plaza
        const pad = 12 + rand() * 18;
        addBuilding(
          gx + pad, gy + pad,
          bw - pad * 2 - rand() * 20, bh - pad * 2 - rand() * 20,
          district, downtown && rand() < 0.75,
        );
      }
      // Palms along the block edges.
      const palms = 2 + ((rand() * 4) | 0);
      for (let p = 0; p < palms; p++) {
        PROPS.push({
          kind: 'palm',
          x: x0 + rand() * (x1 - x0),
          y: rand() < 0.5 ? y0 + 8 : y1 - 8,
          s: 0.8 + rand() * 0.5,
        });
      }
    }
  }

  // The marina pier and the lighthouse: landmarks the missions point at.
  PROPS.push({ kind: 'pier', x: 620, y: 300, w: 420, h: 60 });
  PROPS.push({ kind: 'lighthouse', x: 4980, y: 3560, s: 1 });
  // Beach umbrellas and lifeguard posts along the sand.
  for (let i = 0; i < 14; i++) {
    PROPS.push({ kind: 'umbrella', x: 120 + rand() * 260, y: 260 + i * 250 + rand() * 60, s: 0.9 + rand() * 0.4 });
  }
  for (let i = 0; i < 10; i++) {
    PROPS.push({ kind: 'palm', x: 330 + rand() * 60, y: 200 + i * 340 + rand() * 80, s: 0.9 + rand() * 0.5 });
  }
}
buildCity();

/** Is this point on a road (drivable)? */
export function onRoad(x, y) {
  if (x < SEA_X) return false;
  for (const ax of AVENUES) if (Math.abs(x - ax) <= ROAD_W / 2) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) <= ROAD_W / 2) return true;
  return false;
}

/** Is this point on sand or sea? */
export function onBeach(x, y) { return x < SEA_X; }
export function inSea(x, y) { return x < 110; }

/** Nearest road centre to a point (used to snap spawns and traffic). */
export function nearestRoadPoint(x, y) {
  let best = null; let bd = Infinity;
  for (const ax of AVENUES) {
    const d = Math.abs(x - ax);
    if (d < bd) { bd = d; best = { x: ax, y, vertical: true }; }
  }
  for (const sy of STREETS) {
    const d = Math.abs(y - sy);
    if (d < bd) { bd = d; best = { x, y: sy, vertical: false }; }
  }
  return best;
}

/** Circle-vs-building collision: returns the building hit, or null. */
export function hitBuilding(x, y, r) {
  for (const b of BUILDINGS) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

/** Push a circle out of buildings and the world edge; returns true when it collided. */
export function resolveBuildingCollision(e, r) {
  let hit = false;
  for (const b of BUILDINGS) {
    const nx = Math.max(b.x, Math.min(e.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(e.y, b.y + b.h));
    const dx = e.x - nx; const dy = e.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.001) {
        const d = Math.sqrt(d2);
        e.x = nx + (dx / d) * r;
        e.y = ny + (dy / d) * r;
      } else {
        e.x += r; // centre inside the block: shove out east
      }
    }
  }
  if (e.x < 30) { e.x = 30; hit = true; }
  if (e.x > WORLD_W - 30) { e.x = WORLD_W - 30; hit = true; }
  if (e.y < 30) { e.y = 30; hit = true; }
  if (e.y > WORLD_H - 30) { e.y = WORLD_H - 30; hit = true; }
  return hit;
}
