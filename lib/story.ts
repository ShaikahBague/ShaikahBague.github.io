export type Point = [number, number, number];

export const WORLD_POS: Point[] = [
  [24, 0, -170],
  [-24, 0, -280],
  [24, 0, -390],
];
export const WORLD_RADIUS = 14;
export const CAMERA_GAP = 60;

// The five departments that run the org: little planets hung together high above the flight path, out of sight of the worlds below.
// Spread across the view on a wide screen, and zigzagging down it on a phone. Offsets from the middle of the group
export const FLEET = { x: 0, y: 140, z: -420 };
export const OFFICE_RADIUS = { wide: 5, tall: 2.9 };
const OFFICE_OFFSETS = {
  wide: [[-27.5, -2], [-13.75, -10], [0, -2.5], [13.75, -10], [27.5, -2]],
  tall: [[-4.6, 4.8], [4.6, -0.8], [-4.6, -6.4], [4.6, -12], [-4.6, -17.4]],
};
export const officeSpots = (wide: boolean): Point[] => OFFICE_OFFSETS[wide ? "wide" : "tall"].map(([x, y]) => [FLEET.x + x, FLEET.y + y, FLEET.z]);

export const EARTH_RADIUS = 45;
export const GROUND_Y = -2.6;

// The bridge's place behind headquarters. Trees have to stay clear of the deck and its cables, wherever they're scattered
export const BRIDGE = { x: 67.8, z: -315.5, turn: -1.383, reach: 200, width: 16 };
const BRIDGE_CLEARANCE = 15;
export function offBridge(x: number, z: number) {
  const [dx, dz] = [x - BRIDGE.x, z - BRIDGE.z];
  const [cos, sin] = [Math.cos(BRIDGE.turn), Math.sin(BRIDGE.turn)];
  const along = dx * cos - dz * sin;
  const across = dx * sin + dz * cos;
  return Math.abs(along) > BRIDGE.reach + BRIDGE_CLEARANCE || Math.abs(across) > BRIDGE.width / 2 + BRIDGE_CLEARANCE;
}

// Parked, the rocket's door faces this way, and Axie's walk runs along it from the lift in the middle of the hull to their mark
export const DOOR_DIR = { x: Math.sin(Math.PI / 6), z: Math.cos(Math.PI / 6) };
const INSIDE = 0;
export const SILL = { along: 1.35, y: -1.32 };
export const RAMP_FOOT = 6;
export const MARK = 14;

// How big Axie stands: full size on open ground, and cabin size by the time they reach the door, which they only just fit through at that size
export const FULL_STATURE = 1.4;
export function statureAt(along: number) {
  const t = Math.min(1, Math.max(0, (along - SILL.along) / (RAMP_FOOT - SILL.along)));
  return 1 + (FULL_STATURE - 1) * t * t * (3 - 2 * t);
}

// Where Axie's feet are for a walk from 0 (inside the hull) to 1 (on their mark): along the door line and how high
export function walkPath(out: number) {
  const along = INSIDE + (MARK - INSIDE) * out;
  const up = 1 - Math.min(1, Math.max(0, (along - SILL.along) / (RAMP_FOOT - SILL.along)));
  return { along, y: GROUND_Y + (SILL.y - GROUND_Y) * up };
}

// A camera pose given as distance along the door line, distance across it and height, for the camera and what it looks at
const shot = ([along, across, y]: Point, [aimAlong, aimAcross, aimY]: Point) => ({
  cx: DOOR_DIR.x * along + DOOR_DIR.z * across,
  cy: y,
  cz: DOOR_DIR.z * along - DOOR_DIR.x * across,
  lx: DOOR_DIR.x * aimAlong + DOOR_DIR.z * aimAcross,
  ly: aimY,
  lz: DOOR_DIR.z * aimAlong - DOOR_DIR.x * aimAcross,
});

export const SHOTS = {
  land: {
    hq: shot([25, -7, -0.6], [8, 0.5, 2.8]),
    // All from this side of the door line, because that's the side the bridge can be seen past
    walk: shot([22, -4.5, -0.4], [3, -0.5, 0.4]),
    board: shot([12.5, -3, 1.4], [0, 0, 2.6]),
    launch: { cx: 0, cy: -1, cz: 36, lx: 0, ly: 4, lz: 0 },
    liftoff: { cx: 0, cy: 8, cz: 34, lx: 0, ly: 28, lz: -4 },
    door: shot([13, 0, 0.4], [0, 0, 0]),
    doorBack: shot([25, 0, 6.5], [4, 0, -1]),
    // Low and square on to Axie, who stands dead centre above the chat with the rocket and the bridge either side
    chat: shot([20.7, -6.17, -2.1], [14, 0, -1.98]),
  },
  port: {
    // Pulled wide with side, which is what a phone needs to fit the rocket, Axie and the bridge across its narrow view
    hq: { ...shot([35.2, -11.07, -0.2], [8.4, 2.54, 1.6]), side: 0.5 },
    walk: shot([29.5, -8.94, -0.2], [3.73, 2.46, 1.2]),
    board: shot([17, -8.6, 1.2], [0, 0, 2.4]),
    launch: { cx: 0, cy: -1, cz: 48, lx: 0, ly: 6, lz: 0 },
    liftoff: { cx: 0, cy: 8, cz: 46, lx: 0, ly: 30, lz: -4 },
    door: shot([18, 0, 0.4], [0, 0, 0]),
    doorBack: shot([34, 0, 8], [4, 0, -1]),
    chat: shot([20.7, -6.17, -2.1], [14, 0, -1.98]),
  },
};

const PAD: Point = [0, 1, 0];

// In, rest, out and over the top: the rest point sits between the camera and the world, and the
// rocket passes above the planet on its way out so the path never cuts through it
const worldLeg = ([x, , z]: Point, i: number): Point[] => {
  const side = i % 2 ? -1 : 1;
  return [
    [x - side * 14, -3, z + 34],
    [x - side * 5.5, 2, z + 32],
    [x + side * 2, 14, z + 30],
    [0, 28, z - 20],
  ];
};

// The rocket's route, one point per entry. Between two points it moves along a smooth curve
export const FLIGHT: Point[] = [
  PAD,
  [0, 22, -4],
  // Keeps climbing past the liftoff stop, so the rocket rests side-on rather than showing its tail
  [-2, 34, -14],
  [-16, 4, -46], [-9, 7, -50], [-1, 10, -54],
  [4, -8, -66], [12, -5, -68], [22, -1, -72],
  ...WORLD_POS.flatMap(worldLeg),
  // Up to the little planets, then flying across the view below them with its side to the camera so Axie shows, and back down into the belt
  [-14, 84, -398], [-4, 116, -394], [8, 127, -394], [18, 129, -394], [30, 131, -396],
  [14, 96, -432],
  [-60, 6, -478], [-40, 6, -478], [60, 6, -478],
  [66, -3, -495], [72, 2, -498], [78, 8, -500],
  // Home: the jump here happens while the screen is black, so this stretch is never flown on screen
  PAD,
];

// Where in FLIGHT the rocket rests for each chapter
export const STOP = {
  house: 0,
  liftoff: 1,
  signal: 4,
  links: 7,
  enterprise: 10,
  cyberops: 14,
  devnet: 18,
  fleet: 24,
  logStart: 28,
  logEnd: 29,
  crew: 31,
  home: 33,
};

export const SCREENS_PER_UNIT = 1.3;

// Where each story beat rests on the scroll timeline; one unit is SCREENS_PER_UNIT screens of scrolling
export const AT = {
  house: 0,
  liftoff: 3.64,
  signal: 4.64,
  links: 5.54,
  enterprise: 6.54,
  cyberops: 7.54,
  devnet: 8.54,
  fleet: 9.64,
  log: 10.84,
  crew: 15.94,
  home: 18.59,
  chat: 20.94,
  end: 23.04,
};

// How long Axie's walk across the plaza takes on the timeline. Few long strides cover the distance quickly, while their legs stay at a walking pace even at CRUISE
export const WALK_TIME = 1.6;
export const WALK_CYCLES = 4;

// Axie adrift on a planet at a given moment, with nothing holding them down: a slow wander in place, a lean and a look around. The speeds
// share no common beat, so the drift never visibly repeats, and all of it stays slow because fast camera-sized motion makes people dizzy
export const floatAt = (time: number) => ({
  x: Math.sin(time * 0.13) * 3 + Math.sin(time * 0.31 + 1) * 0.8,
  y: Math.sin(time * 0.19 + 2) * 1.8 + Math.sin(time * 0.43) * 0.5,
  roll: Math.sin(time * 0.17) * 0.28,
  pitch: Math.sin(time * 0.23 + 1) * 0.16,
  yaw: Math.sin(time * 0.11 + 3) * 0.42,
});

// The air inside each planet, in the order of the worlds. The first colours are its sky from overhead down to the horizon
export const ATMOSPHERES = [
  { top: "#03313a", low: "#57d8bb", ground: ["#10605c", "#39b896"], moon: "#dcfff2", accent: "#8df5d9", moonAt: [0.36, 0.34, -0.87], relief: 30, seed: 3 },
  { top: "#2c0515", low: "#ee4f66", ground: ["#5e1229", "#b92f48"], moon: "#ffdccb", accent: "#ff9aa2", moonAt: [0.38, 0.28, -0.88], relief: 20, seed: 7 },
  { top: "#2d1303", low: "#ffae45", ground: ["#7a4210", "#d18a2a"], moon: "#fff1cb", accent: "#ffd08a", moonAt: [0.34, 0.4, -0.85], relief: 34, seed: 11 },
  // The five little planets: an electric blue, a magenta, an acid green, a soft violet and a pale ice
  { top: "#04143a", low: "#4f8dff", ground: ["#132a6b", "#3b67c9"], moon: "#dfe9ff", accent: "#9cc0ff", moonAt: [0.3, 0.36, -0.88], relief: 24, seed: 13 },
  { top: "#2e0533", low: "#f25fc4", ground: ["#5b1460", "#c23fa2"], moon: "#ffe1f6", accent: "#ff9be4", moonAt: [0.4, 0.3, -0.86], relief: 38, seed: 17 },
  { top: "#1a2b02", low: "#c4e34b", ground: ["#3d5a10", "#8fb524"], moon: "#f7ffd1", accent: "#e4ff7a", moonAt: [0.32, 0.42, -0.85], relief: 18, seed: 23 },
  { top: "#170a3f", low: "#a78bfa", ground: ["#33208a", "#7258d9"], moon: "#efe6ff", accent: "#cbb8ff", moonAt: [0.36, 0.26, -0.9], relief: 30, seed: 29 },
  { top: "#0c1a24", low: "#b9d4e0", ground: ["#2f4a58", "#7c9cab"], moon: "#f4fbff", accent: "#d6eef7", moonAt: [0.38, 0.38, -0.84], relief: 42, seed: 31 },
];
// Index in ATMOSPHERES, and in the landings, of the first little planet
export const FIRST_OFFICE = WORLD_POS.length;

// The show chases the scroll rather than sitting on it. It eases in, can't pass a calm cruising speed however hard the page
// is flung, and only speeds up past a backlog no fling reaches, so a scroll bar drag doesn't leave it flying on for a minute
export const CRUISE = 0.5;
const LONG_BACKLOG = 3;
const CATCH_UP = 0.12;
export function followStep(now: number, target: number, dt: number) {
  const gap = target - now;
  if (Math.abs(gap) < 0.001) return target;
  const most = (CRUISE + Math.max(0, Math.abs(gap) - LONG_BACKLOG) * CATCH_UP) * dt;
  return now + Math.max(-most, Math.min(most, gap * (1 - Math.exp(-dt * 2.5))));
}

// Whether Axie is talking right now. The chat sets it while an answer appears, and the 3D scene reads it to move their mouth
export const voice = { talking: false };

// How far a star strays from the middle of its cell. Sideways is kept small, because a label is as wide as a cell allows
export const STAR_DRIFT = 0.1;

// A year's constellation for any head count, in percent of the chart. Each officer owns a cell of a staggered grid, which keeps labels
// apart however many there are, and drifts inside it so the grid doesn't read as one. The year seeds the drift, so each year has
// its own shape and the server and browser draw the same one. Links are the shortest set joining every star, grown outward from
// the first, so lines never cross. `order` holds each star's place in that growth, for lighting them up in turn
export function starChart(year: number, count: number, wide: boolean) {
  const cols = wide ? Math.min(8, Math.max(2, Math.round(Math.sqrt(count * 1.6)))) : count > 16 ? 3 : 2;
  const rows = Math.ceil(count / cols);
  let seed = (year * 7919) % 2147483647;
  const drift = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5;
  const tenth = (value: number) => Math.round(value * 10) / 10;
  const stars = Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, count - row * cols);
    // Every other row sits half a cell over, and a short last row centres itself
    const across = (i % cols) + 0.5 + (row % 2) * 0.5 + (cols - inRow) / 2 + drift() * STAR_DRIFT * 2;
    const down = row + 0.34 + drift() * 0.28;
    return [tenth((across / (cols + 0.5)) * 100), tenth((down / rows) * 100)];
  });

  const apart = (a: number, b: number) => Math.hypot(((stars[a][0] - stars[b][0]) * (cols + 0.5)) / 100, ((stars[a][1] - stars[b][1]) * rows * 0.8) / 100);
  const order = stars.map(() => -1);
  const links: [number, number][] = [];
  if (count) order[0] = 0;
  while (links.length < count - 1) {
    let best: [number, number] = [0, 0];
    let shortest = Infinity;
    order.forEach((lit, from) => {
      if (lit < 0) return;
      order.forEach((other, to) => {
        if (other < 0 && apart(from, to) < shortest) {
          shortest = apart(from, to);
          best = [from, to];
        }
      });
    });
    links.push(best);
    order[best[1]] = links.length;
  }
  return { stars, links, order, cols, rows };
}

export const ROCK_DEPTH = 30;

// An asteroid's flight past the camera. p runs -1 (a far speck, top right) to 0 (resting at restX, restY) to 1 (going past
// the camera, bottom left). Returns its place on screen, as fractions of the half screen, and its distance
export function passBy(p: number, restX: number, restY: number): Point {
  const t = Math.min(1, Math.abs(p));
  const eased = t * t * (3 - 2 * t);
  const [x, y, depth] = p < 0 ? [0.85, 0.8, 240] : [-1.9, -1.5, 13];
  return [restX + (x - restX) * eased, restY + (y - restY) * eased, ROCK_DEPTH + (depth - ROCK_DEPTH) * eased * eased];
}

// The logo's neon line as it runs through cncp-white.png, in that image's pixels. The third value is the
// size of a star at that point; points without one only shape the curve
export const LOGO_STROKES: number[][][] = [
  [[205, 392, 2.6], [130, 372], [75, 358, 3.2], [130, 340], [200, 310, 1.1], [250, 270], [285, 215, 1.3], [303, 165], [325, 137, 3.6], [350, 160], [347, 240, 1.2], [336, 400, 1.3], [313, 585], [333, 622, 3], [358, 592], [387, 380, 2.6]],
  [[243, 427, 1.8], [268, 418], [280, 300, 1.2], [303, 165]],
  [[387, 380], [398, 335], [412, 285], [428, 267, 2.4], [446, 292], [440, 400, 1], [440, 538], [452, 562, 2.2], [466, 538], [490, 335], [505, 308, 2.2], [522, 335], [540, 538], [553, 562, 2.2], [568, 530], [556, 295], [575, 267, 2.4], [600, 295], [625, 500, 1], [632, 535, 2.6]],
  [[358, 245], [395, 300, 1], [440, 325], [505, 340, 1.1]],
  [[530, 345, 1.1], [585, 330], [615, 290, 1], [645, 225], [655, 165], [675, 137]],
  [[632, 535], [640, 600], [665, 622, 3], [695, 598], [682, 400, 1.3], [668, 165], [675, 137, 3.6], [702, 165], [720, 235, 1.3], [785, 298], [805, 312, 2.6]],
  [[805, 312], [860, 335], [925, 356, 3.2], [850, 378], [780, 400, 1.2], [728, 428, 1.8], [718, 300, 1.2], [702, 165]],
];

export const initialSky = () => ({
  ...SHOTS.land.hq,
  fov: 42,
  side: 0,
  house: 1,
  // 1 holds the rocket parked with its door to the yard; 0 lets it turn its logo to the camera in flight
  ground: 1,
  door: 1,
  // Axie's ride up inside the hull: 0 at the door, 1 in their seat in the cabin
  climb: 0,
  // 1 is the dark the door opens in, where nothing is lit but the door's own light
  dim: 0,
  // Which event's asteroid is passing: -1 before the first, the event count after the last
  log: -1,
  fly: 0,
  chase: 0,
  burn: 0,
  smoke: 0,
  out: 1,
  wave: 1,
  sat: 0,
  links: 0,
  shell: 0,
  // Which planet the visitor went down to, and how far: 0 in orbit, 0.5 passing through its air, 1 on the ground
  planet: 0,
  inside: 0,
  // The ride to the ID Finder: 0 not here, 1 pulled up by Axie, 2 Axie on its back step, 3 gone off screen
  jeep: 0,
});

export type SkyState = ReturnType<typeof initialSky>;
