import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
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

function facadeTextures() {
  const canvas = () => {
    const element = document.createElement("canvas");
    element.width = element.height = 512;
    return element;
  };
  const paint = canvas();
  const glow = canvas();
  const p = paint.getContext("2d")!;
  const g = glow.getContext("2d")!;
  p.fillStyle = "#d6d8ec";
  p.fillRect(0, 0, 512, 512);
  g.fillStyle = "#000";
  g.fillRect(0, 0, 512, 512);
  const w = 512 / WINDOWS;
  const h = 512 / FLOORS;
  for (let row = 0; row < FLOORS; row++) {
    for (let col = 0; col < WINDOWS; col++) {
      p.fillStyle = (col + row) % 3 ? "#28306f" : "#333c86";
      p.fillRect(col * w + 3, row * h + 16, w - 6, h - 30);
      if ((col * 7 + row * 13) % 5 === 0) {
        g.fillStyle = (col + row) % 2 ? "#ffd894" : "#fff0c9";
        g.fillRect(col * w + 3, row * h + 16, w - 6, h - 30);
      }
    }
  }
  const map = new CanvasTexture(paint);
  const emissiveMap = new CanvasTexture(glow);
  map.colorSpace = emissiveMap.colorSpace = SRGBColorSpace;
  map.wrapS = map.wrapT = emissiveMap.wrapS = emissiveMap.wrapT = RepeatWrapping;
  map.anisotropy = emissiveMap.anisotropy = 8;
  return { map, emissiveMap };
}

// A box whose texture repeats by real size, so every block has windows of the same scale. Roofs land on a plain bit of wall
function block(width: number, height: number, depth: number, x: number, z: number) {
  const box = new BoxGeometry(width, height, depth);
  const uv = box.attributes.uv;
  const across = [depth, depth, 0, 0, width, width];
  for (let i = 0; i < uv.count; i++) {
    const face = across[Math.floor(i / 4)];
    if (face) uv.setXY(i, (uv.getX(i) * face) / (WINDOWS * WINDOW_WIDTH), (uv.getY(i) * height) / (FLOORS * FLOOR_HEIGHT));
    else uv.setXY(i, 0.001, 0.001);
  }
  return box.translate(x, GROUND_Y + height / 2, z);
}

function signTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const c = canvas.getContext("2d")!;
  c.font = "700 190px Arial, Helvetica, sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.letterSpacing = "26px";
  c.fillStyle = "#ffffff";
  c.fillText("CISCO", 512, 132);
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  return map;
}

export function buildCampus(low: boolean) {
  const group = new Group();

  const ground = new Mesh(new CircleGeometry(420, 64).rotateX(-Math.PI / 2).translate(0, GROUND_Y, 0), new MeshStandardMaterial({ color: "#4c7d4f", roughness: 0.95 }));
  const paving = new MeshStandardMaterial({ color: "#a3a5ad", roughness: 0.85 });
  const walkway = new Mesh(new PlaneGeometry(9, -FRONT).rotateX(-Math.PI / 2).translate(-13, GROUND_Y + 0.02, FRONT / 2), paving);
  const plaza = new Mesh(new CircleGeometry(19, 48).rotateX(-Math.PI / 2).translate(0, GROUND_Y + 0.015, 0), paving);
  ground.receiveShadow = walkway.receiveShadow = plaza.receiveShadow = true;

  const facade = new MeshStandardMaterial({ ...facadeTextures(), emissive: "#ffffff", emissiveIntensity: 0.25, metalness: 0.25, roughness: 0.42 });
  const offices = new Mesh(
    mergeGeometries([
      block(WINDOW_WIDTH * 30, FLOOR_HEIGHT * 7, 16, -14, FRONT - 8),
      block(WINDOW_WIDTH * 9, FLOOR_HEIGHT * 11, 18, -52, FRONT - 10),
      block(WINDOW_WIDTH * 18, FLOOR_HEIGHT * 4, 28, 62, FRONT + 4),
      block(WINDOW_WIDTH * 14, FLOOR_HEIGHT * 4, 24, -96, FRONT + 8),
    ]),
    facade,
  );

  // The way in: a tall lit lobby under a canopy, at the far end of the walkway from the pad
  const lobbyGlass = new MeshStandardMaterial({ color: "#58478a", emissive: "#ffd894", emissiveIntensity: 0.9, metalness: 0.3, roughness: 0.2 });
  const lobby = new Mesh(new BoxGeometry(17, 9, 5).translate(-13, GROUND_Y + 4.5, FRONT + 1), lobbyGlass);
  const trim = new MeshStandardMaterial({ color: "#e9eaf6", metalness: 0.2, roughness: 0.5 });
  const canopy = new Mesh(
    mergeGeometries([
      new BoxGeometry(24, 0.5, 10).translate(-13, GROUND_Y + 9.4, FRONT + 4),
      ...[-23, -3].map((x) => new CylinderGeometry(0.22, 0.22, 9.2, 10).translate(x, GROUND_Y + 4.6, FRONT + 8)),
    ]),
    trim,
  );

  const signMaterial = new MeshBasicMaterial({ map: signTexture(), transparent: true, depthWrite: false });
  const sign = new Mesh(new PlaneGeometry(22, 5.5), signMaterial);
  sign.position.set(-4, GROUND_Y + FLOOR_HEIGHT * 7 + 1.8, FRONT);

  let seed = 41;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // Trees round the plaza and along the walkway, off the line Axie walks
  const spots: [number, number][] = [];
  for (let i = 0; i < (low ? 26 : 44); i++) {
    const a = random() * Math.PI * 2;
    const r = 30 + random() * 45;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r - 20;
    const onDoorSide = DOOR_DIR.x * x + DOOR_DIR.z * z > 0;
    if (z > FRONT + 14 && !onDoorSide && Math.abs(x + 13) > 8) spots.push([x, z]);
  }
  [-1, 1].forEach((side) => [-28, -42, -56, -70].forEach((z) => spots.push([-13 + side * 7, z])));
  const leaves = new InstancedMesh(new IcosahedronGeometry(1, 1), new MeshStandardMaterial({ color: "#2f7a45", roughness: 0.9, flatShading: true }), spots.length);
  const trunks = new InstancedMesh(new CylinderGeometry(0.16, 0.24, 1, 6), new MeshStandardMaterial({ color: "#4a3a2c", roughness: 1 }), spots.length);
  const matrix = new Matrix4();
  const still = new Quaternion();
  spots.forEach(([x, z], i) => {
    const size = 1.5 + random() * 1.5;
    const height = 2.4 + random() * 1.6;
    leaves.setMatrixAt(i, matrix.compose(new Vector3(x, GROUND_Y + height + size * 0.7, z), still, new Vector3(size, size * 1.15, size)));
    trunks.setMatrixAt(i, matrix.compose(new Vector3(x, GROUND_Y + height / 2, z), still, new Vector3(1, height, 1)));
  });

  // Lamps down both sides of the walkway
  const lampSpots = [-22, -35, -49, -63, -77].flatMap((z) => [-1, 1].map((side) => [-13 + side * 4.8, z]));
  const lampMaterial = new MeshBasicMaterial({ color: "#ffe6b0" });
  const lamps = new Mesh(mergeGeometries(lampSpots.map(([x, z]) => new SphereGeometry(0.28, 10, 8).translate(x, GROUND_Y + 3.1, z))), lampMaterial);
  const posts = new Mesh(mergeGeometries(lampSpots.map(([x, z]) => new CylinderGeometry(0.06, 0.08, 3, 6).translate(x, GROUND_Y + 1.5, z))), trim);

  group.add(ground, walkway, plaza, offices, lobby, canopy, sign, leaves, trunks, lamps, posts);

  return {
    group,
    sign,
    // Lit windows and lamps are their own light, so the dark has to reach them too
    setDim(dim: number) {
      const up = 1 - dim;
      facade.emissiveIntensity = 0.25 * up;
      lobbyGlass.emissiveIntensity = 0.9 * up;
      signMaterial.opacity = up;
      lampMaterial.color.set("#ffe6b0").multiplyScalar(up);
    },
  };
}
