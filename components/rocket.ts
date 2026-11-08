import {
  AdditiveBlending,
  AnimationMixer,
  type AnimationAction,
  type AnimationClip,
  BackSide,
  BoxGeometry,
  BufferAttribute,
  type BufferGeometry,
  CanvasTexture,
  Color,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  Quaternion,
  RepeatWrapping,
  Shape,
  ShaderMaterial,
  SphereGeometry,
  SplineCurve,
  SpotLight,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  type Bone,
  type Camera,
  type SkinnedMesh,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { DOOR_DIR, FULL_STATURE, GROUND_Y, RAMP_FOOT, SILL, statureAt, voice, WALK_CYCLES, walkPath, type SkyState } from "@/lib/story";

const SCALE = 0.8;
const CABIN_FLOOR = 1.72;
const CABIN_TOP = 3.68;
const AXIE_SIZE = 1.85;
const STRIDE = 1.45;
// How far below their own centre Axie's feet are when standing, inside the rocket's own scale
const FEET = 0.56 * AXIE_SIZE;
// Round the hull from the logo, in the gap between a front fin and the back one, so both leaves have room to slide. Just wide enough for Axie's frills
const DOOR_ANGLE = (120 * Math.PI) / 180;
const DOOR_SPAN = 1;
const DOOR_BOTTOM = -2.9;
const DOOR_TOP = 0.3;
const DOOR_WORLD = Math.atan2(DOOR_DIR.x, DOOR_DIR.z);
const HULL_PROFILE = [[0.95, -3.4], [1.45, -2.8], [1.8, -1.7], [1.92, -0.5], [1.82, 0.7], [1.55, 1.45], [1.42, 1.72]];
const YELLOW = "#ffc23f";
// Where the hatch in the cabin floor opens, wider than Axie's frills. Axie is at most 0.9 either side of the middle at cabin size
const HATCH = 1.02;
// Where Axie's mouth is on the model at rest, and how big it opens, measured from the dark of it in their texture
const MOUTH = { x: 0, y: 0.058, wide: 0.05, tall: 0.04 };

const smooth = (points: number[][], count: number) => new SplineCurve(points.map(([r, y]) => new Vector2(r, y))).getSpacedPoints(count);

// A Lathe starts its seam at phi 0, so half a turn puts the middle of the texture on +Z, the side facing the camera
const lathe = (points: Vector2[], segments = 48) => new LatheGeometry(points, segments, Math.PI);

// Takes the doorway out of a hull, so what's behind it is really behind it. The frame covers the stepped edge this leaves
function cutDoorway(hull: BufferGeometry) {
  const position = hull.attributes.position;
  const index = hull.index!;
  const kept: number[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const [a, b, c] = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    const x = (position.getX(a) + position.getX(b) + position.getX(c)) / 3;
    const y = (position.getY(a) + position.getY(b) + position.getY(c)) / 3;
    const z = (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3;
    const off = Math.atan2(Math.sin(Math.atan2(x, z) - DOOR_ANGLE), Math.cos(Math.atan2(x, z) - DOOR_ANGLE));
    if (Math.abs(off) > DOOR_SPAN / 2 || y < DOOR_BOTTOM || y > DOOR_TOP) kept.push(a, b, c);
  }
  hull.setIndex(kept);
  return hull;
}

// A colour baked into a shape, so a roomful of props is one draw call
const tinted = (shape: BufferGeometry, color: string) => {
  const piece = shape.index ? shape.toNonIndexed() : shape;
  piece.deleteAttribute("uv");
  const base = new Color(color);
  const colors = new Float32Array(piece.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) colors.set([base.r, base.g, base.b], i);
  return piece.setAttribute("color", new BufferAttribute(colors, 3));
};

const canvas2d = (width: number, height: number) => {
  const element = document.createElement("canvas");
  element.width = width;
  element.height = height;
  return { element, c: element.getContext("2d")! };
};

const texture = (element: HTMLCanvasElement) => {
  const map = new CanvasTexture(element);
  map.colorSpace = SRGBColorSpace;
  return map;
};

// On a wall at this angle round the hull, a little in from it and turned to face the middle of the room
const onWall = (piece: BufferGeometry, angle: number, radius: number, y: number) => piece.rotateY(angle).translate(Math.sin(angle) * radius, y, Math.cos(angle) * radius);

// The bay behind the door: where Axie walks in and the lift starts. It glows the door's yellow, so from outside it still reads as light from within
function buildBay() {
  const { element, c } = canvas2d(512, 512);
  const wash = c.createLinearGradient(0, 0, 0, 512);
  wash.addColorStop(0, "#ffe8ad");
  wash.addColorStop(0.55, "#ffd070");
  wash.addColorStop(1, "#e9a93c");
  c.fillStyle = wash;
  c.fillRect(0, 0, 512, 512);
  // Wall panels and the ribs between them, with a band of status lights at eye height and the org's violet along the floor
  c.fillStyle = "rgb(120 72 20 / 0.28)";
  for (let x = 0; x < 512; x += 32) c.fillRect(x, 0, 3, 512);
  for (let y = 40; y < 512; y += 92) c.fillRect(0, y, 512, 3);
  c.fillStyle = "#3a1d8c";
  c.fillRect(0, 462, 512, 50);
  c.fillStyle = "#fff6dc";
  c.fillRect(0, 150, 512, 10);
  ["#7c3aed", "#2dd4bf", "#ff5a66", "#7c3aed", "#2dd4bf"].forEach((color, i) => {
    c.fillStyle = color;
    for (let x = i * 96 + 12; x < 512; x += 480) c.fillRect(x, 280, 18, 9);
  });
  const skin = texture(element);
  skin.wrapS = RepeatWrapping;
  skin.repeat.x = 3;
  const inside = smooth(HULL_PROFILE, 48).filter(({ y }) => y > DOOR_BOTTOM - 0.05 && y < CABIN_FLOOR).map(({ x, y }) => new Vector2(x * 0.955, y));
  const fittings = mergeGeometries([
    // Grated deck, and ribs up the wall
    tinted(new CylinderGeometry(1.45, 1.45, 0.08, 40).translate(0, DOOR_BOTTOM - 0.04, 0), "#3b2a78"),
    ...[-2.1, -1, 0.1].map((y, i) => tinted(new TorusGeometry([1.5, 1.72, 1.72][i], 0.04, 6, 40).rotateX(Math.PI / 2).translate(0, y, 0), "#7a4a12")),
    // The threshold out to the ramp, under the door
    tinted(onWall(new BoxGeometry(1.5, 0.08, 0.9), DOOR_ANGLE, 1.3, DOOR_BOTTOM - 0.04), "#2b1a66"),
    // The lift's rails, either side of it, away from the door
    ...[DOOR_ANGLE + 2.2, DOOR_ANGLE - 2.2].map((a) => tinted(onWall(new BoxGeometry(0.1, CABIN_FLOOR - DOOR_BOTTOM, 0.1), a, 1.12, (CABIN_FLOOR + DOOR_BOTTOM) / 2), "#3b2a78")),
    // Lockers on the back wall, facing the door
    ...[-0.7, 0, 0.7].map((off) => tinted(onWall(new BoxGeometry(0.5, 1.1, 0.14), DOOR_ANGLE + Math.PI + off, 1.42, DOOR_BOTTOM + 0.75), "#fff3d2")),
  ]);
  const bay = new Group();
  bay.add(new Mesh(new LatheGeometry(inside, 40), new MeshBasicMaterial({ map: skin, side: BackSide, fog: false })), new Mesh(fittings, new MeshBasicMaterial({ vertexColors: true, fog: false })));
  return bay;
}

// The cockpit behind the glass. A wall of screens curves round the back, away from both places the rocket gets seen from, parked or in flight, so the front stays clear to see in.
// All its own light, because a lit room is what makes it read through glass, and all one material so the dark can take it in one go
function buildCabin(profile: Vector2[]) {
  const { element, c } = canvas2d(1024, 256);
  c.fillStyle = "#1b1050";
  c.fillRect(0, 0, 1024, 256);
  c.fillStyle = "#2a1a70";
  for (let x = 0; x < 1024; x += 128) c.fillRect(x + 4, 8, 120, 240);
  // Screens with a sky chart and a flight plot on them
  [[60, 90, "#2dd4bf"], [320, 60, "#a9b4ff"], [600, 60, "#c084fc"], [860, 90, "#2dd4bf"]].forEach(([x, y, tint]) => {
    c.fillStyle = "#07122e";
    c.fillRect(x as number, y as number, 150, 96);
    c.strokeStyle = c.fillStyle = tint as string;
    c.lineWidth = 2;
    c.strokeRect((x as number) + 2, (y as number) + 2, 146, 92);
    c.beginPath();
    for (let i = 0; i <= 12; i++) c.lineTo((x as number) + 10 + i * 10.8, (y as number) + 48 + Math.sin(i * 1.3 + (x as number)) * 22);
    c.stroke();
  });
  // A strip of indicator lights along the bottom
  ["#ff5a66", "#ffd34d", "#2dd4bf", "#a9b4ff"].forEach((tint, i) => {
    c.fillStyle = tint;
    for (let x = 30 + i * 28; x < 1024; x += 112) c.fillRect(x, 214, 14, 8);
  });
  const skin = new MeshBasicMaterial({ map: texture(element), side: BackSide, fog: false });
  const wall = new Mesh(new LatheGeometry(profile.map(({ x, y }) => new Vector2(x * 0.97, y)), 28, (140 * Math.PI) / 180, (200 * Math.PI) / 180), skin);

  // Console and seat stand clear of the 0.9 Axie takes up either side of the middle at frill height, and the 0.6 low down
  const front = (60 * Math.PI) / 180;
  const back = (240 * Math.PI) / 180;
  const y = CABIN_FLOOR;
  const props = [
    ...[-1.05, -0.52, 0, 0.52, 1.05].flatMap((off, i) => [
      tinted(onWall(new BoxGeometry(0.56, 0.42, 0.3), front + off, 1.2, y + 0.21), "#21134f"),
      tinted(onWall(new BoxGeometry(0.46, 0.02, 0.2).rotateX(0.5), front + off, 1.18, y + 0.45), ["#2dd4bf", "#a9b4ff", "#c084fc", "#a9b4ff", "#2dd4bf"][i]),
    ]),
    // A seat for between planets, with Axie standing just in front of it
    tinted(onWall(new BoxGeometry(0.9, 1, 0.14), back, 1.14, y + 0.72), "#5a3fd0"),
    tinted(onWall(new BoxGeometry(0.46, 0.3, 0.12), back, 1.12, y + 1.38), "#7c5cf0"),
    tinted(onWall(new BoxGeometry(0.84, 0.14, 0.34), back, 0.98, y + 0.34), "#4a2fb4"),
    // Pipes up the walls, the ceiling and its ring of light
    ...[(150 * Math.PI) / 180, (330 * Math.PI) / 180].map((a) => tinted(onWall(new CylinderGeometry(0.05, 0.05, 1.5, 8), a, 1.3, y + 0.8), "#a9b4ff")),
    tinted(new CircleGeometry(1.09, 32).rotateX(Math.PI / 2).translate(0, CABIN_TOP, 0), "#120a38"),
    tinted(new TorusGeometry(0.72, 0.035, 8, 40).rotateX(Math.PI / 2).translate(0, CABIN_TOP - 0.05, 0), "#fff1e0"),
    // The deck, as a ring round the hatch
    tinted(new LatheGeometry([new Vector2(HATCH, CABIN_FLOOR - 0.06), new Vector2(1.4, CABIN_FLOOR - 0.06), new Vector2(1.4, CABIN_FLOOR + 0.03), new Vector2(HATCH, CABIN_FLOOR + 0.03), new Vector2(HATCH, CABIN_FLOOR - 0.06)], 40), "#2e1c6e"),
  ];
  const fittings = new MeshBasicMaterial({ vertexColors: true, fog: false, side: DoubleSide });
  const room = new Group();
  room.add(wall, new Mesh(mergeGeometries(props), fittings));
  return { room, materials: [skin, fittings] };
}

// The disc Axie rides up on. Flush with the deck at the top it closes the hatch, and at the bottom it's part of the bay's floor
function buildLiftDeck() {
  const { element, c } = canvas2d(128, 128);
  c.fillStyle = "#3b2a8c";
  c.fillRect(0, 0, 128, 128);
  c.strokeStyle = "#ffc23f";
  c.lineWidth = 7;
  c.setLineDash([12, 9]);
  c.beginPath();
  c.arc(64, 64, 58, 0, Math.PI * 2);
  c.stroke();
  return new Mesh(new CircleGeometry(HATCH - 0.01, 40).rotateX(-Math.PI / 2), new MeshBasicMaterial({ map: texture(element), fog: false }));
}

// Paint for the hull, and the same logo on black for the emissive map, so it glows like the neon it is
function hullTextures() {
  const canvas = () => {
    const element = document.createElement("canvas");
    element.width = 2048;
    element.height = 1024;
    return element;
  };
  const paint = canvas();
  const c = paint.getContext("2d")!;
  c.scale(2, 2);
  c.fillStyle = "#5a3fd0";
  c.fillRect(0, 0, 1024, 512);
  c.fillStyle = "#2f1275";
  c.fillRect(0, 400, 1024, 112);
  c.fillStyle = "#c084fc";
  c.fillRect(0, 386, 1024, 14);
  c.fillRect(0, 60, 1024, 8);
  // Plates with a line of rivets along each seam, so it reads as something built. All under the logo, which goes on last
  c.fillStyle = "rgb(24 10 80 / 0.42)";
  for (let x = 0; x < 1024; x += 64) c.fillRect(x, 68, 1.5, 318);
  for (let y = 134; y < 386; y += 84) c.fillRect(0, y, 1024, 1.5);
  c.fillStyle = "rgb(214 200 255 / 0.5)";
  for (let y = 134; y < 386; y += 84) for (let x = 8; x < 1024; x += 16) c.fillRect(x, y + 4, 2, 2);
  // Hazard marks round the base, above the dark band
  c.fillStyle = "#ffc23f";
  for (let x = 0; x < 1024; x += 42) c.fillRect(x, 372, 20, 9);
  const glow = canvas();
  const g = glow.getContext("2d")!;
  g.scale(2, 2);
  g.fillStyle = "#000";
  g.fillRect(0, 0, 1024, 512);

  const map = new CanvasTexture(paint);
  const emissiveMap = new CanvasTexture(glow);
  map.colorSpace = emissiveMap.colorSpace = SRGBColorSpace;
  map.anisotropy = emissiveMap.anisotropy = 8;
  const logo = new Image();
  logo.src = "/cncp-decal.webp";
  logo
    .decode()
    .then(() => {
      // The hull's texture is a little denser going up than around, hence taller than the image's own ratio
      [c, g].forEach((context) => context.drawImage(logo, 342, 86, 340, 284));
      map.needsUpdate = emissiveMap.needsUpdate = true;
    })
    .catch((error) => console.error(error));
  return { map, emissiveMap };
}

// The door lies on the hull's own curve, a hair proud of it, and both leaves slide round the hull to open. The frame stands proud of the leaves, which run under it
function buildDoor() {
  const hullCurve = (grow: number, from = DOOR_BOTTOM, to = DOOR_TOP) => smooth(HULL_PROFILE, 64).filter(({ y }) => y > from && y < to).map(({ x, y }) => new Vector2(x * grow, y));
  const paint = new MeshStandardMaterial({ color: "#4a2fb4", metalness: 0.5, roughness: 0.4 });
  // Taller than the opening and lapping over each other in the middle, or the sky shows through the cracks
  const leaves = [DOOR_ANGLE - DOOR_SPAN / 2 - 0.02, DOOR_ANGLE - 0.015].map((from, i) => new Mesh(new LatheGeometry(hullCurve(i ? 1.03 : 1.024, DOOR_BOTTOM - 0.14, DOOR_TOP + 0.14), 8, from, DOOR_SPAN / 2 + 0.035), paint));
  const edge = 0.07;
  const frame = new Mesh(
    mergeGeometries([
      new LatheGeometry(hullCurve(1.04, DOOR_BOTTOM - 0.16, DOOR_TOP + 0.16), 3, DOOR_ANGLE - DOOR_SPAN / 2 - edge * 0.7, edge),
      new LatheGeometry(hullCurve(1.04, DOOR_BOTTOM - 0.16, DOOR_TOP + 0.16), 3, DOOR_ANGLE + DOOR_SPAN / 2 - edge * 0.3, edge),
      new LatheGeometry(hullCurve(1.04, DOOR_TOP - 0.02, DOOR_TOP + 0.16), 16, DOOR_ANGLE - DOOR_SPAN / 2, DOOR_SPAN),
      new LatheGeometry(hullCurve(1.04, DOOR_BOTTOM - 0.16, DOOR_BOTTOM + 0.02), 16, DOOR_ANGLE - DOOR_SPAN / 2, DOOR_SPAN),
    ]),
    new MeshStandardMaterial({ color: "#241052", metalness: 0.8, roughness: 0.35 }),
  );
  return { frame, leaves };
}

function buildCraft() {
  const chrome = new MeshStandardMaterial({ color: "#dfe3ff", metalness: 0.95, roughness: 0.22 });
  const dark = new MeshStandardMaterial({ color: "#1c0e45", metalness: 0.75, roughness: 0.45 });
  const orchid = new MeshStandardMaterial({ color: "#b56cf5", metalness: 0.45, roughness: 0.32 });

  const hull = new Mesh(
    cutDoorway(lathe(smooth(HULL_PROFILE, 64), 96)),
    new MeshStandardMaterial({ ...hullTextures(), emissive: "#ffffff", emissiveIntensity: 1.1, metalness: 0.45, roughness: 0.36 }),
  );
  const nose = new Mesh(lathe(smooth([[1.06, 3.72], [0.92, 4.3], [0.58, 5], [0.08, 5.65], [0, 5.72]], 28)), chrome);
  const trim = new Mesh(
    mergeGeometries([
      new TorusGeometry(1.45, 0.1, 10, 48).rotateX(Math.PI / 2).translate(0, 1.72, 0),
      new TorusGeometry(1.08, 0.08, 10, 48).rotateX(Math.PI / 2).translate(0, 3.72, 0),
      new TorusGeometry(1.0, 0.07, 10, 48).rotateX(Math.PI / 2).translate(0, -3.4, 0),
      new SphereGeometry(0.11, 12, 10).translate(0, 5.75, 0),
      ...[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + Math.PI;
        return new CylinderGeometry(0.035, 0.035, 2, 6).translate(Math.sin(a) * 1.33, 2.72, Math.cos(a) * 1.33);
      }),
    ]),
    chrome,
  );
  const nozzle = new Mesh(lathe(smooth([[0.55, -3.4], [0.72, -3.8], [1.02, -4.2]], 10)), new MeshStandardMaterial({ color: "#2a1a70", metalness: 0.9, roughness: 0.35, side: DoubleSide }));

  const finShape = new Shape();
  finShape.moveTo(0, 0);
  finShape.bezierCurveTo(0.7, -0.15, 1.5, -1.1, 1.6, -3.3);
  finShape.bezierCurveTo(1.2, -2.8, 0.6, -2.4, 0, -2.3);
  finShape.closePath();
  const finBase = new ExtrudeGeometry(finShape, { depth: 0.14, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2, curveSegments: 10 }).translate(1.45, -0.9, -0.07);
  // Front-left, front-right and back: nothing covers the logo, which always faces the camera
  const fins = new Mesh(mergeGeometries([60, 180, 300].map((d) => finBase.clone().rotateY(((d - 90) * Math.PI) / 180))), orchid);

  const cabinProfile = smooth([[1.42, 1.72], [1.46, 2.3], [1.38, 3.1], [1.06, 3.72]], 20);
  const cabinBack = new Mesh(lathe(cabinProfile), new MeshBasicMaterial({ color: "#12072e", transparent: true, opacity: 0.55, side: BackSide, depthWrite: false }));
  const cabin = buildCabin(cabinProfile);
  const bay = buildBay();
  const liftDeck = buildLiftDeck();
  // Round portholes high on the back of the hull, lit from inside like everything else in here
  const porthole = (angle: number, y: number): [BufferGeometry, BufferGeometry] => [
    onWall(new TorusGeometry(0.2, 0.045, 8, 24), angle, 1.86, y),
    onWall(new CircleGeometry(0.19, 20), angle, 1.875, y),
  ];
  const portholes = [porthole(-1.75, -0.3), porthole(-2.45, -0.3), porthole(-1.75, -1.1), porthole(-2.45, -1.1)];
  const portholeRims = new Mesh(mergeGeometries(portholes.map(([rim]) => rim)), dark);
  const portholeGlass = new Mesh(mergeGeometries(portholes.map(([, pane]) => pane)), new MeshBasicMaterial({ color: "#ffe6a8", fog: false }));
  const glass = new Mesh(
    lathe(cabinProfile),
    new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: "varying vec3 vN,vV;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalMatrix*normal;vV=-mv.xyz;gl_Position=projectionMatrix*mv;}",
      fragmentShader: /* glsl */ `
        varying vec3 vN,vV;
        void main(){
          vec3 n=normalize(vN),v=normalize(vV);
          float rim=pow(1.-max(dot(n,v),0.),2.6);
          float glint=pow(max(dot(n,normalize(vec3(-.55,.6,.6))),0.),60.);
          gl_FragColor=vec4(vec3(.66,.72,1.)*rim*.8+vec3(1.)*glint*.85,1.);
        }`,
    }),
  );
  glass.renderOrder = 2;

  // The lift that carries Axie up from the door: a shaft of the door's yellow, rising through the open hatch in the cabin floor
  const liftBeam = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    uniforms: { uGlow: { value: 0 } },
    vertexShader: "varying float vUp;void main(){vUp=uv.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: "uniform float uGlow;varying float vUp;void main(){gl_FragColor=vec4(vec3(1.,.72,.2)*pow(vUp,1.6)*uGlow*.75,1.);}",
  });
  const lift = new Group();
  lift.add(new Mesh(new CylinderGeometry(HATCH - 0.02, HATCH - 0.02, 1.9, 28, 1, true).translate(0, CABIN_FLOOR + 0.95, 0), liftBeam));

  const flameMaterial = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    uniforms: { uTime: { value: 0 }, uPower: { value: 0 } },
    vertexShader: /* glsl */ `
      uniform float uTime; varying float vT; varying vec3 vN,vV;
      void main(){
        // A cone's v runs to 1 at its tip, and the flame is hottest at the other end, against the nozzle
        vec3 p=position; vT=1.-uv.y;
        p.xz*=1.+sin(uTime*34.+vT*14.)*.08*(1.-vT);
        vec4 mv=modelViewMatrix*vec4(p,1.);
        vN=normalMatrix*normal; vV=-mv.xyz;
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uPower; varying float vT; varying vec3 vN,vV;
      void main(){
        float edge=pow(abs(dot(normalize(vN),normalize(vV))),1.4);
        vec3 c=mix(vec3(.46,.2,.95),vec3(.78,.72,1.),smoothstep(.15,.7,vT));
        c=mix(c,vec3(1.),smoothstep(.72,1.,vT)*edge);
        gl_FragColor=vec4(c*edge*vT*vT*min(uPower*1.6,1.)*1.5,1.);
      }`,
  });
  // Tip down, with its wide end at the nozzle
  const flame = new Mesh(new ConeGeometry(0.95, 7, 22, 8, true).rotateX(Math.PI).translate(0, -3.5, 0), flameMaterial);
  flame.position.y = -3.95;
  flame.renderOrder = 1;

  const cabinLight = new PointLight("#ffe6f5", 5, 5);
  cabinLight.position.set(0, 3.1, 0.6);

  const group = new Group();
  group.scale.setScalar(SCALE);
  const door = buildDoor();
  group.add(hull, nose, trim, nozzle, fins, cabinBack, cabin.room, bay, liftDeck, portholeRims, portholeGlass, lift, glass, flame, cabinLight, door.frame, ...door.leaves);
  return { group, flame, flameMaterial, hull, cabinBack, cabin, bay, liftDeck, portholeGlass, glass, cabinLight, door, lift, liftBeam };
}

export function createRocket(low: boolean, onAxie: (axie: Group, clip: AnimationClip) => void) {
  const { group, flame, flameMaterial, hull, cabinBack, cabin, bay, liftDeck, portholeGlass, glass, cabinLight, door, lift, liftBeam } = buildCraft();
  const hullPaint = hull.material as MeshStandardMaterial;
  const portholePaint = portholeGlass.material as MeshBasicMaterial;
  // How far Axie is talking, and how open their mouth is this instant. Worked out here and read by the shader, so a whole conversation costs one uniform
  const talk = { value: new Vector2() };
  let speaking = 0;

  // What stays put on the ground however the rocket turns: the ramp, the door's light and its glow
  const yard = new Group();
  const rampFall = SILL.y - GROUND_Y;
  const rampRun = RAMP_FOOT - SILL.along;
  const rampLength = Math.hypot(rampFall, rampRun);
  const ramp = new Mesh(new BoxGeometry(1.7, 0.1, rampLength).translate(0, 0, rampLength / 2), new MeshStandardMaterial({ color: "#5a5580", metalness: 0.4, roughness: 0.6 }));
  ramp.position.set(DOOR_DIR.x * SILL.along, SILL.y - 0.05, DOOR_DIR.z * SILL.along);
  ramp.rotation.set(Math.atan2(rampFall, rampRun), DOOR_WORLD, 0, "YXZ");
  ramp.receiveShadow = true;

  // A real shadow rather than a faked one: in the dark this is the only light there is, and it comes from behind Axie
  const doorLight = new SpotLight(YELLOW, 0, 70, 0.5, 0.5, 1.1);
  // Well back through the hull, which casts nothing: from close behind, Axie's shadow would swallow the whole beam as they step out
  doorLight.position.set(DOOR_DIR.x * -4, 2.2, DOOR_DIR.z * -4);
  doorLight.target.position.set(DOOR_DIR.x * 7, GROUND_Y, DOOR_DIR.z * 7);
  doorLight.castShadow = true;
  doorLight.shadow.mapSize.set(1024, 1024);
  doorLight.shadow.camera.near = 0.3;
  doorLight.shadow.camera.far = 40;
  doorLight.shadow.bias = -0.002;
  // Only redrawn while Axie is out in it
  doorLight.shadow.autoUpdate = false;

  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 128;
  const glowPaint = glowCanvas.getContext("2d")!;
  const falloff = glowPaint.createRadialGradient(64, 64, 0, 64, 64, 64);
  falloff.addColorStop(0, "rgb(255 170 40 / 0.4)");
  falloff.addColorStop(0.35, "rgb(255 180 50 / 0.2)");
  falloff.addColorStop(1, "rgb(255 170 40 / 0)");
  glowPaint.fillStyle = falloff;
  glowPaint.fillRect(0, 0, 128, 128);
  const glowMap = new CanvasTexture(glowCanvas);
  glowMap.colorSpace = SRGBColorSpace;
  const haloMaterial = new SpriteMaterial({ map: glowMap, blending: AdditiveBlending, transparent: true, depthWrite: false, fog: false });
  const halo = new Sprite(haloMaterial);
  // Clear of the hull's widest point: a sprite is a flat plane, and where the hull pokes through it the glow cuts off in a hard curve
  halo.position.set(DOOR_DIR.x * 2.6, 0.2, DOOR_DIR.z * 2.6);
  halo.scale.set(7.5, 7.5, 1);
  yard.add(ramp, doorLight, doorLight.target, halo);

  const parked = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), DOOR_WORLD - DOOR_ANGLE);
  const axieMaterials: MeshStandardMaterial[] = [];
  const axieMeshes: SkinnedMesh[] = [];
  let clipLength = 1;
  let mixer: AnimationMixer | undefined;
  let walk: AnimationAction | undefined;
  let armRoot: Bone | undefined;
  let forearm: Bone | undefined;
  const pilot = new Group();
  group.add(pilot);
  let lost = false;

  // Ships separately because Axie is by far the heaviest asset; the rocket flies on until it lands. Up close on a big screen the
  // lighter copy's textures go soft, so only smaller screens get it
  new GLTFLoader()
    .loadAsync(low ? "/axie-flight.glb" : "/axie-new.glb")
    .then((gltf) => {
      if (lost) return;
      const axie = gltf.scene;
      axie.traverse((node) => {
        const skinned = node as SkinnedMesh;
        if (!skinned.isSkinnedMesh) return;
        skinned.frustumCulled = false;
        skinned.castShadow = true;
        axieMeshes.push(skinned);
        const material = skinned.material as MeshStandardMaterial;
        axieMaterials.push(material);
        if (material.map) material.map.anisotropy = 8;
        material.metalness = 0.05;
        material.roughness = 0.65;
        // Keeps the character readable through the glass in the darker chapters
        material.emissive.set("#ffffff");
        material.emissiveMap = material.map;
        material.emissiveIntensity = 0.3;
        // The model has no jaw or face shapes, and its texture is scattered over the atlas, so the mouth is drawn on by where it is on the model at rest. That
        // sticks to the head however it moves. It paints the printed mouth over with skin, then opens a new one in the same spot
        material.onBeforeCompile = (shader) => {
          shader.uniforms.uTalk = talk;
          shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nvarying vec3 vRest;")
            .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRest=position;");
          shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", "#include <common>\nuniform vec2 uTalk;varying vec3 vRest;")
            .replace(
              "#include <map_fragment>",
              /* glsl */ `#include <map_fragment>
              vec2 lips=(vRest.xy-vec2(${MOUTH.x.toFixed(3)},${MOUTH.y.toFixed(3)}))/vec2(${MOUTH.wide.toFixed(3)},${MOUTH.tall.toFixed(3)});
              float front=step(.1,vRest.z)*uTalk.x;
              float cover=smoothstep(1.75,1.25,length(lips))*front;
              float open=mix(.1,1.,uTalk.y);
              float maw=smoothstep(1.,.82,length(lips/vec2(mix(.8,1.,uTalk.y),open)))*front;
              vec3 inside=mix(vec3(.05,.006,.02),vec3(.72,.16,.24),smoothstep(-.1,-.75,lips.y/open));
              diffuseColor.rgb=mix(mix(diffuseColor.rgb,vec3(.9,.31,.45),cover),inside,maw);`,
            )
            // The printed mouth is also in the model's normal and shine maps, and would still catch the light through the paint
            .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.5,cover);")
            .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor=mix(metalnessFactor,0.,cover);")
            .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\nnormal=normalize(mix(normal,nonPerturbedNormal,cover));")
            .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance=mix(totalEmissiveRadiance,emissive*diffuseColor.rgb,max(cover,maw));");
        };
        material.customProgramCacheKey = () => "axie-mouth";
      });
      axie.scale.setScalar(AXIE_SIZE);
      pilot.add(axie);
      // The rig's names run one joint out on this side: L_Collar is the arm's root and L_Shoulder its elbow
      armRoot = axie.getObjectByName("L_Collar") as Bone | undefined;
      forearm = axie.getObjectByName("L_Shoulder") as Bone | undefined;
      if (armRoot && forearm) {
        armPose.copy(armRoot.quaternion);
        forearmPose.copy(forearm.quaternion);
      }

      // The clip walks forward by moving the pelvis, which would march Axie out through the glass
      const clip = gltf.animations[0];
      clipLength = clip.duration;
      clip.tracks = clip.tracks.filter((track) => !track.name.endsWith(".position"));
      // Longer strides: the legs swing further either side of where they hang, so each step covers the ground it now has to
      clip.tracks.filter((track) => /[LR]_(Hip|Knee)\.quaternion$/.test(track.name)).forEach(({ values }) => {
        const hang = new Quaternion();
        for (let i = 0; i < values.length; i += 4) hang.set(hang.x + values[i], hang.y + values[i + 1], hang.z + values[i + 2], hang.w + values[i + 3]);
        hang.normalize();
        const key = new Quaternion();
        const swing = new Quaternion();
        for (let i = 0; i < values.length; i += 4) {
          key.fromArray(values, i);
          swing.copy(hang).invert().multiply(key);
          const half = Math.acos(Math.min(1, Math.abs(swing.w)));
          const stretch = half > 1e-4 ? Math.sin(half * STRIDE) / Math.sin(half) : 1;
          swing.set(swing.x * stretch, swing.y * stretch, swing.z * stretch, Math.sign(swing.w || 1) * Math.cos(half * STRIDE)).normalize();
          key.copy(hang).multiply(swing).toArray(values, i);
        }
      });
      mixer = new AnimationMixer(axie);
      walk = mixer.clipAction(clip);
      walk.play();
      onAxie(axie, clip);
    })
    .catch((error) => console.error(error));

  const nose = new Vector3();
  const facing = new Vector3();
  const across = new Vector3();
  const basis = new Matrix4();
  const bend = new Quaternion();
  const bendAxis = new Vector3(0, 0, 1);
  // From where the arm hangs, up and in front of the cheek: at this reach, straight up or out to the side ends behind the head
  const raised = new Quaternion().setFromUnitVectors(new Vector3(0.4, -0.23, -0.11).normalize(), new Vector3(0.28, 0.12, 0.3).normalize());
  const armPose = new Quaternion();
  const forearmPose = new Quaternion();
  const worldUp = new Vector3(0, 1, 0);
  const seat = new Vector3(0, CABIN_FLOOR + FEET, 0);
  // On the lift at the bottom of the bay, right where their walk in ends
  const liftFoot = new Vector3(0, DOOR_BOTTOM + FEET, 0);
  const onFoot = new Vector3();
  const upright = new Quaternion();
  const toCamera = new Quaternion();
  let roll = 0;
  let yaw = DOOR_WORLD;
  let lastOut = 1;
  let headingOut = false;

  return {
    group,
    yard,
    // The hull's +Z side turns to the camera, so the cabin and logo are never hidden on the way past. Parked, it holds still instead
    place(position: Vector3, heading: Vector3, camera: Camera, ground: number) {
      group.position.copy(position);
      nose.copy(heading).normalize();
      facing.copy(camera.position).sub(position);
      facing.addScaledVector(nose, -facing.dot(nose));
      // Flying straight at or away from the camera there is no sideways to face, so keep the last one
      if (facing.lengthSq() > 1e-4) {
        facing.normalize();
        across.crossVectors(nose, facing);
        basis.makeBasis(across, nose, facing);
        group.quaternion.setFromRotationMatrix(basis);
        // The ship tips over in flight but its pilot stays head-up, so the face always reads
        roll = Math.atan2(-worldUp.dot(across), worldUp.dot(nose));
      }
      group.quaternion.slerp(parked, ground);
    },
    // `ride` takes over from the walk while Axie goes off on the jeepney: where their feet are, which way they face and how far through a stride
    animate(time: number, dt: number, power: number, { wave, out, door: open, dim, climb, ground }: SkyState, camera: Camera, ride?: { foot: Vector3; yaw: number; stride: number }) {
      flameMaterial.uniforms.uTime.value = time;
      flameMaterial.uniforms.uPower.value = power;
      flame.visible = power > 0.01;
      flame.scale.set(0.7 + power * 0.3, 0.25 + power * 0.95, 0.7 + power * 0.3);
      const light = 1 - dim;
      hullPaint.emissiveIntensity = 1.1 * light;
      cabinLight.intensity = 5 * light;
      glass.visible = cabinBack.visible = cabin.room.visible = dim < 0.5;
      cabin.materials.forEach((material) => material.color.setScalar(light));
      portholePaint.color.set("#ffe6a8").multiplyScalar(light);
      axieMaterials.forEach((material) => (material.emissiveIntensity = 0.3 * light));
      // A beat of syllables that never quite repeats, closing between words, and it eases off rather than snapping shut
      speaking += ((voice.talking ? 1 : 0) - speaking) * (1 - Math.exp(-dt * 12));
      talk.value.set(speaking, Math.max(0, Math.sin(time * 13) * (0.65 + Math.sin(time * 4.3) * 0.35)));

      door.leaves[0].rotation.y = -open * (DOOR_SPAN / 2);
      door.leaves[1].rotation.y = open * (DOOR_SPAN / 2);
      bay.visible = yard.visible = open > 0.005;
      ramp.scale.z = Math.max(open, 0.01);
      doorLight.intensity = open * 150;
      haloMaterial.opacity = open;

      // Out, Axie's feet are placed on the ground however the rocket is turned, and they face the way they are walking, or the
      // camera once on their mark. Past the door they are out of sight in the hull until the lift brings them up into the cabin
      const outside = out > 0.004;
      if (outside) {
        const { along, y } = walkPath(out);
        const stature = ride ? FULL_STATURE : statureAt(along);
        if (ride) onFoot.copy(ride.foot);
        else onFoot.set(DOOR_DIR.x * along, y, DOOR_DIR.z * along);
        onFoot.y += FEET * SCALE * stature;
        const moved = out - lastOut;
        let want = yaw;
        if (ride) want = ride.yaw;
        else if (out > 0.985) want = Math.atan2(camera.position.x - onFoot.x, camera.position.z - onFoot.z);
        else if (Math.abs(moved) > 1e-5) want = moved > 0 ? DOOR_WORLD : DOOR_WORLD + Math.PI;
        if (Math.abs(moved) > 1e-5) headingOut = moved > 0;
        yaw += Math.atan2(Math.sin(want - yaw), Math.cos(want - yaw)) * (1 - Math.exp(-dt * 6));
        group.updateMatrixWorld();
        pilot.position.copy(group.worldToLocal(onFoot));
        pilot.quaternion.copy(group.quaternion).invert().multiply(upright.setFromAxisAngle(worldUp, yaw));
        pilot.scale.setScalar(stature);
      } else {
        pilot.position.lerpVectors(liftFoot, seat, climb);
        pilot.scale.setScalar(1);
        // Parked the rocket holds still, so they turn themselves to the camera, but not until the door has shut on the turn. In flight the hull does that for them
        upright.setFromAxisAngle(worldUp, open > 0.02 ? yaw : Math.atan2(camera.position.x - group.position.x, camera.position.z - group.position.z));
        toCamera.copy(group.quaternion).invert().multiply(upright);
        pilot.quaternion.setFromAxisAngle(bendAxis, roll).slerp(toCamera, ground);
      }
      const riding = outside || climb <= 0 || climb >= 1 ? 0 : Math.sin(climb * Math.PI);
      lift.visible = riding > 0;
      liftBeam.uniforms.uGlow.value = riding;
      // Under Axie's feet the whole way up, then flush in the deck
      liftDeck.position.y = climb >= 1 ? CABIN_FLOOR + 0.035 : Math.min(CABIN_FLOOR + 0.035, DOOR_BOTTOM + 0.01 + (CABIN_FLOOR - DOOR_BOTTOM) * (outside ? 0 : climb));
      liftDeck.visible = climb > 0.001 || open > 0.005;
      lastOut = out;
      // Standing in the bay Axie would block the whole beam, so they only start to cast a shadow once they're out of the door
      axieMeshes.forEach((mesh) => (mesh.castShadow = outside && walkPath(out).along > SILL.along));
      doorLight.shadow.needsUpdate = open > 0.005;
      if (!mixer || !armRoot || !forearm) return;
      // A mixer only writes a bone when its value changes, so last frame's wave has to be taken off first or it stacks up
      armRoot.quaternion.copy(armPose);
      forearm.quaternion.copy(forearmPose);
      // The stride is tied to distance, so feet don't slide and each journey ends on the clip's standing first frame. Stepping out runs the same count from the other end, or the
      // legs would play backward while Axie walks forward. On the lift and in flight they stand still, because walking in the cabin puts their feet through its floor and console
      if (walk) walk.time = ride ? ride.stride * clipLength : outside ? ((headingOut ? out : 1 - out) * WALK_CYCLES % 1) * clipLength : 0;
      mixer.update(0);
      armPose.copy(armRoot.quaternion);
      forearmPose.copy(forearm.quaternion);
      armRoot.quaternion.premultiply(bend.identity().slerp(raised, wave));
      forearm.quaternion.premultiply(bend.setFromAxisAngle(bendAxis, wave * Math.sin(time * 6) * 0.5));
    },
    dispose() {
      lost = true;
    },
  };
}
