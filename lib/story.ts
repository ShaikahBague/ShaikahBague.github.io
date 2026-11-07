export type Point = [number, number, number];

export const WORLD_POS: Point[] = [
  [24, 0, -170],
  [-24, 0, -280],
  [24, 0, -390],
];
export const WORLD_RADIUS = 14;
export const CAMERA_GAP = 60;

export const EARTH_RADIUS = 45;
export const GROUND_Y = -2.6;

// Parked, the rocket's door faces this way, and Axie's walk runs along it from inside the hull to their mark
export const DOOR_DIR = { x: Math.sin(Math.PI / 6), z: Math.cos(Math.PI / 6) };
const INSIDE = 0.4;
export const SILL = { along: 1.35, y: -1.32 };
export const RAMP_FOOT = 6;
export const MARK = 14;

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
    walk: shot([20, 5.5, -0.4], [3, 0, -0.2]),
    board: shot([12.5, 3, 1.4], [0, 0, 2.6]),
    launch: { cx: 0, cy: -1, cz: 36, lx: 0, ly: 4, lz: 0 },
    liftoff: { cx: 0, cy: 8, cz: 34, lx: 0, ly: 28, lz: -4 },
    door: shot([13, 0, 0.4], [0, 0, 0]),
    doorBack: shot([25, 0, 6.5], [4, 0, -1]),
    chat: shot([21, -2.2, -0.9], [8, 0.6, 0.4]),
  },
  port: {
    hq: shot([32, -3.5, -0.2], [6, 2, 0.9]),
    walk: shot([24, 4.5, -0.2], [3, 0, 0]),
    board: shot([19, 3, 1.2], [0, 0, 2.4]),
    launch: { cx: 0, cy: -1, cz: 48, lx: 0, ly: 6, lz: 0 },
    liftoff: { cx: 0, cy: 8, cz: 46, lx: 0, ly: 30, lz: -4 },
    door: shot([18, 0, 0.4], [0, 0, 0]),
    doorBack: shot([34, 0, 8], [4, 0, -1]),
    // Aimed low with the view shifted up, so Axie stands above the chat panel that fills the bottom of a phone
    chat: shot([24, -1, 0.2], [14, -0.4, -2.5]),
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
  logStart: 22,
  logEnd: 23,
  crew: 25,
  home: 27,
};

export const SCREENS_PER_UNIT = 1.3;

// Where each story beat rests on the scroll timeline; one unit is SCREENS_PER_UNIT screens of scrolling
export const AT = {
  house: 0,
  liftoff: 2.85,
  signal: 3.85,
  links: 4.75,
  enterprise: 5.75,
  cyberops: 6.75,
  devnet: 7.75,
  log: 8.85,
  crew: 12.95,
  home: 16.9,
  chat: 19.45,
  end: 21.55,
};

// The page can outrun the capped camera, so it waits at the chat until Axie has got there and had a moment to say hello
const CHAT_HOLD = 1.5;
export const holdsAtChat = (time: number, restedFor: number) => time < AT.chat - 0.01 || restedFor < CHAT_HOLD;

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

// The shapes the years' constellations take, newest year first, in percent of the chart. Each runs left to right, so a phone can
// stack the same stars down the screen in order. More years than shapes start over
const CHART_SHAPES = [
  [[5, 70], [22, 20], [40, 72], [58, 22], [76, 70], [92, 28]],
  [[5, 22], [22, 72], [40, 34], [58, 80], [76, 38], [92, 72]],
  [[5, 16], [23, 54], [41, 28], [59, 72], [77, 46], [92, 84]],
];

// Where each officer's star goes: evenly spaced along the year's shape, so any number of officers fits
export function starChart(year: number, count: number) {
  const shape = CHART_SHAPES[year % CHART_SHAPES.length];
  const legs = shape.slice(1).map(([x, y], i) => Math.hypot(x - shape[i][0], y - shape[i][1]));
  const total = legs.reduce((sum, leg) => sum + leg, 0);
  return Array.from({ length: count }, (_, star) => {
    let along = count > 1 ? (star / (count - 1)) * total : 0;
    let leg = 0;
    while (leg < legs.length - 1 && along > legs[leg]) along -= legs[leg++];
    const [x, y] = shape[leg].map((value, axis) => value + (shape[leg + 1][axis] - value) * (along / legs[leg]));
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  });
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
});

export type SkyState = ReturnType<typeof initialSky>;
