import { BoxGeometry, type BufferGeometry, CanvasTexture, Color, CylinderGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, Vector3 } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { DOOR_DIR, GROUND_Y, MARK } from "@/lib/story";

// Built in metres, front to the +x end, then drawn a size up so Axie, who stands taller than a person, fits on its roof
const SIZE = 1.35;
const WHEEL = 0.42;
// It runs across the door line between Axie's mark and the foot of the ramp: in from off screen right, stopping with its back end
// beside Axie, and away off screen left
const ROAD = 11;
const FROM = 48;
const STOP = -3.4;
const TO = -24;
const STEP = { x: -3.62, y: 0.555 };
// Where Axie rides: up on the roof rack at the back, the one spot a camera beside the road can see them
const ROOF = { x: -2.6, y: 2.42 };
// Facing the way it drives, for the jeepney and for Axie riding on the back of it
const HEADING = Math.atan2(-DOOR_DIR.x, -DOOR_DIR.z);
const FORWARD = Math.atan2(-DOOR_DIR.z, DOOR_DIR.x);

const onRoad = (along: number, across: number, y: number, out: Vector3) =>
  out.set(DOOR_DIR.x * along + DOOR_DIR.z * across, y, DOOR_DIR.z * along - DOOR_DIR.x * across);

const painted = (width: number, height: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d")!, width, height);
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 8;
  return map;
};

// Stainless steel, brightest where it faces the sky
const steel = (g: CanvasRenderingContext2D, w: number, h: number) => {
  const shine = g.createLinearGradient(0, 0, 0, h);
  shine.addColorStop(0, "#f1f3f8");
  shine.addColorStop(0.45, "#c3c8d3");
  shine.addColorStop(1, "#8e95a6");
  g.fillStyle = shine;
  g.fillRect(0, 0, w, h);
};

const lettering = (g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, edge = "#12072e") => {
  g.font = `italic 900 ${size}px sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineJoin = "round";
  g.lineWidth = size * 0.14;
  g.strokeStyle = edge;
  g.strokeText(text, x, y);
  g.fillStyle = fill;
  g.fillText(text, x, y);
};

// The long side: open windows with the dark of the cabin through them, the flag's colours sweeping under them and the name painted big.
// Laid out symmetrically, because the far side shows the same picture mirrored end to end
function sidePaint(g: CanvasRenderingContext2D, w: number, h: number) {
  steel(g, w, h);
  const [top, bottom] = [22, 150];
  g.fillStyle = "#1a1626";
  g.fillRect(16, top, w - 32, bottom - top);
  g.fillStyle = "#3e5fb0";
  g.fillRect(16, top, w - 32, 13);
  g.fillStyle = "#cdd2dc";
  for (let i = 0; i <= 8; i++) g.fillRect(16 + (i * (w - 32)) / 8 - 6, top, 12, bottom - top);
  const sweep = (color: string, y: number, phase: number, thick: number) => {
    g.strokeStyle = color;
    g.lineWidth = thick;
    g.beginPath();
    for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin((x / w) * Math.PI * 3 + phase) * 9);
    g.stroke();
  };
  sweep("#1f4fbf", 172, 0, 11);
  sweep("#f6c945", 187, 0.4, 9);
  sweep("#d7263d", 202, 0.8, 11);
  g.fillStyle = "#7c3aed";
  g.fillRect(0, h - 30, w, 12);
  lettering(g, "CNCP", w / 2, 258, 74, "#f6c945");
  lettering(g, "STA. MESA", 160, 258, 26, "#efe6ff");
  lettering(g, "ID FINDER", w - 160, 258, 26, "#efe6ff");
}

// Two panes of windscreen with the route card propped in the bottom of the glass, the way a jeepney tells you where it's going
function frontPaint(g: CanvasRenderingContext2D, w: number, h: number) {
  steel(g, w, h);
  const glass = g.createLinearGradient(0, 18, 0, 230);
  glass.addColorStop(0, "#5a6f96");
  glass.addColorStop(1, "#1d2438");
  g.fillStyle = glass;
  g.fillRect(24, 18, w / 2 - 34, 212);
  g.fillRect(w / 2 + 10, 18, w / 2 - 34, 212);
  g.fillStyle = "#fffbea";
  g.fillRect(70, 168, w - 140, 50);
  g.font = "900 38px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#d7263d";
  g.fillText("ID FINDER", w / 2, 194);
  g.fillRect(0, 262, w, 16);
  g.fillStyle = "#f6c945";
  g.fillRect(0, 282, w, 10);
}

// The back is open: a dark doorway between grab rails, with the trip's blessing over it and the tail lights low down
function rearPaint(g: CanvasRenderingContext2D, w: number, h: number) {
  steel(g, w, h);
  g.fillStyle = "#1a1626";
  g.fillRect(150, 46, w - 300, h - 46);
  g.font = "800 22px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#12072e";
  g.fillText("GOD BLESS OUR TRIP", w / 2, 24);
  g.fillStyle = "#d7263d";
  g.fillRect(28, h - 92, 84, 40);
  g.fillRect(w - 112, h - 92, 84, 40);
  g.fillStyle = "#1f4fbf";
  g.fillRect(28, 120, 84, 14);
  g.fillRect(w - 112, 120, 84, 14);
}

function grillePaint(g: CanvasRenderingContext2D, w: number, h: number) {
  steel(g, w, h);
  g.fillStyle = "#23202e";
  for (let x = 18; x < w - 18; x += 22) g.fillRect(x, 16, 10, h - 32);
}

function signPaint(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = "#12072e";
  g.fillRect(0, 0, w, h);
  g.font = "900 62px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#f6c945";
  g.fillText("ID FINDER", w / 2, h / 2 + 3);
}

// Colour baked into a part's vertices, so every painted trim piece shares one draw
const tinted = (shape: BufferGeometry, color: string) => {
  const { r, g, b } = new Color(color);
  const count = shape.attributes.position.count;
  shape.setAttribute("color", new Float32BufferAttribute(Array.from({ length: count * 3 }, (_, i) => [r, g, b][i % 3]), 3));
  return shape;
};
const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new BoxGeometry(w, h, d).translate(x, y, z);
const rod = (radius: number, height: number, x: number, y: number, z: number) => new CylinderGeometry(radius, radius, height, 8).translate(x, y, z);

// The chrome horse every jeepney carries on its hood, rearing
const horse = (z: number) => [
  new BoxGeometry(0.3, 0.1, 0.06).rotateZ(0.7).translate(3.0, 1.62, z),
  new BoxGeometry(0.06, 0.18, 0.05).rotateZ(-0.3).translate(3.13, 1.8, z),
  new BoxGeometry(0.14, 0.06, 0.05).rotateZ(-0.2).translate(3.19, 1.88, z),
  new BoxGeometry(0.04, 0.17, 0.05).translate(2.9, 1.52, z),
  new BoxGeometry(0.13, 0.04, 0.04).rotateZ(0.5).translate(3.17, 1.66, z),
  new BoxGeometry(0.22, 0.03, 0.12).translate(2.95, 1.445, z),
];

export function buildJeepney() {
  const chrome = new MeshStandardMaterial({ color: "#e6e9f0", metalness: 0.75, roughness: 0.22 });
  const sheet = (map: CanvasTexture) => new MeshStandardMaterial({ map, metalness: 0.45, roughness: 0.38 });
  const dark = new MeshStandardMaterial({ color: "#17141f", roughness: 0.85 });

  // Everything but the wheels shakes a little together: the idle a jeepney's diesel is known for
  const frame = new Group();
  const side = sheet(painted(1024, 336, sidePaint));
  const cabin = new Mesh(new BoxGeometry(4.9, 1.6, 2).translate(-0.95, 1.5, 0), [sheet(painted(512, 410, frontPaint)), sheet(painted(512, 410, rearPaint)), chrome, dark, side, side]);
  const sign = new Mesh(new PlaneGeometry(1.7, 0.3).rotateY(Math.PI / 2).translate(1.97, 2.6, 0), new MeshBasicMaterial({ map: painted(512, 96, signPaint) }));
  const grille = new Mesh(new PlaneGeometry(1, 0.56).rotateY(Math.PI / 2).translate(3.36, 1.05, 0), sheet(painted(256, 160, grillePaint)));

  const steelParts = [
    // Roof, reaching out over the windscreen, with the sign's frame on its nose
    box(5.5, 0.12, 2.12, -0.8, 2.36, 0),
    box(0.05, 0.36, 1.78, 1.94, 2.6, 0),
    // The long hood, the bumper and the back step
    box(1.85, 0.72, 1.76, 2.42, 1.07, 0),
    box(0.16, 0.2, 2.1, 3.45, 0.58, 0),
    box(0.42, 0.07, 1.3, STEP.x, STEP.y - 0.035, 0),
    // Grab rails either side of the doorway, the ladder up the back to the roof rack, side mirrors, antennas and the trim along the sides
    rod(0.025, 1.4, -3.43, 1.45, 0.5),
    rod(0.025, 1.4, -3.43, 1.45, -0.5),
    rod(0.02, 1.8, -3.44, 1.55, -0.7),
    rod(0.02, 1.8, -3.44, 1.55, -0.95),
    ...[0.95, 1.25, 1.55, 1.85, 2.15].map((y) => box(0.03, 0.03, 0.25, -3.44, y, -0.825)),
    ...[1, -1].flatMap((s) => [box(4.9, 0.04, 0.04, -1, 2.62, s * 1.0), ...[-3.3, -2.1, -0.9, 0.3, 1.4].map((x) => rod(0.02, 0.2, x, 2.52, s * 1.0))]),
    ...[1, -1].flatMap((s) => [rod(0.015, 0.4, 1.6, 1.75, s * 1.12), box(0.05, 0.22, 0.14, 1.6, 2.0, s * 1.14), rod(0.012, 1.1, 3.42, 1.2, s * 1.0), box(4.9, 0.05, 0.03, -0.95, 0.74, s * 1.01)]),
    ...horse(0.42),
    ...horse(-0.42),
  ];
  frame.add(cabin, sign, grille, new Mesh(mergeGeometries(steelParts), chrome));

  // Fenders arch over the front wheels; little flags fly off the antennas; headlights two a side
  const arch = (x: number, z: number) => new CylinderGeometry(0.56, 0.56, 0.34, 16, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(x, WHEEL + 0.03, z);
  const trim = [
    tinted(arch(2.35, 0.92), "#d7263d"),
    tinted(arch(2.35, -0.92), "#d7263d"),
    tinted(box(6.7, 0.25, 1.7, -0.05, 0.58, 0), "#17141f"),
    ...[1, -1].map((s, i) => tinted(box(0.3, 0.17, 0.02, 3.27, 1.65, s * 1.0), i ? "#1f4fbf" : "#f6c945")),
    ...[0.62, 0.82, -0.62, -0.82].map((z) => tinted(new CylinderGeometry(0.1, 0.1, 0.08, 16).rotateZ(Math.PI / 2).translate(3.38, 1.18, z), "#fff3c4")),
  ];
  frame.add(new Mesh(mergeGeometries(trim), new MeshStandardMaterial({ vertexColors: true, metalness: 0.3, roughness: 0.45 })));

  // A hub that isn't round, so the wheels are seen to turn
  const tire = new CylinderGeometry(WHEEL, WHEEL, 0.28, 24).rotateX(Math.PI / 2);
  const hub = mergeGeometries([new CylinderGeometry(0.22, 0.22, 0.3, 16).rotateX(Math.PI / 2), box(0.06, 0.18, 0.31, 0, 0.1, 0)]);
  const wheels = [[2.35, 0.92], [2.35, -0.92], [-2.2, 0.92], [-2.2, -0.92]].map(([x, z]) => {
    const wheel = new Group();
    wheel.add(new Mesh(tire, dark), new Mesh(hub, chrome));
    wheel.position.set(x, WHEEL, z);
    return wheel;
  });

  // A soft patch of shade under it, which grounds it on the plaza the way the scene's painted shadows do everything else
  const shadeMap = painted(256, 128, (g, w, h) => {
    const falloff = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    falloff.addColorStop(0, "rgb(0 0 0 / 0.55)");
    falloff.addColorStop(0.6, "rgb(0 0 0 / 0.35)");
    falloff.addColorStop(1, "rgb(0 0 0 / 0)");
    g.fillStyle = falloff;
    g.fillRect(0, 0, w, h);
  });
  const shade = new Mesh(new PlaneGeometry(8.4, 3.2).rotateX(-Math.PI / 2).translate(-0.1, 0.05, 0), new MeshBasicMaterial({ map: shadeMap, transparent: true, depthWrite: false }));

  const group = new Group();
  group.add(frame, shade, ...wheels);
  group.scale.setScalar(SIZE);
  group.rotation.y = HEADING;
  group.visible = false;

  const from = new Vector3();
  const to = new Vector3();
  const foot = new Vector3();

  return {
    group,
    // Places it for a moment of the ride, and returns where Axie's feet are once they leave their mark for it
    place(jeep: number, time: number) {
      group.visible = jeep > 0 && jeep < 3;
      if (!group.visible) return undefined;
      const across = jeep < 1 ? FROM + (STOP - FROM) * jeep : jeep < 2 ? STOP : STOP + (TO - STOP) * (jeep - 2);
      onRoad(ROAD, across, GROUND_Y, group.position);
      const rolled = (FROM - across) / (WHEEL * SIZE);
      wheels.forEach((wheel) => (wheel.rotation.z = -rolled));
      frame.position.y = Math.sin(time * 38) * 0.012;
      if (jeep <= 1) return undefined;

      // Round to the back on foot, then up the ladder in one bound to ride on the roof as it pulls away. The back end points across
      // the door line the other way from the way it drives
      const t = Math.min(1, jeep - 1);
      const behind = onRoad(ROAD, across - (STEP.x - 0.6) * SIZE, GROUND_Y, to);
      if (t < 0.6) {
        const walked = t / 0.6;
        onRoad(MARK, 0, GROUND_Y, from);
        foot.lerpVectors(from, behind, walked);
        return { foot, yaw: Math.atan2(behind.x - from.x, behind.z - from.z), stride: walked % 1 };
      }
      const hop = (t - 0.6) / 0.4;
      from.copy(behind);
      onRoad(ROAD, across - ROOF.x * SIZE, GROUND_Y + ROOF.y * SIZE, to);
      foot.lerpVectors(from, to, hop);
      foot.y += Math.sin(hop * Math.PI) * 1.2;
      return { foot, yaw: FORWARD, stride: 0 };
    },
  };
}
