import {
  BoxGeometry,
  BufferAttribute,
  type BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  TetrahedronGeometry,
  TextureLoader,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { DOOR_DIR, GROUND_Y } from "@/lib/story";

// One stretch of facade texture: this many windows across and floors up, some with their lights on
const WINDOWS = 8;
const FLOORS = 6;
const WINDOW_WIDTH = 3;
const FLOOR_HEIGHT = 3;
// How far back the offices' front stands from the pad, which leaves the rocket and the title the sky
const FRONT = -88;
const ROOF_FLOORS = 5;
// How many metres of ground the site painting covers, and how many one tile of paving does
const SITE = 360;
const PAVING_TILE = 3;

const dice = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const canvas2d = (size: number) => {
  const element = document.createElement("canvas");
  element.width = element.height = size;
  return { element, c: element.getContext("2d")! };
};

const painted = (element: HTMLCanvasElement, repeatX = 1, repeatY = repeatX) => {
  const map = new CanvasTexture(element);
  map.colorSpace = SRGBColorSpace;
  map.wrapS = map.wrapT = RepeatWrapping;
  map.repeat.set(repeatX, repeatY);
  map.anisotropy = 8;
  return map;
};

// A colour baked into a shape's vertices, so any number of props can share one draw call
const coloured = (shape: BufferGeometry, color: string, shade: (y: number) => number = () => 1) => {
  const piece = shape.index ? shape.toNonIndexed() : shape;
  piece.deleteAttribute("uv");
  const position = piece.attributes.position;
  const base = new Color(color);
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const light = shade(position.getY(i));
    colors.set([base.r * light, base.g * light, base.b * light], i * 3);
  }
  piece.setAttribute("color", new BufferAttribute(colors, 3));
  return piece;
};

function facadeTextures(size: number) {
  const paint = canvas2d(size);
  const glow = canvas2d(size);
  const p = paint.c;
  const g = glow.c;
  const random = dice(7);
  p.fillStyle = "#e4e2ea";
  p.fillRect(0, 0, size, size);
  g.fillStyle = "#000";
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 3; i++) {
    p.fillStyle = `rgba(${random() < 0.5 ? "70,70,90" : "255,255,255"},${0.02 + random() * 0.05})`;
    p.fillRect(random() * size, random() * size, 1 + (random() * size) / 170, 1 + (random() * size) / 170);
  }
  const w = size / WINDOWS;
  const h = size / FLOORS;
  for (let row = 0; row < FLOORS; row++) {
    p.fillStyle = "rgba(60,58,90,.14)";
    p.fillRect(0, row * h + h * 0.84, size, h * 0.16);
    for (let col = 0; col < WINDOWS; col++) {
      const x = col * w + w * 0.07;
      const y = row * h + h * 0.14;
      const across = w * 0.86;
      const down = h * 0.62;
      // Glass holds the sky: bright at the top where it sees up, dark at the bottom where it sees the ground
      const glass = p.createLinearGradient(0, y, 0, y + down);
      glass.addColorStop(0, "#86aee0");
      glass.addColorStop(0.45, "#3a5ca6");
      glass.addColorStop(1, "#1f2c68");
      p.fillStyle = glass;
      p.fillRect(x, y, across, down);
      // Rooms are lived in, so some blinds are down, each to its own height
      if (random() < 0.32) {
        const drop = down * (0.2 + random() * 0.55);
        p.fillStyle = random() < 0.5 ? "#d8cdb0" : "#bcc5da";
        p.fillRect(x, y, across, drop);
        p.fillStyle = "rgba(40,40,70,.12)";
        for (let slat = 0; slat < drop; slat += size / 128) p.fillRect(x, y + slat, across, 1);
      }
      if ((col * 7 + row * 13) % 5 === 0) {
        g.fillStyle = (col + row) % 2 ? "#ffd894" : "#fff0c9";
        g.fillRect(x, y, across, down);
      }
      // Frames and a sill, with the rain stain that runs down from it
      [p, g].forEach((context, i) => {
        context.fillStyle = i ? "#000" : "#f4f3f8";
        context.fillRect(x + across / 2 - size / 512, y, size / 256, down);
        context.fillRect(x, y + down * 0.3, across, size / 512);
      });
      p.fillStyle = "#fbfaff";
      p.fillRect(x - w * 0.03, y + down, across + w * 0.06, h * 0.035);
      const stain = p.createLinearGradient(0, y + down, 0, y + down + h * 0.2);
      stain.addColorStop(0, `rgba(60,60,80,${0.1 + random() * 0.14})`);
      stain.addColorStop(1, "rgba(60,60,80,0)");
      p.fillStyle = stain;
      p.fillRect(x + across * random() * 0.5, y + down, across * 0.5, h * 0.2);
    }
  }
  return { map: painted(paint.element), emissiveMap: painted(glow.element) };
}

// A box whose texture repeats by real size, so every block has windows of the same scale. Each block starts the pattern
// somewhere else and has its own tint of concrete, so they don't read as one texture. Roofs land on a plain bit of wall
function block(width: number, height: number, depth: number, x: number, z: number, tint: string) {
  const box = new BoxGeometry(width, height, depth);
  const uv = box.attributes.uv;
  const across = [depth, depth, 0, 0, width, width];
  const start = Math.round(Math.abs(x)) / WINDOWS;
  for (let i = 0; i < uv.count; i++) {
    const face = across[Math.floor(i / 4)];
    if (face) uv.setXY(i, start + (uv.getX(i) * face) / (WINDOWS * WINDOW_WIDTH), (uv.getY(i) * height) / (FLOORS * FLOOR_HEIGHT));
    else uv.setXY(i, 0.001, 0.001);
  }
  const base = new Color(tint);
  const colors = new Float32Array(uv.count * 3);
  for (let i = 0; i < uv.count; i++) colors.set([base.r, base.g, base.b], i * 3);
  box.setAttribute("color", new BufferAttribute(colors, 3));
  return box.translate(x, GROUND_Y + height / 2, z);
}

function signTexture() {
  const map = new TextureLoader().load("/cncp-white.png", undefined, undefined, (error) => console.error(error));
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 8;
  return map;
}

// One tile of lawn, up close: drifts of colour with blades drawn over them. Blades batch by colour because a stroke per blade is slow
function grassTexture(size: number) {
  const { element, c } = canvas2d(size);
  const random = dice(19);
  c.fillStyle = "#6ea950";
  c.fillRect(0, 0, size, size);
  const drifts = ["#5c9a46", "#7fb85a", "#88bb5e", "#558f41", "#97c261"];
  c.globalAlpha = 0.3;
  for (let i = 0; i < 46; i++) {
    const [x, y, wide, tall, tilt] = [random() * size, random() * size, size * (0.04 + random() * 0.12), size * (0.03 + random() * 0.08), random()];
    c.fillStyle = drifts[i % drifts.length];
    // Drawn again one tile over each way, so the drift carries on across the seam
    [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]].forEach(([dx, dy]) => {
      c.beginPath();
      c.ellipse(x + dx, y + dy, wide, tall, tilt, 0, Math.PI * 2);
      c.fill();
    });
  }
  c.lineWidth = size / 512;
  drifts.concat("#a9cf72", "#487e38").forEach((color, shade) => {
    c.strokeStyle = color;
    c.globalAlpha = 0.45 + (shade % 3) * 0.15;
    c.beginPath();
    for (let i = 0; i < size * 3.5; i++) {
      const [x, y] = [random() * size, random() * size];
      c.moveTo(x, y);
      c.lineTo(x + (random() - 0.5) * size * 0.012, y - size * (0.006 + random() * 0.012));
    }
    c.stroke();
  });
  return painted(element, (420 * 2) / 12);
}

// The whole site from above, multiplied over the grass: mown stripes, wandering colour and the shade under everything standing on it.
// Soft enough that a low resolution doesn't show, and painted once, which costs nothing per frame the way real shadows would
function siteTexture(size: number, trees: number[][], footprints: number[][]) {
  const { element, c } = canvas2d(size);
  const random = dice(29);
  const px = (metres: number) => (metres / SITE) * size;
  const soft = (x: number, z: number, wide: number, deep: number, color: string, alpha: number) => {
    c.save();
    c.translate((x / SITE + 0.5) * size, (0.5 - z / SITE) * size);
    c.scale(px(wide), px(deep));
    const shade = c.createRadialGradient(0, 0, 0, 0, 0, 1);
    shade.addColorStop(0, `rgba(${color},${alpha})`);
    shade.addColorStop(0.6, `rgba(${color},${alpha * 0.7})`);
    shade.addColorStop(1, `rgba(${color},0)`);
    c.fillStyle = shade;
    c.fillRect(-1, -1, 2, 2);
    c.restore();
  };
  c.fillStyle = "#fff";
  c.fillRect(0, 0, size, size);
  c.fillStyle = "rgba(44,84,44,.1)";
  for (let x = 0; x < SITE; x += 12) c.fillRect(px(x), 0, px(6), size);
  for (let i = 0; i < 70; i++) {
    const warm = i % 2 === 0;
    soft((random() - 0.5) * SITE, (random() - 0.5) * SITE, 8 + random() * 26, 6 + random() * 18, warm ? "150,132,52" : "26,74,50", 0.13 + random() * 0.13);
  }
  // Sun is high, behind the camera and to the left, so shade lies off to the right and away
  trees.forEach(([x, z, height]) => soft(x + height * 0.22, z - height * 0.28, height * 0.62, height * 0.48, "14,34,44", 0.62));
  footprints.forEach(([width, depth, x, z]) => soft(x, z, width * 0.62, depth * 0.72, "16,26,50", 0.5));
  return painted(element);
}

// Laid in rings out from the rocket, every stone its own shade, with a violet band and the soot of past launches
function plazaTexture(size: number) {
  const { element, c } = canvas2d(size);
  const random = dice(5);
  const middle = size / 2;
  c.fillStyle = "#857f78";
  c.fillRect(0, 0, size, size);
  const rings = 15;
  const joint = size / 700;
  for (let ring = 0; ring < rings; ring++) {
    const inner = (ring / rings) * middle;
    const outer = ((ring + 1) / rings) * middle;
    const stones = Math.max(6, Math.round(((inner + outer) * Math.PI) / ((middle / rings) * 1.7)));
    const start = random() * 6;
    for (let stone = 0; stone < stones; stone++) {
      const from = start + (stone / stones) * Math.PI * 2;
      const to = start + ((stone + 1) / stones) * Math.PI * 2;
      const gap = joint / outer;
      c.fillStyle = ring === rings - 4 ? `hsl(${256 + random() * 8} 30% ${46 + random() * 7}%)` : ring === rings - 1 ? `hsl(35 8% ${70 + random() * 6}%)` : `hsl(${30 + random() * 14} ${7 + random() * 8}% ${56 + random() * 10}%)`;
      c.beginPath();
      c.arc(middle, middle, outer - joint, from + gap, to - gap);
      c.arc(middle, middle, inner + joint, to - gap, from + gap, true);
      c.closePath();
      c.fill();
    }
  }
  const soot = c.createRadialGradient(middle, middle, middle * 0.18, middle, middle, middle * 0.46);
  soot.addColorStop(0, "rgba(28,22,44,.6)");
  soot.addColorStop(1, "rgba(28,22,44,0)");
  c.fillStyle = soot;
  c.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 1.5; i++) {
    c.fillStyle = `rgba(${random() < 0.6 ? "40,36,50" : "255,250,240"},${random() * 0.13})`;
    c.fillRect(random() * size, random() * size, 1 + random() * 2, 1 + random() * 2);
  }
  return painted(element);
}

// Brick in a running bond, for the walkways
function pavingTexture(size: number) {
  const { element, c } = canvas2d(size);
  const random = dice(11);
  c.fillStyle = "#6f6a68";
  c.fillRect(0, 0, size, size);
  const rows = 12;
  const courses = 6;
  const tall = size / rows;
  const long = size / courses;
  const joint = Math.max(1, size / 340);
  for (let row = 0; row < rows; row++) {
    for (let brick = -1; brick < courses; brick++) {
      c.fillStyle = `hsl(${14 + random() * 22} ${16 + random() * 16}% ${54 + random() * 16}%)`;
      c.fillRect((brick + (row % 2) * 0.5) * long + joint, row * tall + joint, long - joint * 2, tall - joint * 2);
    }
  }
  return painted(element);
}

// Wavelets too small to model, drifting over the bay. Stays close to white, since the colour comes from the bay's own haze
function waterTexture(size: number) {
  const { element, c } = canvas2d(size);
  const random = dice(13);
  c.fillStyle = "#c9dcea";
  c.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 1.4; i++) {
    c.fillStyle = random() < 0.42 ? `rgba(255,255,255,${0.2 + random() * 0.5})` : `rgba(32,72,120,${0.1 + random() * 0.2})`;
    c.fillRect(random() * size, random() * size, size * (0.01 + random() * 0.05), 1 + random() * 1.5);
  }
  return painted(element, 60, 36);
}

// The way in, seen through its glass: a warm hall behind tall frames and a pair of doors. It lights itself, so this is both its colour and its glow
function lobbyTexture() {
  const size = 256;
  const { element, c } = canvas2d(size);
  const hall = c.createLinearGradient(0, 0, 0, size);
  hall.addColorStop(0, "#fff3d6");
  hall.addColorStop(0.7, "#e8c78c");
  hall.addColorStop(1, "#8a6a48");
  c.fillStyle = hall;
  c.fillRect(0, 0, size, size);
  c.fillStyle = "#2a2440";
  for (let x = 0; x <= 8; x++) c.fillRect((x / 8) * size - 2, 0, 4, size);
  c.fillRect(0, size * 0.32, size, 5);
  c.fillRect(size * 0.4, size * 0.48, size * 0.2, 5);
  c.fillStyle = "#2a244088";
  [0.14, 0.27, 0.72, 0.83].forEach((x) => {
    c.fillRect(x * size, size * 0.72, size * 0.025, size * 0.28);
    c.beginPath();
    c.arc((x + 0.0125) * size, size * 0.69, size * 0.02, 0, Math.PI * 2);
    c.fill();
  });
  return painted(element);
}

// The bridge from last term's theme, "Building Bridges", across the bay behind headquarters. Built along x with its middle at the
// origin. Towers are taller against the span than the real one, which would be lost behind the offices at its true proportions
const SPAN = 130;
const SIDE_SPAN = 70;
const TOWER = 100;
const DECK = 30;
const DECK_WIDTH = 16;
const beam = (width: number, height: number, depth: number, x: number, y: number, z: number) => new BoxGeometry(width, height, depth).translate(x, GROUND_Y + y, z);

function buildBridge() {
  const parts: BufferGeometry[] = [beam((SPAN + SIDE_SPAN) * 2, 1.4, DECK_WIDTH, 0, DECK, 0)];
  [-SPAN, SPAN].forEach((x) => {
    [-1, 1].forEach((side) => {
      // Each leg steps in as it rises, the shape that makes these towers recognisable
      [[0, 0.42, 5.2], [0.42, 0.68, 4.2], [0.68, 0.86, 3.4], [0.86, 1, 2.6]].forEach(([from, to, width]) => {
        parts.push(beam(width, TOWER * (to - from), width + 0.8, x, TOWER * (from + to) * 0.5, side * (DECK_WIDTH / 2 + 1)));
      });
    });
    // Portal struts above the deck, with deeper bracing below it
    [0.2, 0.46, 0.64, 0.8, 0.93, 1].forEach((up) => parts.push(beam(2.6, up === 1 ? 3 : 2.2, DECK_WIDTH + 2, x, TOWER * up - (up === 1 ? 1.5 : 0), 0)));
  });
  const main = (x: number) => DECK + 3 + (TOWER - DECK - 3) * (x / SPAN) ** 2;
  const outer = (x: number) => DECK + 1 + (TOWER - DECK - 1) * (1 - (Math.abs(x) - SPAN) / SIDE_SPAN) ** 2;
  const cableHeight = (x: number) => (Math.abs(x) <= SPAN ? main(x) : outer(x));
  const up = new Vector3();
  [-1, 1].forEach((side) => {
    const z = side * (DECK_WIDTH / 2 + 1);
    for (let x = -SPAN - SIDE_SPAN; x < SPAN + SIDE_SPAN; x += 10) {
      const [low, high] = [cableHeight(x), cableHeight(x + 10)];
      const piece = new BoxGeometry(Math.hypot(10, high - low) + 0.4, 1.1, 1.1);
      piece.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), up.set(10, high - low, 0).normalize()));
      parts.push(piece.translate(x + 5, GROUND_Y + (low + high) / 2, z));
      if (x % 20 === 0 && Math.abs(x) !== SPAN) parts.push(beam(0.35, low - DECK, 0.35, x, (low + DECK) / 2, z));
    }
  });
  return mergeGeometries(parts);
}

// Too far off for the scene's fog, which is all gone by the middle distance. These take their haze by hand, the same way fog would
const distant = (color: string, haze: number, flat = false, skin: MeshLambertMaterial | MeshStandardMaterial = new MeshLambertMaterial({ color, fog: false, flatShading: flat })) => ({ base: new Color(color), haze, skin });

// A tree one unit tall, canopy and trunk in one shape so a whole wood is one draw. Lumpy, lit from the top and tinted per tree by its instance colour
function treeShape(random: () => number) {
  const lump = ([x, y, z, size]: number[]) => {
    const shape = new IcosahedronGeometry(1, 1);
    const position = shape.attributes.position;
    // Faces share corners, so a corner must move the same way on all of them or the surface splits
    const shifts = new Map<string, number>();
    for (let i = 0; i < position.count; i++) {
      const key = `${position.getX(i).toFixed(2)},${position.getY(i).toFixed(2)},${position.getZ(i).toFixed(2)}`;
      if (!shifts.has(key)) shifts.set(key, 0.85 + random() * 0.3);
      const shift = shifts.get(key)!;
      position.setXYZ(i, position.getX(i) * shift, position.getY(i) * shift, position.getZ(i) * shift);
    }
    return shape.scale(size, size * 0.86, size).translate(x, y, z);
  };
  const lit = (y: number) => 0.62 + Math.max(0, y - 0.45) * 1.15;
  return mergeGeometries([
    coloured(new CylinderGeometry(0.03, 0.05, 0.62, 5).translate(0, 0.31, 0), "#8a6a4c"),
    ...[[0, 0.72, 0, 0.3], [0.19, 0.62, 0.08, 0.2], [-0.17, 0.64, -0.08, 0.21], [0.02, 0.6, -0.2, 0.18]].map((part) => coloured(lump(part), "#ffffff", lit)),
  ]);
}

// Manila's own tree, for the edges of the site: a leaning trunk and a crown of drooping fronds, also one shape
function palmShape() {
  const trunk = new CylinderGeometry(0.018, 0.032, 1, 5, 4).translate(0, 0.5, 0);
  const position = trunk.attributes.position;
  for (let i = 0; i < position.count; i++) position.setX(i, position.getX(i) + position.getY(i) ** 2 * 0.07);
  const fronds = Array.from({ length: 8 }, (_, i) => {
    const frond = new PlaneGeometry(0.42, 0.09, 3, 1).translate(0.21, 0, 0).rotateX(-Math.PI / 2);
    const points = frond.attributes.position;
    for (let p = 0; p < points.count; p++) {
      const along = points.getX(p) / 0.42;
      points.setZ(p, points.getZ(p) * (1 - along * 0.8));
      points.setY(p, along * 0.1 - along * along * 0.24);
    }
    frond.computeVertexNormals();
    return coloured(frond.rotateY((i / 8) * Math.PI * 2 + i * 0.2).translate(0.07, 1, 0), i % 2 ? "#5b9b3f" : "#478a3c");
  });
  return mergeGeometries([coloured(trunk, "#9a8460"), ...fronds]);
}

// Someone about, 1.7m tall and small in frame, so a few simple shapes read as a person
function personShape(shirt: string, legs: string, skin = "#c49a74") {
  return mergeGeometries([
    coloured(new CylinderGeometry(0.1, 0.13, 0.85, 5).translate(0, 0.42, 0), legs),
    coloured(new CylinderGeometry(0.19, 0.22, 0.62, 6).translate(0, 1.12, 0), shirt),
    coloured(new IcosahedronGeometry(0.15, 0).translate(0, 1.58, 0), skin),
    coloured(new IcosahedronGeometry(0.16, 0).scale(1, 0.6, 1).translate(0, 1.64, 0), "#1c1a22"),
  ]);
}

export function buildCampus(low: boolean) {
  const group = new Group();
  const random = dice(41);
  const textureSize = low ? 512 : 1024;
  const clock = { value: 0 };
  const matrix = new Matrix4();
  const up = new Vector3(0, 1, 0);
  const spot = new Vector3();
  const facing = new Quaternion();
  const size = new Vector3();
  const place = (x: number, y: number, z: number, wide: number, tall: number, deep = wide, heading = 0) => matrix.compose(spot.set(x, y, z), facing.setFromAxisAngle(up, heading), size.set(wide, tall, deep));

  // Motion worked out on the GPU, so swaying a whole wood costs the page nothing. Each snippet needs its own cache key, or materials would share the first one's program
  const moving = (material: MeshLambertMaterial, code: string) => {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = clock;
      shader.vertexShader = `uniform float uTime;\n${shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>\n${code}`)}`;
    };
    material.customProgramCacheKey = () => code;
    return material;
  };

  const blocks: [number, number, number, number, number, string][] = [
    // Kept low, so the bridge clears their roofs
    [WINDOW_WIDTH * 30, FLOOR_HEIGHT * ROOF_FLOORS, 16, -14, FRONT - 8, "#ffffff"],
    [WINDOW_WIDTH * 9, FLOOR_HEIGHT * 11, 18, -52, FRONT - 10, "#ede6f7"],
    [WINDOW_WIDTH * 18, FLOOR_HEIGHT * 3, 28, 62, FRONT + 4, "#f8ecd9"],
    [WINDOW_WIDTH * 14, FLOOR_HEIGHT * 4, 24, -96, FRONT + 8, "#e2ecf0"],
  ];

  // Paths from the plaza to each door, and what the trees must keep off
  const paths = [
    [-13, 0, -13, FRONT, 9],
    [-18, -8, -88, FRONT + 20, 5],
    [16, -11, 56, FRONT + 18, 5],
  ];
  const offPath = (x: number, z: number) =>
    paths.every(([x1, z1, x2, z2, width]) => {
      const along = Math.min(1, Math.max(0, ((x - x1) * (x2 - x1) + (z - z1) * (z2 - z1)) / ((x2 - x1) ** 2 + (z2 - z1) ** 2)));
      return Math.hypot(x - x1 - along * (x2 - x1), z - z1 - along * (z2 - z1)) > width / 2 + 2.5;
    });
  const tents: [number, number, string][] = [[-37, -42, "#7c3aed"], [-49, -30, "#efe6ff"]];
  const cafe = [[44, -56], [52, -60], [61, -56], [70, -60]];
  const clearOf = (x: number, z: number) => [...tents, ...cafe].every(([a, b]) => Math.hypot(x - (a as number), z - (b as number)) > 7);

  // Trees round the plaza and along the walkway, off the line Axie walks, thickening into a wood toward the edges of the site
  const spots: number[][] = [];
  for (let i = 0; i < (low ? 46 : 92); i++) {
    const a = random() * Math.PI * 2;
    const r = i % 2 ? 30 + random() * 45 : 70 + random() * 75;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r - 20;
    const onDoorSide = DOOR_DIR.x * x + DOOR_DIR.z * z > 0;
    if (z > FRONT + 14 && !onDoorSide && Math.abs(x + 13) > 8 && offPath(x, z) && clearOf(x, z)) spots.push([x, z, 5.4 + random() * 4]);
  }
  [-1, 1].forEach((side) => [-28, -42, -56, -70].forEach((z) => spots.push([-13 + side * 7, z, 6.5 + random() * 1.5])));
  // A wood over the near headland, standing on the hill's surface. It fills the frame behind Axie at the end, too close to be bare
  const [headX, headZ, headWide, headTall, headDeep] = [130, -125, 50, 40, 40];
  for (let i = 0; i < (low ? 14 : 30); i++) {
    const [a, r] = [random() * Math.PI * 2, Math.sqrt(random()) * 0.84];
    spots.push([headX + Math.cos(a) * r * headWide, headZ + Math.sin(a) * r * headDeep, 8 + random() * 5, headTall * Math.sqrt(1 - r * r)]);
  }
  const palmSpots = [[-74, -28], [-62, -8], [84, -24], [72, 4], [108, -44], [-112, -38], [94, -74], [34, -78], [-34, -77], [118, -6]].slice(0, low ? 6 : 10);

  // Ground and paths are matte and fill the screen, so they use the cheaper lighting model. The painted site is multiplied over the grass in the shader
  const grass = new MeshLambertMaterial({ map: grassTexture(low ? 256 : 512) });
  const site = siteTexture(textureSize, [...spots, ...palmSpots.map(([x, z]) => [x, z, 5])], blocks.map(([width, , depth, x, z]) => [width, depth, x, z]));
  grass.onBeforeCompile = (shader) => {
    shader.uniforms.uSite = { value: site };
    shader.vertexShader = `varying vec2 vSite;\n${shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>\nvSite=position.xz/${SITE.toFixed(1)}+.5;`)}`;
    shader.fragmentShader = `uniform sampler2D uSite;varying vec2 vSite;\n${shader.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.rgb*=texture2D(uSite,vSite).rgb;")}`;
  };
  const ground = new Mesh(new CircleGeometry(420, 64).rotateX(-Math.PI / 2).translate(0, GROUND_Y, 0), grass);
  const walkway = new Mesh(
    mergeGeometries(
      paths.map(([x1, z1, x2, z2, width]) => {
        const length = Math.hypot(x2 - x1, z2 - z1);
        const strip = new PlaneGeometry(width, length);
        const uv = strip.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * width) / PAVING_TILE, (uv.getY(i) * length) / PAVING_TILE);
        return strip.rotateX(-Math.PI / 2).rotateY(Math.atan2(x2 - x1, z2 - z1)).translate((x1 + x2) / 2, GROUND_Y + 0.02, (z1 + z2) / 2);
      }),
    ),
    new MeshLambertMaterial({ map: pavingTexture(low ? 256 : 512) }),
  );
  const plaza = new Mesh(new CircleGeometry(19, 48).rotateX(-Math.PI / 2).translate(0, GROUND_Y + 0.03, 0), new MeshLambertMaterial({ map: plazaTexture(textureSize) }));
  ground.receiveShadow = walkway.receiveShadow = plaza.receiveShadow = true;

  const facade = new MeshStandardMaterial({ ...facadeTextures(textureSize), vertexColors: true, emissive: "#ffffff", emissiveIntensity: 0.14, metalness: 0.12, roughness: 0.5 });
  const offices = new Mesh(mergeGeometries(blocks.map(([width, height, depth, x, z, tint]) => block(width, height, depth, x, z, tint))), facade);

  // The way in: a tall lit lobby under a canopy, at the far end of the walkway from the pad
  const lobbyMap = lobbyTexture();
  const lobbyGlass = new MeshStandardMaterial({ map: lobbyMap, emissive: "#ffd894", emissiveMap: lobbyMap, emissiveIntensity: 0.9, metalness: 0.3, roughness: 0.2 });
  const lobby = new Mesh(new BoxGeometry(17, 9, 5).translate(-13, GROUND_Y + 4.5, FRONT + 1), lobbyGlass);

  // Everything that stands still and has no texture of its own, all one mesh, so its detail adds triangles but no draw calls
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: string, heading = 0) => coloured(new BoxGeometry(w, h, d).rotateY(heading).translate(x, GROUND_Y + y, z), color);
  const pole = (r: number, h: number, x: number, z: number, color: string, y = h / 2) => coloured(new CylinderGeometry(r, r, h, 6).translate(x, GROUND_Y + y, z), color);
  const props: BufferGeometry[] = [
    box(24, 0.5, 10, -13, 9.4, FRONT + 4, "#e9eaf6"),
    ...[-23, -3].map((x) => pole(0.22, 9.2, x, FRONT + 8, "#e9eaf6")),
    // The sign's frame on the roof, since a logo can't stand on nothing
    ...[-13, 5].map((x) => pole(0.14, 10, x, FRONT - 0.4, "#4a4e66", FLOOR_HEIGHT * ROOF_FLOORS + 5)),
    box(22, 0.2, 0.2, -4, FLOOR_HEIGHT * ROOF_FLOORS + 8, FRONT - 0.4, "#4a4e66"),
    // Flagpoles by the lobby
    ...[-29, -26.5, -24].map((x) => pole(0.07, 9, x, FRONT + 13, "#d9d9e6")),
  ];
  // Every building: a dark stone base, a coping along the roof and what roofs actually carry
  blocks.forEach(([width, height, depth, x, z]) => {
    props.push(box(width + 0.5, 1.5, depth + 0.5, x, 0.75, z, "#55546a"), box(width + 0.7, 0.55, depth + 0.7, x, height + 0.27, z, "#f4f3f9"));
    for (let i = 0; i < Math.round(width / 11); i++) {
      const [ax, az] = [x + (random() - 0.5) * (width - 8), z + (random() - 0.5) * (depth - 6)];
      props.push(box(2.2 + random() * 2, 1.2 + random() * 0.8, 2 + random() * 1.5, ax, height + 1.2, az, i % 2 ? "#a8acc0" : "#8f93aa"));
    }
    props.push(pole(0.07, 6, x - width * 0.32, z, "#585b70", height + 3), coloured(new CylinderGeometry(1.5, 1.5, 3, 8).translate(x + width * 0.3, GROUND_Y + height + 2.4, z - depth * 0.2), "#b5bccf"));
    // Striped awnings over the shops on the ground floor
    if (x > 0) {
      for (let i = 0; i < 6; i++) {
        const ax = x - width / 2 + 5 + (i * (width - 10)) / 5;
        props.push(coloured(new BoxGeometry(5.6, 0.14, 2.4).rotateX(0.3).translate(ax, GROUND_Y + 3.6, z + depth / 2 + 1.2), i % 2 ? "#c084fc" : "#f4f1fb"));
      }
    }
  });
  // Lamps down both sides of the walkway, each with the org's banner
  const lampSpots = [-22, -35, -49, -63, -77].flatMap((z) => [-1, 1].map((side) => [-13 + side * 4.8, z]));
  const lampMaterial = new MeshBasicMaterial({ color: "#ffe6b0" });
  const lamps = new Mesh(mergeGeometries(lampSpots.map(([x, z]) => new SphereGeometry(0.28, 10, 8).translate(x, GROUND_Y + 3.1, z))), lampMaterial);
  lampSpots.forEach(([x, z], i) => props.push(coloured(new CylinderGeometry(0.06, 0.08, 3, 6).translate(x, GROUND_Y + 1.5, z), "#3e4058"), box(0.04, 0.95, 0.42, x, 2.3, z + 0.28, i % 4 < 2 ? "#6d34dd" : "#c9a7f7")));
  // A kerb and a loose hedge along each side of the walkway
  const shrub = new IcosahedronGeometry(1, 0);
  [-1, 1].forEach((side) => {
    props.push(box(0.3, 0.16, 68, -13 + side * 4.6, 0.08, -54, "#c7c7d0"));
    for (let z = -22; z > -84; z -= 2.2) {
      const spread = 0.85 + random() * 0.25;
      if (random() < 0.9) props.push(coloured(shrub.clone().scale(spread * 1.2, spread * 0.8, spread * 1.2).translate(-13 + side * 5.9, GROUND_Y + 0.6, z), random() < 0.5 ? "#3f8444" : "#4f9548"));
    }
  });
  // Benches round the plaza, facing in, between the paths and clear of the line Axie walks
  [2.35, 2.85, 3.3, 4.5, 4.95, 5.25].forEach((a) => {
    const [x, z] = [Math.cos(a) * 20.4, Math.sin(a) * 20.4];
    const inward = Math.atan2(-x, -z);
    const [sin, cos] = [Math.sin(inward), Math.cos(inward)];
    props.push(box(2.2, 0.1, 0.6, x, 0.5, z, "#a87a4c", inward), box(2.2, 0.5, 0.08, x - sin * 0.32, 0.85, z - cos * 0.32, "#946a42", inward), box(0.1, 0.5, 0.5, x + cos * 0.95, 0.25, z - sin * 0.95, "#3e4058", inward), box(0.1, 0.5, 0.5, x - cos * 0.95, 0.25, z + sin * 0.95, "#3e4058", inward));
  });
  // A student org's natural habitat: pop-up tents with a table out front, and a cafe's tables under umbrellas
  tents.forEach(([x, z, color]) => {
    props.push(coloured(new ConeGeometry(3.4, 1.3, 4).rotateY(Math.PI / 4).translate(x, GROUND_Y + 3.3, z), color));
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => props.push(pole(0.05, 2.65, x + a * 2.3, z + b * 2.3, "#dcdce8")));
    props.push(box(3.2, 0.8, 0.9, x, 0.4, z + 1.4, "#f2eefc"));
  });
  cafe.forEach(([x, z], i) => {
    props.push(coloured(new ConeGeometry(1.7, 0.6, 8).translate(x, GROUND_Y + 2.7, z), i % 2 ? "#f6c945" : "#8b5cf6"), pole(0.04, 2.5, x, z, "#e9e9ef"), pole(0.55, 0.05, x, z, "#f2f2f6", 0.82));
  });
  // The pad's landing marks
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    props.push(box(0.75, 0.02, 0.22, Math.cos(a) * 3.05, 0.31, Math.sin(a) * 3.05, i % 2 ? "#f6c945" : "#1f1a38", -a));
  }
  // People out and about in small groups, in the clothes people in the org's photos wear
  const wardrobe = ["#7a1f2e", "#22222c", "#e9e6f2", "#3e5fb0", "#d9a93a"].map((shirt) => personShape(shirt, "#23263c"));
  const crowds = [[-24, -31, 3], [-2, -45, 2], [31, -33, 3], [-38, -38, 2], [-47, -26, 3], [48, -53, 2], [59, -53, 2], [-26, -14, 2]].slice(0, low ? 5 : 8);
  let worn = 0;
  crowds.forEach(([x, z, count]) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + random();
      props.push(wardrobe[worn++ % wardrobe.length].clone().rotateY(random() * 6).translate(x + Math.cos(a) * 0.75, GROUND_Y, z + Math.sin(a) * 0.75));
    }
  });
  const scenery = new Mesh(mergeGeometries(props), new MeshLambertMaterial({ vertexColors: true }));

  // Flags by the lobby. The wave only bends the plane, so it stays a single cheap draw
  const flags = new Mesh(
    mergeGeometries(
      ([[-29, "#5b21d6"], [-26.5, "#efe6ff"], [-24, "#c084fc"]] as const).map(([x, color]) => {
        const sheet = new PlaneGeometry(2.4, 1.4, 8, 1).translate(1.2 + x, GROUND_Y + 8.2, FRONT + 13).toNonIndexed();
        const uv = sheet.attributes.uv;
        return coloured(sheet, color).setAttribute("uv", uv);
      }),
    ),
    moving(new MeshLambertMaterial({ vertexColors: true, side: DoubleSide }), "transformed.z+=sin(uv.x*7.-uTime*3.2+position.x*.7)*uv.x*.34;transformed.y+=sin(uv.x*4.-uTime*2.1)*uv.x*.1;"),
  );

  // Out of the fog, which washes the neon out at this distance. setHaze lets it go with everything else instead
  const signMaterial = new MeshBasicMaterial({ map: signTexture(), transparent: true, depthWrite: false, fog: false });
  // The logo's own proportions. It stands low on the roof because the image has clear space round the mark
  const sign = new Mesh(new PlaneGeometry(30, (30 * 773) / 1000), signMaterial);
  sign.position.set(-4, GROUND_Y + FLOOR_HEIGHT * ROOF_FLOORS + 8, FRONT);

  // Polished enough for the sun to run along it. Any more metal than this and it mirrors the purple the scene reflects, and turns to mustard
  const steel = distant("#ffbe1f", 0.02, false, new MeshStandardMaterial({ fog: false, metalness: 0.12, roughness: 0.28, envMapIntensity: 0.2 }));
  const shore = distant("#ffffff", 0.3, true, new MeshLambertMaterial({ fog: false, flatShading: true, vertexColors: true }));
  const headland = distant("#ffffff", 0.1, true, new MeshLambertMaterial({ fog: false, flatShading: true, vertexColors: true }));
  const waterMap = waterTexture(low ? 256 : 512);
  const bay = distant("#2f7fc4", 0.2, false, new MeshLambertMaterial({ fog: false, map: waterMap }));
  const cars = distant("#ffffff", 0.05);
  // Land built facet by facet, sand at the water and woods above with no two facets quite alike, so a hill has some ground on it
  const hill = ([x, z, wide, tall, deep]: number[], detail = low ? 2 : 3) => {
    const shape = new IcosahedronGeometry(1, detail);
    const position = shape.attributes.position;
    const colors = new Float32Array(position.count * 3);
    const paint = new Color();
    for (let i = 0; i < position.count; i += 3) {
      const height = Math.max(position.getY(i), position.getY(i + 1), position.getY(i + 2));
      paint.set(height < 0.12 ? "#c8b98a" : height < 0.34 ? "#6e9e58" : random() < 0.35 ? "#2f7048" : "#3f8a57").multiplyScalar(0.78 + random() * 0.44);
      for (let v = 0; v < 3; v++) colors.set([paint.r, paint.g, paint.b], (i + v) * 3);
    }
    shape.deleteAttribute("uv");
    shape.setAttribute("color", new BufferAttribute(colors, 3));
    return shape.scale(wide, tall, deep).translate(x, GROUND_Y, z);
  };
  // Headlands the far end lands on, and one for the near end, with the bay running to the horizon behind the offices.
  // Across the water the far side of the bay is a city, and on the water a few sails
  const shoreline: BufferGeometry[] = [];
  for (let x = -1000; x < 1000; x += 13 + random() * 22) {
    const tall = 12 + random() ** 2 * 62;
    shoreline.push(coloured(new BoxGeometry(10 + random() * 14, tall, 12).translate(x, GROUND_Y + tall / 2, -670 - random() * 60), ["#b9cbe2", "#c6d5e8", "#aabdd8", "#d2dcec"][Math.floor(random() * 4)]));
  }
  [[-150, -230], [80, -280], [270, -200], [-310, -320], [175, -430], [-60, -470]].forEach(([x, z], i) => {
    shoreline.push(coloured(new BoxGeometry(9, 1.2, 3).translate(x, GROUND_Y + 0.7, z), i % 2 ? "#f5f3ee" : "#3d3a5e"), coloured(new ConeGeometry(3.2, 11, 3).scale(1, 1, 0.08).translate(x, GROUND_Y + 6.8, z), "#ffffff"));
  });
  const far = new Mesh(mergeGeometries([...[[-20, -560, 190, 62, 90], [-250, -520, 190, 88, 90], [210, -600, 200, 46, 90]].map((part) => hill(part)), ...shoreline]), shore.skin);
  const water = new Mesh(new PlaneGeometry(2400, 1400).rotateX(-Math.PI / 2).translate(0, GROUND_Y + 0.04, FRONT - 30 - 700), bay.skin);
  const span = new Mesh(buildBridge(), steel.skin);
  // Runs from a near tower off to the right, over the bay to a far one behind the offices
  span.position.set(67.8, 0, -315.5);
  span.rotation.y = -1.383;

  // Traffic over the bridge. Moved a little each frame, but there are so few that it barely counts
  const carCount = low ? 6 : 12;
  const traffic = new InstancedMesh(new BoxGeometry(4.2, 1.6, 2), cars.skin, carCount);
  const carColors = ["#e8e6ef", "#2e3550", "#b83b3b", "#f6c945", "#4a78c8", "#d4d4dc"];
  for (let i = 0; i < carCount; i++) traffic.setColorAt(i, new Color(carColors[i % carColors.length]));
  traffic.frustumCulled = false;
  span.add(traffic);

  const trees = new InstancedMesh(treeShape(random), moving(new MeshLambertMaterial({ vertexColors: true, flatShading: true }), "transformed.xz+=vec2(sin(uTime*1.1+instanceMatrix[3][0]*.35),cos(uTime*.9+instanceMatrix[3][2]*.3))*.016*smoothstep(.4,1.,position.y);"), spots.length);
  // Mostly greens, with the odd tree in flower the way a Manila street has
  const canopies = ["#3f8f4a", "#2f7a45", "#57a14b", "#7aa83f", "#2d6e52", "#4a9a4c", "#3f8f4a", "#e0689f", "#57a14b", "#2f7a45", "#f0a630"];
  spots.forEach(([x, z, height, standing = 0], i) => {
    const wide = height * (0.9 + random() * 0.35);
    trees.setMatrixAt(i, place(x, GROUND_Y + standing, z, wide, height, wide, random() * 6));
    trees.setColorAt(i, new Color(canopies[i % canopies.length]));
  });
  const palms = new InstancedMesh(palmShape(), moving(new MeshLambertMaterial({ vertexColors: true, flatShading: true, side: DoubleSide }), "transformed.xz+=vec2(sin(uTime*1.4+instanceMatrix[3][0]),cos(uTime*1.1+instanceMatrix[3][2]))*.02*smoothstep(.7,1.,position.y);"), palmSpots.length);
  palmSpots.forEach(([x, z], i) => {
    const tall = 9 + random() * 4;
    palms.setMatrixAt(i, place(x, GROUND_Y, z, tall, tall, tall, random() * 6));
  });

  // Tufts and flowers in the lawn. Too many and too small to merge at load, so a single small shape stamped many times
  const tuftCount = low ? 220 : 700;
  const tuft = mergeGeometries([-0.5, 0, 0.5].map((lean, i) => new ConeGeometry(0.035, 0.42, 3, 1, true).translate(0, 0.21, 0).rotateZ(lean).rotateY(i * 2.1)));
  const tufts = new InstancedMesh(tuft, new MeshLambertMaterial({ flatShading: true }), tuftCount);
  const tuftColors = ["#4f8f3e", "#6aa84a", "#86b957", "#3f7f3a"];
  for (let i = 0; i < tuftCount; i++) {
    let [x, z] = [0, 0];
    // Lawn only: off the stone, the paths and the stretch right in front of the camera, where anything this simple shows what it is
    do {
      const a = random() * Math.PI * 2;
      const r = 21 + random() ** 1.3 * 80;
      [x, z] = [Math.cos(a) * r, Math.sin(a) * r - 10];
    } while (Math.hypot(x, z) < 21 || !offPath(x, z) || DOOR_DIR.x * x + DOOR_DIR.z * z > 0);
    tufts.setMatrixAt(i, place(x, GROUND_Y, z, 1 + random(), 0.8 + random() * 0.7, 1 + random(), random() * 6));
    tufts.setColorAt(i, new Color(tuftColors[i % 4]));
  }
  const flowerCount = low ? 180 : 620;
  const flowers = new InstancedMesh(new TetrahedronGeometry(0.15), new MeshLambertMaterial({ flatShading: true }), flowerCount);
  const blooms = ["#f06fa8", "#f6c945", "#ffffff", "#a56bf0", "#ff8a5c"];
  const beds = [[-26, -9, 3], [24, -8, 3], [-19, -58, 2.6], [-7, -66, 2.6], [-19, -34, 2.2], [-7, -38, 2.2], [24, -30, 4], [-33, -22, 3.2], [40, -40, 3.2], [-60, -46, 4], [-3, FRONT + 11, 2.6], [-23, FRONT + 16, 2.6]];
  for (let i = 0; i < flowerCount; i++) {
    const [x, z, r] = beds[i % beds.length];
    const [a, spread] = [random() * Math.PI * 2, random() ** 0.6 * r];
    flowers.setMatrixAt(i, place(x + Math.cos(a) * spread, GROUND_Y + 0.18 + random() * 0.2, z + Math.sin(a) * spread * 0.7, 0.7 + random() * 0.6, 0.7 + random() * 0.6));
    flowers.setColorAt(i, new Color(blooms[Math.floor(random() * 5)]));
  }
  [tufts, flowers].forEach((field) => (field.frustumCulled = false));

  // People walking the paths, up and back. Each is a few numbers a frame, and a bird's wings are a single scale
  const routes = [[-16, -20, -16, -84], [-10, -84, -10, -20], [-14, -30, -14, -80], [-22, -11, -84, FRONT + 22], [-84, FRONT + 22, -22, -11], [18, -13, 54, FRONT + 20], [54, FRONT + 20, 18, -13]].slice(0, low ? 4 : 7);
  const walkers = new InstancedMesh(personShape("#d9d4e8", "#23263c"), new MeshLambertMaterial({ vertexColors: true }), routes.length);
  const clothes = ["#ffffff", "#ffb3b3", "#a9c2ff", "#ffe08a", "#a8e0b8", "#ffffff", "#ffb3b3"];
  routes.forEach((_, i) => walkers.setColorAt(i, new Color(clothes[i])));
  walkers.frustumCulled = false;
  const wings = new PlaneGeometry(1.8, 0.42, 2, 1);
  const wingPoints = wings.attributes.position;
  for (let i = 0; i < wingPoints.count; i++) wingPoints.setZ(i, Math.abs(wingPoints.getX(i)) * 0.9);
  const birdCount = low ? 5 : 9;
  const birds = new InstancedMesh(wings.rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: "#26304d", side: DoubleSide }), birdCount);
  birds.frustumCulled = false;

  group.add(ground, walkway, plaza, offices, lobby, scenery, flags, sign, trees, palms, tufts, flowers, lamps, walkers, birds, water, far, new Mesh(hill([headX, headZ, headWide, headTall, headDeep], low ? 5 : 8), headland.skin), span);
  let signOpacity = 1;

  return {
    group,
    animate(time: number) {
      clock.value = time;
      waterMap.offset.set(time * 0.006, time * 0.0025);
      routes.forEach(([x1, z1, x2, z2], i) => {
        const trip = Math.hypot(x2 - x1, z2 - z1) / 1.1;
        const leg = (time / trip + i * 0.37) % 2;
        const along = leg < 1 ? leg : 2 - leg;
        const heading = Math.atan2(x2 - x1, z2 - z1) + (leg < 1 ? 0 : Math.PI);
        walkers.setMatrixAt(i, place(x1 + (x2 - x1) * along, GROUND_Y + Math.abs(Math.sin(time * 5 + i)) * 0.04, z1 + (z2 - z1) * along, 1, 1, 1, heading));
      });
      walkers.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < carCount; i++) {
        const lane = i % 2 ? 1 : -1;
        const run = ((time * 0.022 + i / carCount) % 1) * (SPAN + SIDE_SPAN) * 2 - SPAN - SIDE_SPAN;
        traffic.setMatrixAt(i, place(run * lane, GROUND_Y + DECK + 1.5, lane * 3.6, 1, 1));
      }
      traffic.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < birdCount; i++) {
        const a = time * 0.07 + i * 0.075;
        const r = 92 + (i % 3) * 5;
        // They follow the circle they fly, and the wings beat in short bursts between glides
        const beat = 0.35 + Math.sin(time * 7 + i * 1.7) * (Math.sin(time * 0.5 + i) > 0 ? 0.65 : 0.08);
        birds.setMatrixAt(i, place(15 + Math.cos(a) * r, GROUND_Y + 34 + (i % 4) + Math.sin(time * 0.3 + i) * 2, -60 + Math.sin(a) * r * 0.55, 1.2, beat, 1.2, -a));
      }
      birds.instanceMatrix.needsUpdate = true;
    },
    // melt runs 0 in clear air to 1 fully lost in the haze, which is what lets the campus go without a pop
    setHaze(color: Color, melt: number) {
      signMaterial.opacity = signOpacity * (1 - melt);
      [steel, shore, headland, bay, cars].forEach(({ base, haze, skin }) => {
        const amount = haze + (1 - haze) * melt;
        skin.color.copy(base).multiplyScalar(1 - amount);
        skin.emissive.copy(color).multiplyScalar(amount);
      });
    },
    // Lit windows and lamps are their own light, so the dark has to reach them too
    setDim(dim: number) {
      const light = 1 - dim;
      facade.emissiveIntensity = 0.14 * light;
      lobbyGlass.emissiveIntensity = 0.9 * light;
      signOpacity = light;
      lampMaterial.color.set("#ffe6b0").multiplyScalar(light);
      birds.visible = dim < 0.5;
    },
  };
}
