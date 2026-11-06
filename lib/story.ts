export const WORLD_POS: [number, number, number][] = [
  [24, 0, -170],
  [-24, 0, -280],
  [24, 0, -390],
  [-24, 0, -500],
];
export const WORLD_RADIUS = 14;
export const CAMERA_GAP = 60;

export const DOME_VIEW = { cx: 0, cy: 0.6, cz: 15, lx: 0, ly: 2.9, lz: 0 };
export const DOME_VIEW_PORTRAIT = { ...DOME_VIEW, cz: 24, ly: 3.2 };

export const MOTION_KEY = "cncp-motion";

// Where each story beat rests on the scroll timeline; one unit is one screen of scrolling
export const AT = {
  house: 0,
  lights: 0.9,
  signal: 1.7,
  links: 2.4,
  networking: 3.3,
  cybersecurity: 4.2,
  data: 5.1,
  iot: 6,
  descent: 6.9,
  launch: 7.7,
  houselights: 9.05,
  seat: 9.6,
  end: 10,
};

// 54 people attended the launch, and the last seat in the plan is the visitor's
export const seats = [7, 9, 11, 13, 15].flatMap((count, row) =>
  Array.from({ length: count }, (_, i) => {
    const radius = 112 + row * 40;
    const angle = 180 + ((i + 0.5) / count) * 180;
    const rad = (angle * Math.PI) / 180;
    return {
      key: `${row}-${i}`,
      x: Math.round((320 + Math.cos(rad) * radius) * 100) / 100,
      y: Math.round((350 + Math.sin(rad) * radius) * 100) / 100,
      turn: Math.round(angle + 90),
      open: row === 1 && i === 2,
    };
  }),
);

export const initialSky = () => ({
  ...DOME_VIEW,
  fov: 42,
  side: 0,
  house: 1,
  burst: 0,
  lamp: 0,
  spin: 0,
  sat: 0,
  links: 0,
  shell: 0,
  bars: 0,
  dawn: 0,
  seats: 0,
});

export type SkyState = ReturnType<typeof initialSky>;
