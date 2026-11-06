export type Point = [number, number, number];

export const WORLD_POS: Point[] = [
  [24, 0, -170],
  [-24, 0, -280],
  [24, 0, -390],
];
export const WORLD_RADIUS = 14;
export const CAMERA_GAP = 60;

export const PAD_VIEW = { cx: 0, cy: 0.6, cz: 18.5, lx: 0, ly: 2.6, lz: 0 };
export const PAD_VIEW_PORTRAIT = { ...PAD_VIEW, cz: 29, ly: 0.6 };

export const EARTH_RADIUS = 45;
export const GROUND_Y = -2.6;

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
  // Home: the jump here is hidden by a flash, then the rocket backs down onto the pad it left
  [-24, 46, 24], [-12, 26, 12], [-5, 14, 5], [0, 7, 0], PAD,
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
  descent: 27,
  approach: 28,
  home: 31,
};

// Where each story beat rests on the scroll timeline; one unit is one screen of scrolling.
// #story in globals.css is (end + 1) screens tall, so change them together
export const AT = {
  house: 0,
  liftoff: 0.9,
  signal: 1.9,
  links: 2.8,
  enterprise: 3.8,
  cyberops: 4.8,
  devnet: 5.8,
  log: 6.9,
  crew: 10,
  home: 11.3,
  chat: 12.3,
  end: 12.75,
};

// Where a page that has stopped scrolling should settle, given the last chapter it rested on. A nudge
// too small to mean anything returns there; anything more goes on to the next chapter in that direction,
// unless it already landed about on one. Measured from the rest, because GSAP's own direction flips while
// a snap is running, which sent the page back and forth between chapters
export function snapTarget(rests: number[], from: number, now: number, slack = 0.06) {
  if (now > from) return rests.find((rest) => rest >= now - slack) ?? rests[rests.length - 1];
  return [...rests].reverse().find((rest) => rest <= now + slack) ?? rests[0];
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
  ...PAD_VIEW,
  fov: 42,
  side: 0,
  house: 1,
  fly: 0,
  chase: 0,
  retro: 0,
  burn: 0,
  smoke: 0,
  out: 1,
  wave: 1,
  sat: 0,
  links: 0,
  shell: 0,
});

export type SkyState = ReturnType<typeof initialSky>;
